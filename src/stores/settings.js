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
      monday:    { breakfast: 'R', lunch: 'S', dinner: 'R' },
      tuesday:   { breakfast: 'R', lunch: 'S', dinner: 'R' },
      wednesday: { breakfast: 'F', lunch: 'S', dinner: 'F' },
      thursday:  { breakfast: 'F', lunch: 'R', dinner: 'F' },
      friday:    { breakfast: 'R', lunch: 'F', dinner: 'R' },
      saturday:  { breakfast: 'A', lunch: 'A', dinner: 'A' },
      sunday:    { breakfast: 'F', lunch: 'F', dinner: 'S' }
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
    ],

    /**
     * Helpers — color-only identifiers for "kids helping with this meal".
     * Each helper has just an id and a color (no names per design decision).
     * Default: two distinct colors so the feature is usable out of the box.
     */
    helpers: [
      { id: 'h1', color: '#9B59B6' },
      { id: 'h2', color: '#1ABC9C' }
    ],

    /**
     * Meal shortcuts — quick-pick tags that expand to a full meal text.
     * Each shortcut: { id, abbreviation, expansion, recurringDay, recurringSlot }
     * - abbreviation: short label like "TT"
     * - expansion: full text like "Taco Tuesday"
     * - recurringDay: 'monday'..'sunday' | null (when set, auto-fills new weeks)
     * - recurringSlot: 'breakfast' | 'lunch' | 'dinner' (default 'dinner')
     */
    mealShortcuts: []
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

    /** Add a helper with the given color. Returns the new helper object. */
    addHelper(color) {
      const id = 'h' + Math.random().toString(36).slice(2, 9)
      const helper = { id, color: color || '#9B59B6' }
      this.helpers.push(helper)
      this._syncSettings()
      return helper
    },

    /** Update a helper's color */
    updateHelperColor(id, color) {
      const h = this.helpers.find((x) => x.id === id)
      if (h) {
        h.color = color
        this._syncSettings()
      }
    },

    /** Remove a helper by id */
    removeHelper(id) {
      this.helpers = this.helpers.filter((h) => h.id !== id)
      this._syncSettings()
    },

    /** Add a meal shortcut */
    addMealShortcut({ abbreviation, expansion, recurringDay = null, recurringSlot = 'dinner' }) {
      const ab = (abbreviation || '').trim()
      const ex = (expansion || '').trim()
      if (!ab || !ex) return false
      // Don't duplicate by abbreviation (case-insensitive)
      if (this.mealShortcuts.some((s) => s.abbreviation.toLowerCase() === ab.toLowerCase())) return false
      this.mealShortcuts.push({
        id: 's' + Math.random().toString(36).slice(2, 10),
        abbreviation: ab,
        expansion: ex,
        recurringDay: recurringDay || null,
        recurringSlot: recurringSlot || 'dinner'
      })
      this._syncSettings()
      return true
    },

    /** Update an existing shortcut */
    updateMealShortcut(id, updates) {
      const s = this.mealShortcuts.find((x) => x.id === id)
      if (!s) return
      if (typeof updates.abbreviation === 'string') s.abbreviation = updates.abbreviation.trim()
      if (typeof updates.expansion === 'string') s.expansion = updates.expansion.trim()
      if ('recurringDay' in updates) s.recurringDay = updates.recurringDay || null
      if (typeof updates.recurringSlot === 'string') s.recurringSlot = updates.recurringSlot
      this._syncSettings()
    },

    /** Remove a meal shortcut */
    removeMealShortcut(id) {
      this.mealShortcuts = this.mealShortcuts.filter((s) => s.id !== id)
      this._syncSettings()
    },

    _syncSettings() {
      try {
        useSync().queueChange('settings_upsert', {
          codes: this.codes,
          assignments: this.assignments,
          flaggedIngredients: this.flaggedIngredients,
          cleanifyRules: this.cleanifyRules,
          categories: this.categories,
          helpers: this.helpers,
          mealShortcuts: this.mealShortcuts
        })
      } catch (e) {
        console.warn('[settings] sync queue failed:', e)
      }
    }
  },

  persist: {
    afterHydrate(ctx) {
      // Drop legacy `snack` slot from persisted assignments (no longer in product)
      const a = ctx.store.assignments
      if (a && typeof a === 'object') {
        for (const day of Object.keys(a)) {
          if (a[day] && 'snack' in a[day]) {
            delete a[day].snack
          }
        }
      }
    }
  }
})
