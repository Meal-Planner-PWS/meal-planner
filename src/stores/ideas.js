import { defineStore } from 'pinia'
import axios from 'axios'

const API_KEY = import.meta.env.VITE_SPOONACULAR_KEY
const BASE_URL = 'https://api.spoonacular.com'
const MAX_CACHED_SEARCHES = 3

export const useIdeasStore = defineStore('ideas', {
  state: () => ({
    ingredients: [],
    results: [],
    cachedResults: {},
    recipeDetail: null,
    detailLoading: false,
    loading: false,
    error: null,
    // Holds pre-filled recipe data for the MealForm "Save to Library" flow
    pendingRecipe: null
  }),

  getters: {
    hasResults: (state) => state.results.length > 0,
    cacheKey: (state) => [...state.ingredients].sort().join(',')
  },

  actions: {
    addIngredient(ingredient) {
      const trimmed = ingredient.trim().toLowerCase()
      if (trimmed && !this.ingredients.includes(trimmed)) {
        this.ingredients.push(trimmed)
      }
    },

    removeIngredient(ingredient) {
      this.ingredients = this.ingredients.filter((i) => i !== ingredient)
    },

    clearIngredients() {
      this.ingredients = []
      this.results = []
      this.error = null
    },

    async fetchRecipes() {
      if (!this.ingredients.length) return

      // Check cache first
      const key = this.cacheKey
      if (this.cachedResults[key]) {
        this.results = this.cachedResults[key]
        this.error = null
        return
      }

      this.loading = true
      this.error = null

      try {
        const response = await axios.get(`${BASE_URL}/recipes/findByIngredients`, {
          params: {
            ingredients: this.ingredients.join(','),
            number: 12,
            ranking: 1,
            ignorePantry: true,
            apiKey: API_KEY
          }
        })

        this.results = response.data
        // Cache this search
        this.cachedResults[key] = response.data
        this._trimCache()
      } catch (err) {
        if (err.response?.status === 402) {
          this.error = 'Daily recipe search limit reached — try again tomorrow.'
        } else {
          this.error = "Couldn't reach recipe search right now — try again in a moment."
        }
      } finally {
        this.loading = false
      }
    },

    async fetchRecipeDetail(id) {
      this.detailLoading = true
      this.recipeDetail = null

      try {
        const response = await axios.get(`${BASE_URL}/recipes/${id}/information`, {
          params: { apiKey: API_KEY }
        })
        this.recipeDetail = response.data
      } catch (err) {
        if (err.response?.status === 402) {
          this.error = 'Daily recipe search limit reached — try again tomorrow.'
        } else {
          this.error = "Couldn't load recipe details — try again in a moment."
        }
      } finally {
        this.detailLoading = false
      }
    },

    clearRecipeDetail() {
      this.recipeDetail = null
    },

    /** Set pre-filled recipe for the MealForm "Save to Library" flow */
    setPendingRecipe(recipe) {
      this.pendingRecipe = recipe
    },

    consumePendingRecipe() {
      const recipe = this.pendingRecipe
      this.pendingRecipe = null
      return recipe
    },

    /** Keep only the most recent N cached searches */
    _trimCache() {
      const keys = Object.keys(this.cachedResults)
      if (keys.length > MAX_CACHED_SEARCHES) {
        // Remove oldest entries (first keys inserted)
        const toRemove = keys.slice(0, keys.length - MAX_CACHED_SEARCHES)
        for (const k of toRemove) {
          delete this.cachedResults[k]
        }
      }
    }
  },

  persist: true
})
