import { defineStore } from 'pinia'
import { useSync } from '../composables/useSync'

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack']

function createEmptyWeek() {
  const days = {}
  DAYS.forEach((day) => {
    days[day] = { breakfast: [], lunch: [], dinner: [], snack: [] }
  })
  return days
}

/** Returns the local-date ISO string (YYYY-MM-DD) for the Sunday of `date`'s week. */
function getWeekStart(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - d.getDay()) // back up to Sunday (getDay: 0=Sun)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Migrate legacy slot data: string ID → [id], null → []
 * Runs once on store hydration to handle existing localStorage data.
 */
function migrateWeekPlans(weekPlans) {
  if (!weekPlans || typeof weekPlans !== 'object') return weekPlans

  for (const weekKey of Object.keys(weekPlans)) {
    const week = weekPlans[weekKey]
    if (!week?.days) continue

    for (const day of DAYS) {
      if (!week.days[day]) continue
      for (const slot of SLOTS) {
        const val = week.days[day][slot]
        if (val === null || val === undefined) {
          week.days[day][slot] = []
        } else if (typeof val === 'string') {
          week.days[day][slot] = [val]
        } else if (!Array.isArray(val)) {
          week.days[day][slot] = []
        }
      }
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
        this.weekPlans[weekStart] = {
          weekStart,
          days: createEmptyWeek()
        }
      }
    },

    /** Build a slot upsert payload for sync */
    _queueSlot(weekStart, day, slotType) {
      try {
        const mealIds = this.weekPlans[weekStart]?.days[day]?.[slotType] || []
        useSync().queueChange('slot_upsert', {
          weekStart, day, slotType, mealIds,
          updatedAt: new Date().toISOString()
        })
      } catch (e) { console.warn('[planner] sync queue failed:', e) }
    },

    /** Add a meal to a slot (no duplicates) */
    addMealToSlot(day, slot, mealId) {
      this.ensureWeekExists(this.currentWeekStart)
      const arr = this.weekPlans[this.currentWeekStart].days[day][slot]
      if (!arr.includes(mealId)) {
        arr.push(mealId)
      }
      this._queueSlot(this.currentWeekStart, day, slot)
    },

    /** Remove a specific meal from a slot */
    removeMealFromSlot(day, slot, mealId) {
      this.ensureWeekExists(this.currentWeekStart)
      const arr = this.weekPlans[this.currentWeekStart].days[day][slot]
      const idx = arr.indexOf(mealId)
      if (idx !== -1) {
        arr.splice(idx, 1)
      }
      this._queueSlot(this.currentWeekStart, day, slot)
    },

    /** Clear an entire slot back to empty */
    clearSlot(day, slot) {
      this.ensureWeekExists(this.currentWeekStart)
      this.weekPlans[this.currentWeekStart].days[day][slot] = []
      this._queueSlot(this.currentWeekStart, day, slot)
    },

    /** Swap entire arrays between two slots */
    swapSlots(fromDay, fromSlot, toDay, toSlot) {
      this.ensureWeekExists(this.currentWeekStart)
      const plan = this.weekPlans[this.currentWeekStart].days
      const temp = [...plan[fromDay][fromSlot]]
      plan[fromDay][fromSlot] = [...plan[toDay][toSlot]]
      plan[toDay][toSlot] = temp
      this._queueSlot(this.currentWeekStart, fromDay, fromSlot)
      this._queueSlot(this.currentWeekStart, toDay, toSlot)
    },

    clearWeek() {
      this.weekPlans[this.currentWeekStart] = {
        weekStart: this.currentWeekStart,
        days: createEmptyWeek()
      }
      // Queue all slots as empty
      const ws = this.currentWeekStart
      for (const day of DAYS) {
        for (const slot of SLOTS) {
          this._queueSlot(ws, day, slot)
        }
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

      // Queue all copied slots
      for (const day of DAYS) {
        for (const slot of SLOTS) {
          this._queueSlot(nextWeekKey, day, slot)
        }
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
      // Migrate any legacy single-ID slot data to arrays on load
      ctx.store.weekPlans = migrateWeekPlans(ctx.store.weekPlans)
      // Always reset to the actual current week on load — the persisted
      // currentWeekStart could be stale (from a previous session/week)
      ctx.store.currentWeekStart = getWeekStart()
    }
  }
})
