import { defineStore } from 'pinia'
import { useSync } from '../composables/useSync'
import { DEFAULT_FLAGGED_KEYWORDS } from '../utils/ingredientVetting'
import { DEFAULT_CLEANIFY_RULES } from '../utils/cleanify'

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
    },

    flaggedIngredients: [...DEFAULT_FLAGGED_KEYWORDS],

    cleanifyRules: DEFAULT_CLEANIFY_RULES.map((r) => ({ ...r })),

    /**
     * Recipe categories — editable list. Order is the display order in the
     * Library filter chips (with the "All" pseudo-chip rendered at the end).
     * `value` is stored on each meal record; `label` is what users see.
     */
    categories: [
      { value: 'breakfast', label: 'Breakfast' },
      { value: 'lunch', label: 'Lunch' },
      { value: 'dinner', label: 'Dinner' },
      { value: 'snack', label: 'Snack' },
      { value: 'dessert', label: 'Dessert' },
      { value: 'drink', label: 'Drink' }
    ]
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

    /** Add a flagged ingredient keyword */
    addFlaggedIngredient(keyword) {
      const normalized = keyword.trim().toLowerCase()
      if (!normalized) return false
      if (this.flaggedIngredients.includes(normalized)) return false
      this.flaggedIngredients.push(normalized)
      this._syncSettings()
      return true
    },

    /** Remove a flagged ingredient keyword */
    removeFlaggedIngredient(keyword) {
      this.flaggedIngredients = this.flaggedIngredients.filter((k) => k !== keyword)
      this._syncSettings()
    },

    /** Reset flagged ingredients to defaults */
    resetFlaggedIngredients() {
      this.flaggedIngredients = [...DEFAULT_FLAGGED_KEYWORDS]
      this._syncSettings()
    },

    /** Add a cleanify rule */
    addCleanifyRule(from, to) {
      const normFrom = from.trim().toLowerCase()
      const normTo = to.trim().toLowerCase()
      if (!normFrom || !normTo) return false
      if (this.cleanifyRules.some((r) => r.from === normFrom)) return false
      this.cleanifyRules.push({ from: normFrom, to: normTo })
      this._syncSettings()
      return true
    },

    /** Remove a cleanify rule by from value */
    removeCleanifyRule(from) {
      this.cleanifyRules = this.cleanifyRules.filter((r) => r.from !== from)
      this._syncSettings()
    },

    /** Reset cleanify rules to defaults */
    resetCleanifyRules() {
      this.cleanifyRules = DEFAULT_CLEANIFY_RULES.map((r) => ({ ...r }))
      this._syncSettings()
    },

    /** Add a custom recipe category. Returns true if added, false if duplicate. */
    addCategory(label) {
      const trimmed = (label || '').trim()
      if (!trimmed) return false
      const value = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '')
      if (!value) return false
      if (this.categories.some((c) => c.value === value)) return false
      this.categories.push({ value, label: trimmed })
      this._syncSettings()
      return true
    },

    /** Remove a category by value */
    removeCategory(value) {
      this.categories = this.categories.filter((c) => c.value !== value)
      this._syncSettings()
    },

    /** Move a category up (-1) or down (+1) in the list */
    moveCategory(value, direction) {
      const idx = this.categories.findIndex((c) => c.value === value)
      if (idx === -1) return
      const newIdx = idx + direction
      if (newIdx < 0 || newIdx >= this.categories.length) return
      const [item] = this.categories.splice(idx, 1)
      this.categories.splice(newIdx, 0, item)
      this._syncSettings()
    },

    _syncSettings() {
      try {
        useSync().queueChange('settings_upsert', {
          codes: this.codes,
          assignments: this.assignments,
          flaggedIngredients: this.flaggedIngredients,
          cleanifyRules: this.cleanifyRules,
          categories: this.categories
        })
      } catch (e) {
        console.warn('[settings] sync queue failed:', e)
      }
    }
  },

  persist: true
})
