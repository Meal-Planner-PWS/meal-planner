<script setup>
import { ref, computed } from 'vue'
import { useIdeasStore } from '../stores/ideas'
import IngredientInput from '../components/ideas/IngredientInput.vue'
import RecipeResultCard from '../components/ideas/RecipeResultCard.vue'
import RecipeDetailOverlay from '../components/ideas/RecipeDetailOverlay.vue'
import MealCodeSettings from '../components/planner/MealCodeSettings.vue'

const ideasStore = useIdeasStore()

const showDetail = ref(false)
const showSettings = ref(false)
const searchDone = ref(false)

const canSearch = computed(() => ideasStore.ingredients.length > 0)

const showingCached = computed(() => {
  if (!ideasStore.hasResults) return false
  const currentKey = ideasStore.cacheKey
  const cachedForCurrent = ideasStore.cachedResults[currentKey]
  return !cachedForCurrent && ideasStore.results.length > 0
})

const timeOptions = [
  { value: null, label: 'Any' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '60 min' }
]

function setTime(value) {
  ideasStore.setMaxReadyTime(value)
}

function handleAdd(ingredient) {
  ideasStore.addIngredient(ingredient)
}

function handleRemove(ingredient) {
  ideasStore.removeIngredient(ingredient)
}

function handleClear() {
  ideasStore.clearIngredients()
}

async function search() {
  if (!canSearch.value) return
  await ideasStore.fetchRecipes()
  searchDone.value = true
}

async function openDetail(recipeId) {
  showDetail.value = true
  await ideasStore.fetchRecipeDetail(recipeId)
}

function closeDetail() {
  showDetail.value = false
  ideasStore.clearRecipeDetail()
}
</script>

<template>
  <div class="p-4">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-gray-800">New Ideas</h1>
      <button
        @click="showSettings = true"
        class="p-2 text-gray-400 active:text-primary-500"
        title="Ingredient settings"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>

    <!-- Max prep time filter -->
    <div class="mb-3">
      <label class="block text-xs font-medium text-gray-500 mb-1.5">Max prep time</label>
      <div class="flex gap-2">
        <button
          v-for="opt in timeOptions"
          :key="opt.label"
          @click="setTime(opt.value)"
          class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
          :class="ideasStore.maxReadyTime === opt.value
            ? 'bg-primary-500 text-white'
            : 'bg-surface-card text-gray-600 border border-gray-200'"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- Ingredient input -->
    <IngredientInput
      :ingredients="ideasStore.ingredients"
      @add="handleAdd"
      @remove="handleRemove"
      @clear="handleClear"
    />

    <!-- Search button -->
    <button
      @click="search"
      :disabled="!canSearch || ideasStore.loading"
      class="w-full mt-4 py-3.5 bg-primary-500 text-white rounded-xl font-semibold text-sm shadow-sm active:scale-[0.98] transition-transform disabled:opacity-40 disabled:active:scale-100"
    >
      <span v-if="ideasStore.loading" class="flex items-center justify-center gap-2">
        <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        Searching...
      </span>
      <span v-else>Find Recipes</span>
    </button>

    <!-- Error state -->
    <div
      v-if="ideasStore.error"
      class="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
    >
      <p class="text-sm text-red-600">{{ ideasStore.error }}</p>
    </div>

    <!-- Cached results notice -->
    <div
      v-if="showingCached && !ideasStore.loading"
      class="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2"
    >
      <svg class="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p class="text-xs text-amber-600">Showing results from your last search</p>
    </div>

    <!-- Results — use sorted order -->
    <div v-if="ideasStore.hasResults && !ideasStore.loading" class="mt-5">
      <p class="text-xs italic text-gray-400 mb-1">
        Well, the plot, unlike your hair, continues to thicken.
      </p>
      <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        {{ ideasStore.sortedResults.length }} recipes found
      </h2>
      <div class="grid grid-cols-2 gap-3">
        <RecipeResultCard
          v-for="recipe in ideasStore.sortedResults"
          :key="recipe.id"
          :recipe="recipe"
          :total-ingredients="ideasStore.ingredients.length"
          @tap="openDetail"
        />
      </div>
    </div>

    <!-- Zero results state -->
    <div
      v-else-if="searchDone && !ideasStore.hasResults && !ideasStore.loading && !ideasStore.error"
      class="mt-5 text-center py-8"
    >
      <svg class="w-12 h-12 mx-auto text-gray-200 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p class="text-gray-400 text-sm font-medium">No recipes found for those ingredients</p>
      <p class="text-gray-300 text-xs mt-1">Try adding more common ingredients or different combinations</p>
      <p class="text-sm italic text-gray-400 mt-3">I can't help it. My body craves buttery goodness.</p>
    </div>

    <!-- Empty state (no search yet) -->
    <div
      v-else-if="!ideasStore.loading && !ideasStore.error && !ideasStore.hasResults"
      class="text-center py-12"
    >
      <svg class="w-16 h-16 mx-auto text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
      <p class="text-gray-400 text-lg font-medium">What's in your kitchen?</p>
      <p class="text-gray-300 text-sm mt-1">Add ingredients above to discover recipes</p>
      <p class="text-sm italic text-gray-400 mt-3">Are you a fan of delicious flavor?</p>
    </div>

    <!-- Loading skeleton -->
    <div v-if="ideasStore.loading" class="mt-5 grid grid-cols-2 gap-3">
      <div v-for="n in 4" :key="n" class="bg-surface-card rounded-xl shadow-sm overflow-hidden animate-pulse">
        <div class="aspect-16/10 bg-surface-muted" />
        <div class="p-3 space-y-2">
          <div class="h-4 bg-surface-muted rounded w-3/4" />
          <div class="h-3 bg-surface-muted rounded w-1/2" />
        </div>
      </div>
    </div>
  </div>

  <!-- Recipe Detail Overlay -->
  <RecipeDetailOverlay
    v-if="showDetail"
    @close="closeDetail"
  />

  <!-- Settings panel — defaults to Ingredients tab -->
  <MealCodeSettings
    v-if="showSettings"
    default-tab="ingredients"
    @close="showSettings = false"
  />
</template>
