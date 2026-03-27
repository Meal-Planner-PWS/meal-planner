import { defineStore } from 'pinia'
import axios from 'axios'
import { vetIngredients } from '../utils/ingredientVetting'
import { useSettingsStore } from './settings'

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
    maxReadyTime: null, // null = Any, or 30/45/60
    pendingRecipe: null
  }),

  getters: {
    hasResults: (state) => state.results.length > 0,
    cacheKey: (state) => {
      const base = [...state.ingredients].sort().join(',')
      return state.maxReadyTime ? `${base}|t${state.maxReadyTime}` : base
    },

    /** Sort results: clean+fast → clean+slow → review, then by time asc */
    sortedResults: (state) => {
      return [...state.results].sort((a, b) => {
        const aClean = a._vetStatus === 'clean'
        const bClean = b._vetStatus === 'clean'
        const aFast = (a.readyInMinutes || 999) <= 30
        const bFast = (b.readyInMinutes || 999) <= 30

        // Clean+fast first
        if (aClean && aFast && !(bClean && bFast)) return -1
        if (bClean && bFast && !(aClean && aFast)) return 1
        // Clean before review
        if (aClean && !bClean) return -1
        if (bClean && !aClean) return 1
        // Within same group, sort by time ascending
        return (a.readyInMinutes || 999) - (b.readyInMinutes || 999)
      })
    }
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

    setMaxReadyTime(value) {
      this.maxReadyTime = value
    },

    async fetchRecipes() {
      if (!this.ingredients.length) return

      const key = this.cacheKey
      if (this.cachedResults[key]) {
        this.results = this.cachedResults[key]
        this.error = null
        return
      }

      this.loading = true
      this.error = null

      try {
        const params = {
          ingredients: this.ingredients.join(','),
          number: 12,
          ranking: 1,
          ignorePantry: true,
          apiKey: API_KEY
        }

        const response = await axios.get(`${BASE_URL}/recipes/findByIngredients`, { params })

        // findByIngredients doesn't return readyInMinutes or full ingredients,
        // so fetch bulk info for all result IDs to get time + ingredient details
        const ids = response.data.map((r) => r.id)
        let infoMap = {}

        if (ids.length > 0) {
          try {
            const infoRes = await axios.get(`${BASE_URL}/recipes/informationBulk`, {
              params: { ids: ids.join(','), apiKey: API_KEY }
            })
            for (const info of infoRes.data) {
              infoMap[info.id] = info
            }
          } catch {
            // If bulk info fails, continue without time/vetting data
          }
        }

        // Merge findByIngredients data with info data, add vetting
        const results = response.data.map((r) => {
          const info = infoMap[r.id] || {}
          const fullIngredients = (info.extendedIngredients || []).map(
            (i) => i.original || i.name || ''
          )
          const vetting = vetIngredients(fullIngredients, useSettingsStore().flaggedIngredients)

          return {
            ...r,
            readyInMinutes: info.readyInMinutes || null,
            servings: info.servings || null,
            _vetStatus: vetting.status,
            _vetFlagged: vetting.flagged,
            _fullIngredients: fullIngredients
          }
        })

        // Apply max time filter client-side
        const filtered = this.maxReadyTime
          ? results.filter((r) => !r.readyInMinutes || r.readyInMinutes <= this.maxReadyTime)
          : results

        this.results = filtered
        this.cachedResults[key] = filtered
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
        const detail = response.data

        // Run vetting on the full ingredient list
        const fullIngredients = (detail.extendedIngredients || []).map(
          (i) => i.original || i.name || ''
        )
        const vetting = vetIngredients(fullIngredients, useSettingsStore().flaggedIngredients)
        detail._vetStatus = vetting.status
        detail._vetFlagged = vetting.flagged

        this.recipeDetail = detail
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

    setPendingRecipe(recipe) {
      this.pendingRecipe = recipe
    },

    consumePendingRecipe() {
      const recipe = this.pendingRecipe
      this.pendingRecipe = null
      return recipe
    },

    _trimCache() {
      const keys = Object.keys(this.cachedResults)
      if (keys.length > MAX_CACHED_SEARCHES) {
        const toRemove = keys.slice(0, keys.length - MAX_CACHED_SEARCHES)
        for (const k of toRemove) {
          delete this.cachedResults[k]
        }
      }
    }
  },

  persist: true
})
