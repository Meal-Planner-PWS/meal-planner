import { defineStore } from 'pinia'
import { useSync } from '../composables/useSync'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const SLOTS = ['breakfast', 'lunch', 'dinner']

function genId() {
  return 'p' + Math.random().toString(36).slice(2, 10)
}

/**
 * MealEntry shape stored at weekPlans[weekStart].days[day][slot]:
 *   { text: String, recipeIds: [String], helperIds: [String], prepTasks: [...] } | null
 *
 * Day-level shape:
 *   { breakfast: MealEntry|null, lunch: MealEntry|null, dinner: MealEntry|null, notes: String }
 */
function makeMealEntry(text = '', recipeIds = []) {
  return { text, recipeIds: [...recipeIds], helperIds: [], prepTasks: [] }
}

function emptyDay() {
  return { breakfast: null, lunch: null, dinner: null, notes: '', prepTasks: [] }
}

function createEmptyWeek() {
  const days = {}
  DAYS.forEach((day) => { days[day] = emptyDay() })
  return days
}

/** Returns the local-date ISO string (YYYY-MM-DD) for the Monday of `date`'s week. */
function getWeekStart(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  // getDay: 0=Sun, 1=Mon, ..., 6=Sat. Roll back to Monday.
  const offset = d.getDay() === 0 ? -6 : 1 - d.getDay()
  d.setDate(d.getDate() + offset)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Migrate legacy planner data to the new MealEntry shape.
 * Legacy shape: weekPlans[ws].days[day][slot] = [recipeId, ...] | recipeId | null
 * Includes Sunday-start weeks (everything still keyed by 'monday'..'sunday' regardless).
 *
 * Snack data is dropped (intentional — no longer in product). Day notes default to ''.
 */
function migrateWeekPlans(weekPlans) {
  if (!weekPlans || typeof weekPlans !== 'object') return weekPlans

  for (const weekKey of Object.keys(weekPlans)) {
    const week = weekPlans[weekKey]
    if (!week?.days) continue

    for (const day of DAYS) {
      const dayData = week.days[day]
      if (!dayData) {
        week.days[day] = emptyDay()
        continue
      }

      const isLegacy = Array.isArray(dayData.breakfast) || typeof dayData.breakfast === 'string' ||
                       Array.isArray(dayData.lunch) || typeof dayData.lunch === 'string' ||
                       Array.isArray(dayData.dinner) || typeof dayData.dinner === 'string'

      // Always run the prep-tasks lift below — even on already-migrated data —
      // so older entries with entry.prepTasks get moved up to dayData.prepTasks.
      if (!isLegacy && dayData.notes !== undefined) {
        // Phase 4→5 migration: lift any per-entry prepTasks up to day level
        if (!Array.isArray(dayData.prepTasks)) dayData.prepTasks = []
        for (const slot of SLOTS) {
          const entry = dayData[slot]
          if (entry && Array.isArray(entry.prepTasks) && entry.prepTasks.length > 0) {
            for (const t of entry.prepTasks) {
              dayData.prepTasks.push({ ...t })
            }
            entry.prepTasks = []
          }
        }
        continue
      }

      const newDay = emptyDay()
      for (const slot of SLOTS) {
        const val = dayData[slot]
        let ids = []
        if (Array.isArray(val)) ids = val.filter((x) => typeof x === 'string')
        else if (typeof val === 'string') ids = [val]

        newDay[slot] = ids.length === 0 ? null : makeMealEntry('', ids)
      }
      newDay.notes = typeof dayData.notes === 'string' ? dayData.notes : ''
      newDay.prepTasks = Array.isArray(dayData.prepTasks) ? dayData.prepTasks : []
      week.days[day] = newDay
    }
  }

  return weekPlans
}

export const usePlannerStore = defineStore('planner', {
  state: () => ({
    weekPlans: {},
    currentWeekStart: getWeekStart()
  }),

  getters: {
    currentWeek(state) {
      if (!state.weekPlans[state.currentWeekStart]) {
        return { weekStart: state.currentWeekStart, days: createEmptyWeek() }
      }
      return state.weekPlans[state.currentWeekStart]
    },

    /**
     * Prep tasks aggregated by the day they're due, walking every meal in the current week.
     * Returns a function: dueDay → [{ task, mealDay, mealSlot, mealText }]
     */
    prepTasksByDay(state) {
      return (dueDay) => {
        const week = state.weekPlans[state.currentWeekStart]
        if (!week) return []
        const result = []
        for (const day of DAYS) {
          const dayData = week.days[day]
          if (!dayData?.prepTasks) continue
          for (const task of dayData.prepTasks) {
            if (task.dueDay === dueDay) {
              result.push({ task, ownerDay: day })
            }
          }
        }
        return result
      }
    }
  },

  actions: {
    ensureWeekExists(weekStart) {
      const isNewWeek = !this.weekPlans[weekStart]
      if (isNewWeek) {
        this.weekPlans[weekStart] = { weekStart, days: createEmptyWeek() }
      }
      // Defensive: ensure all days have the new shape
      const days = this.weekPlans[weekStart].days
      for (const day of DAYS) {
        if (!days[day]) days[day] = emptyDay()
        if (days[day].notes === undefined) days[day].notes = ''
      }

      // Auto-apply recurring meal shortcuts ONLY when a brand-new week is created.
      // (Lazy-load settings store to avoid circular import issues.)
      if (isNewWeek) {
        try {
          // Dynamic import keeps this hook free of top-level circular deps
          import('./settings').then(({ useSettingsStore }) => {
            const settingsStore = useSettingsStore()
            const shortcuts = settingsStore.mealShortcuts || []
            for (const s of shortcuts) {
              if (!s.recurringDay || !s.recurringSlot) continue
              const dayData = this.weekPlans[weekStart]?.days[s.recurringDay]
              if (!dayData) continue
              // Don't overwrite if the user already set something
              if (dayData[s.recurringSlot]) continue
              dayData[s.recurringSlot] = makeMealEntry(s.expansion, [])
              this._queueSlot(weekStart, s.recurringDay, s.recurringSlot)
            }
          }).catch(() => { /* settings not yet hydrated — skip */ })
        } catch { /* noop */ }
      }
    },

    /** Build a slot upsert payload for sync */
    _queueSlot(weekStart, day, slotType) {
      try {
        const entry = this.weekPlans[weekStart]?.days[day]?.[slotType] || null
        useSync().queueChange('slot_upsert', {
          weekStart, day, slotType, entry,
          updatedAt: new Date().toISOString()
        })
      } catch (e) { console.warn('[planner] sync queue failed:', e) }
    },

    _queueDay(weekStart, day) {
      try {
        const dayData = this.weekPlans[weekStart]?.days[day] || {}
        useSync().queueChange('day_upsert', {
          weekStart, day,
          notes: dayData.notes || '',
          prepTasks: Array.isArray(dayData.prepTasks) ? dayData.prepTasks : [],
          updatedAt: new Date().toISOString()
        })
      } catch (e) { console.warn('[planner] sync queue failed:', e) }
    },

    /** Set the meal text for a slot. Creates an entry if none exists. */
    setMealText(day, slot, text) {
      this.ensureWeekExists(this.currentWeekStart)
      const dayData = this.weekPlans[this.currentWeekStart].days[day]
      const trimmed = (text || '').trim()
      if (!trimmed && (!dayData[slot] || dayData[slot].recipeIds.length === 0)) {
        // Empty text + no linked recipes → clear the slot
        dayData[slot] = null
      } else {
        if (!dayData[slot]) dayData[slot] = makeMealEntry()
        dayData[slot].text = trimmed
      }
      this._queueSlot(this.currentWeekStart, day, slot)
    },

    /** Replace the meal entry wholesale (used by the meal editor sheet).
     *  prepTasks is intentionally ignored on the entry — prep is day-scoped now. */
    setMeal(day, slot, entry) {
      this.ensureWeekExists(this.currentWeekStart)
      const dayData = this.weekPlans[this.currentWeekStart].days[day]
      if (!entry || (!entry.text?.trim() && (!entry.recipeIds || entry.recipeIds.length === 0))) {
        dayData[slot] = null
      } else {
        dayData[slot] = {
          text: entry.text?.trim() || '',
          recipeIds: [...(entry.recipeIds || [])],
          helperIds: [...(entry.helperIds || [])],
          prepTasks: []
        }
      }
      this._queueSlot(this.currentWeekStart, day, slot)
    },

    /** Add a recipe link to the meal at this slot. Creates entry if missing. */
    linkRecipe(day, slot, recipeId, recipeName) {
      this.ensureWeekExists(this.currentWeekStart)
      const dayData = this.weekPlans[this.currentWeekStart].days[day]
      if (!dayData[slot]) dayData[slot] = makeMealEntry(recipeName || '')
      if (!dayData[slot].recipeIds.includes(recipeId)) {
        dayData[slot].recipeIds.push(recipeId)
      }
      // If text is still empty, default to recipe name
      if (!dayData[slot].text && recipeName) dayData[slot].text = recipeName
      this._queueSlot(this.currentWeekStart, day, slot)
    },

    unlinkRecipe(day, slot, recipeId) {
      this.ensureWeekExists(this.currentWeekStart)
      const dayData = this.weekPlans[this.currentWeekStart].days[day]
      if (!dayData[slot]) return
      dayData[slot].recipeIds = dayData[slot].recipeIds.filter((id) => id !== recipeId)
      this._queueSlot(this.currentWeekStart, day, slot)
    },

    /** Clear a slot completely (text + recipes + helpers + prep) */
    clearSlot(day, slot) {
      this.ensureWeekExists(this.currentWeekStart)
      this.weekPlans[this.currentWeekStart].days[day][slot] = null
      this._queueSlot(this.currentWeekStart, day, slot)
    },

    setDayNotes(day, notes) {
      this.ensureWeekExists(this.currentWeekStart)
      this.weekPlans[this.currentWeekStart].days[day].notes = notes || ''
      this._queueDay(this.currentWeekStart, day)
    },

    /** Add a prep task on the OWNER day. dueDay can differ from ownerDay (e.g. owner=Monday, due=Sunday). */
    addPrepTask(ownerDay, taskText, dueDay) {
      this.ensureWeekExists(this.currentWeekStart)
      const dayData = this.weekPlans[this.currentWeekStart].days[ownerDay]
      if (!dayData) return
      const text = (taskText || '').trim()
      if (!text) return
      if (!Array.isArray(dayData.prepTasks)) dayData.prepTasks = []
      dayData.prepTasks.push({
        id: genId(),
        text,
        dueDay: dueDay || ownerDay,
        done: false
      })
      this._queueDay(this.currentWeekStart, ownerDay)
    },

    updatePrepTask(ownerDay, taskId, updates) {
      this.ensureWeekExists(this.currentWeekStart)
      const dayData = this.weekPlans[this.currentWeekStart].days[ownerDay]
      if (!dayData?.prepTasks) return
      const task = dayData.prepTasks.find((t) => t.id === taskId)
      if (!task) return
      if (typeof updates.text === 'string') task.text = updates.text
      if (typeof updates.dueDay === 'string') task.dueDay = updates.dueDay
      this._queueDay(this.currentWeekStart, ownerDay)
    },

    togglePrepTask(ownerDay, taskId) {
      this.ensureWeekExists(this.currentWeekStart)
      const dayData = this.weekPlans[this.currentWeekStart].days[ownerDay]
      if (!dayData?.prepTasks) return
      const task = dayData.prepTasks.find((t) => t.id === taskId)
      if (!task) return
      task.done = !task.done
      this._queueDay(this.currentWeekStart, ownerDay)
    },

    removePrepTask(ownerDay, taskId) {
      this.ensureWeekExists(this.currentWeekStart)
      const dayData = this.weekPlans[this.currentWeekStart].days[ownerDay]
      if (!dayData?.prepTasks) return
      dayData.prepTasks = dayData.prepTasks.filter((t) => t.id !== taskId)
      this._queueDay(this.currentWeekStart, ownerDay)
    },

    /** Set the entire prep list for a day (used when MealEditor commits its working copy) */
    setDayPrepTasks(ownerDay, tasks) {
      this.ensureWeekExists(this.currentWeekStart)
      const dayData = this.weekPlans[this.currentWeekStart].days[ownerDay]
      if (!dayData) return
      dayData.prepTasks = (tasks || []).map((t) => ({
        id: t.id || genId(),
        text: t.text || '',
        dueDay: t.dueDay || ownerDay,
        done: !!t.done
      }))
      this._queueDay(this.currentWeekStart, ownerDay)
    },

    /** Swap entries between two slots (still used as a fallback for accessibility) */
    swapSlots(fromDay, fromSlot, toDay, toSlot) {
      this.ensureWeekExists(this.currentWeekStart)
      const plan = this.weekPlans[this.currentWeekStart].days
      const temp = plan[fromDay][fromSlot]
      plan[fromDay][fromSlot] = plan[toDay][toSlot]
      plan[toDay][toSlot] = temp
      this._queueSlot(this.currentWeekStart, fromDay, fromSlot)
      this._queueSlot(this.currentWeekStart, toDay, toSlot)
    },

    /** Move a meal entry from one slot to another (drag-and-drop). Replaces the destination. */
    moveMeal(fromDay, fromSlot, toDay, toSlot) {
      if (fromDay === toDay && fromSlot === toSlot) return
      this.ensureWeekExists(this.currentWeekStart)
      const plan = this.weekPlans[this.currentWeekStart].days
      const moved = plan[fromDay][fromSlot]
      plan[fromDay][fromSlot] = null
      plan[toDay][toSlot] = moved
      this._queueSlot(this.currentWeekStart, fromDay, fromSlot)
      this._queueSlot(this.currentWeekStart, toDay, toSlot)
    },

    clearWeek() {
      this.weekPlans[this.currentWeekStart] = {
        weekStart: this.currentWeekStart,
        days: createEmptyWeek()
      }
      const ws = this.currentWeekStart
      for (const day of DAYS) {
        for (const slot of SLOTS) {
          this._queueSlot(ws, day, slot)
        }
        this._queueDay(ws, day)
      }
    },

    copyToNextWeek() {
      const current = this.weekPlans[this.currentWeekStart]
      if (!current) return

      const nextStart = new Date(this.currentWeekStart + 'T00:00:00')
      nextStart.setDate(nextStart.getDate() + 7)
      const nextWeekKey = getWeekStart(nextStart)

      const copied = JSON.parse(JSON.stringify(current))
      copied.weekStart = nextWeekKey

      // Reset prep task done flags + regenerate task IDs so they don't collide with the source week
      for (const day of DAYS) {
        const dayData = copied.days[day]
        if (!dayData) continue
        if (Array.isArray(dayData.prepTasks)) {
          dayData.prepTasks = dayData.prepTasks.map((t) => ({
            id: genId(),
            text: t.text,
            dueDay: t.dueDay,
            done: false
          }))
        }
        // Drop legacy per-entry prepTasks (no longer used)
        for (const slot of SLOTS) {
          if (dayData[slot]?.prepTasks) dayData[slot].prepTasks = []
        }
      }

      this.weekPlans[nextWeekKey] = copied

      for (const day of DAYS) {
        for (const slot of SLOTS) {
          this._queueSlot(nextWeekKey, day, slot)
        }
        this._queueDay(nextWeekKey, day)
      }
    },

    navigateWeek(direction) {
      const d = new Date(this.currentWeekStart + 'T00:00:00')
      d.setDate(d.getDate() + direction * 7)
      this.currentWeekStart = getWeekStart(d)
    }
  },

  persist: {
    afterHydrate(ctx) {
      ctx.store.weekPlans = migrateWeekPlans(ctx.store.weekPlans)
      // Always reset to actual current week — persisted value can be stale
      ctx.store.currentWeekStart = getWeekStart()
    }
  }
})
