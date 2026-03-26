import { defineStore } from 'pinia'
import { useSync } from '../composables/useSync'

/** UUID generator with fallback for older browsers lacking crypto.randomUUID */
function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback: use crypto.getRandomValues which has wider support
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
    (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16)
  )
}

export const useMealStore = defineStore('meals', {
  state: () => ({
    meals: []
  }),

  getters: {
    getMealById: (state) => (id) => {
      return state.meals.find((m) => m.id === id)
    },

    favoritesMeals: (state) => {
      return state.meals.filter((m) => m.isFavorite)
    },

    mealsByCategory: (state) => (category) => {
      return state.meals.filter((m) => m.category === category)
    },

    /** Returns meals sorted with favorites first, then alphabetically */
    sortedMeals: (state) => {
      return [...state.meals].sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return b.isFavorite ? 1 : -1
        return a.name.localeCompare(b.name)
      })
    },

    /** Filtered + sorted meals for the library view */
    filteredMeals: (state) => (search, category, favoritesOnly) => {
      let result = [...state.meals]

      if (favoritesOnly) {
        result = result.filter((m) => m.isFavorite)
      }

      if (category && category !== 'all') {
        result = result.filter((m) => m.category === category)
      }

      if (search) {
        const q = search.toLowerCase()
        result = result.filter(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            m.ingredients.some((i) => i.toLowerCase().includes(q))
        )
      }

      // Favorites bubble to top, then alphabetical
      return result.sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return b.isFavorite ? 1 : -1
        return a.name.localeCompare(b.name)
      })
    }
  },

  actions: {
    addMeal(meal) {
      const now = new Date().toISOString()
      const newMeal = {
        id: generateId(),
        name: '',
        category: 'dinner',
        ingredients: [],
        instructions: '',
        sourceUrl: '',
        notes: '',
        photo: '',
        isFavorite: false,
        createdAt: now,
        updatedAt: now,
        ...meal
      }
      this.meals.push(newMeal)
      try { useSync().queueChange('meal_upsert', newMeal) } catch (e) { console.warn('[meals] sync queue failed:', e) }
    },

    updateMeal(id, updates) {
      const idx = this.meals.findIndex((m) => m.id === id)
      if (idx !== -1) {
        this.meals[idx] = {
          ...this.meals[idx],
          ...updates,
          updatedAt: new Date().toISOString()
        }
        try { useSync().queueChange('meal_upsert', this.meals[idx]) } catch (e) { console.warn('[meals] sync queue failed:', e) }
      }
    },

    deleteMeal(id) {
      this.meals = this.meals.filter((m) => m.id !== id)
      try { useSync().queueChange('meal_delete', { id }) } catch (e) { console.warn('[meals] sync queue failed:', e) }
    },

    toggleFavorite(id) {
      const meal = this.meals.find((m) => m.id === id)
      if (meal) {
        meal.isFavorite = !meal.isFavorite
        meal.updatedAt = new Date().toISOString()
        try { useSync().queueChange('meal_upsert', meal) } catch (e) { console.warn('[meals] sync queue failed:', e) }
      }
    }
  },

  persist: true
})
