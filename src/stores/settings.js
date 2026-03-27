import { defineStore } from 'pinia'
import { useSync } from '../composables/useSync'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    codes: [
      { letter: 'F', color: '#9B59B6', label: 'Purple' },
      { letter: 'R', color: '#E74C3C', label: 'Red' },
      { letter: 'S', color: '#3498DB', label: 'Blue' },
      { letter: 'A', color: '#95A5A6', label: 'Grey' }
    ],

    assignments: {
      sunday:    { breakfast: 'F', lunch: 'F', dinner: 'S', snack: null },
      monday:    { breakfast: 'R', lunch: 'S', dinner: 'R', snack: null },
      tuesday:   { breakfast: 'R', lunch: 'S', dinner: 'R', snack: null },
      wednesday: { breakfast: 'F', lunch: 'S', dinner: 'F', snack: null },
      thursday:  { breakfast: 'F', lunch: 'R', dinner: 'F', snack: null },
      friday:    { breakfast: 'R', lunch: 'F', dinner: 'R', snack: null },
      saturday:  { breakfast: 'A', lunch: 'A', dinner: 'A', snack: null }
    }
  }),

  getters: {
    /** Get the code object for a given day+slot, or null */
    getCodeForSlot: (state) => (day, slot) => {
      const letter = state.assignments[day]?.[slot]
      if (!letter) return null
      return state.codes.find((c) => c.letter === letter) || null
    },

    /** Get code object by letter */
    getCodeByLetter: (state) => (letter) => {
      return state.codes.find((c) => c.letter === letter) || null
    }
  },

  actions: {
    /** Update a code definition */
    updateCode(index, updates) {
      if (this.codes[index]) {
        Object.assign(this.codes[index], updates)
        this._syncSettings()
      }
    },

    /** Add a new code */
    addCode(code) {
      this.codes.push(code)
      this._syncSettings()
    },

    /** Remove a code by index (min 1 must remain) */
    removeCode(index) {
      if (this.codes.length <= 1) return
      const removed = this.codes[index]
      this.codes.splice(index, 1)
      // Clear assignments that used the removed code
      if (removed) {
        for (const day of Object.keys(this.assignments)) {
          for (const slot of Object.keys(this.assignments[day])) {
            if (this.assignments[day][slot] === removed.letter) {
              this.assignments[day][slot] = null
            }
          }
        }
      }
      this._syncSettings()
    },

    /** Set assignment for a day+slot */
    setAssignment(day, slot, letter) {
      if (this.assignments[day]) {
        this.assignments[day][slot] = letter
        this._syncSettings()
      }
    },

    /** Cycle through codes for a day+slot (including null) */
    cycleAssignment(day, slot) {
      const current = this.assignments[day]?.[slot]
      const letters = this.codes.map((c) => c.letter)
      if (!current) {
        this.assignments[day][slot] = letters[0] || null
      } else {
        const idx = letters.indexOf(current)
        if (idx === letters.length - 1) {
          this.assignments[day][slot] = null
        } else {
          this.assignments[day][slot] = letters[idx + 1]
        }
      }
      this._syncSettings()
    },

    _syncSettings() {
      try {
        useSync().queueChange('settings_upsert', {
          codes: this.codes,
          assignments: this.assignments
        })
      } catch (e) {
        console.warn('[settings] sync queue failed:', e)
      }
    }
  },

  persist: true
})
