import { defineStore } from 'pinia'
import { useSync } from '../composables/useSync'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const SLOTS = ['breakfast', 'lunch', 'dinner']

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
  return { breakfast: null, lunch: null, dinner: null, notes: '' }
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
      if (!isLegacy && dayData.notes !== undefined) continue

      const newDay = emptyDay()
      for (const slot of SLOTS) {
        const val = dayData[slot]
        let ids = []
        if (Array.isArray(val)) ids = val.filter((x) => typeof x === 'string')
        else if (typeof val === 'string') ids = [val]

        // Legacy data: keep recipeIds, leave text empty (MealSlot derives display
        // name from linked recipes when text is empty).
        newDay[slot] = ids.length === 0 ? null : makeMealEntry('', ids)
      }
      newDay.notes = typeof dayData.notes === 'string' ? dayData.notes : ''
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
    }
  },

  actions: {
    ensureWeekExists(weekStart) {
      if (!this.weekPlans[weekStart]) {
        this.weekPlans[weekStart] = { weekStart, days: createEmptyWeek() }
      }
      // Defensive: ensure all days have the new shape
      const days = this.weekPlans[weekStart].days
      for (const day of DAYS) {
        if (!days[day]) days[day] = emptyDay()
        if (days[day].notes === undefined) days[day].notes = ''
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

    _queueDayNotes(weekStart, day) {
      try {
        const notes = this.weekPlans[weekStart]?.days[day]?.notes || ''
        useSync().queueChange('day_notes_upsert', {
          weekStart, day, notes,
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

    /** Replace the meal entry wholesale (used by the meal editor sheet) */
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
          prepTasks: [...(entry.prepTasks || [])]
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
      this._queueDayNotes(this.currentWeekStart, day)
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
        this._queueDayNotes(ws, day)
      }
    },

    copyToNextWeek() {
      const current = this.weekPlans[this.currentWeekStart]
      if (!current) return

      const nextStart = new Date(this.currentWeekStart + 'T00:00:00')
      nextStart.setDate(nextStart.getDate() + 7)
      const nextWeekKey = getWeekStart(nextStart)

      this.weekPlans[nextWeekKey] = JSON.parse(JSON.stringify(current))
      this.weekPlans[nextWeekKey].weekStart = nextWeekKey

      for (const day of DAYS) {
        for (const slot of SLOTS) {
          this._queueSlot(nextWeekKey, day, slot)
        }
        this._queueDayNotes(nextWeekKey, day)
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
