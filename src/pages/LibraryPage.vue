<script setup>
import { ref, computed } from 'vue'
import { useMealStore } from '../stores/meals'
import MealCard from '../components/library/MealCard.vue'

const mealStore = useMealStore()

const search = ref('')
const activeCategory = ref('all')
const favoritesOnly = ref(false)

const categories = [
  { value: 'all', label: 'All' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' }
]

const meals = computed(() => {
  return mealStore.filteredMeals(search.value, activeCategory.value, favoritesOnly.value)
})

function toggleFavoritesFilter() {
  favoritesOnly.value = !favoritesOnly.value
}

function selectCategory(cat) {
  activeCategory.value = cat
}
</script>

<template>
  <div class="p-4">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-gray-800">Meal Library</h1>
      <router-link
        to="/library/new"
        class="flex items-center gap-1.5 bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm active:scale-95 transition-transform"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Add Meal
      </router-link>
    </div>

    <!-- Search -->
    <div class="relative mb-3">
      <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        v-model="search"
        type="text"
        placeholder="Search meals or ingredients..."
        class="w-full pl-10 pr-4 py-3 bg-surface-card rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
      />
    </div>

    <!-- Filters -->
    <div class="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
      <button
        v-for="cat in categories"
        :key="cat.value"
        @click="selectCategory(cat.value)"
        class="shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors"
        :class="activeCategory === cat.value
          ? 'bg-primary-500 text-white'
          : 'bg-surface-card text-gray-600 border border-gray-200'"
      >
        {{ cat.label }}
      </button>
      <button
        @click="toggleFavoritesFilter"
        class="shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-1"
        :class="favoritesOnly
          ? 'bg-amber-400 text-white'
          : 'bg-surface-card text-gray-600 border border-gray-200'"
      >
        <svg class="w-4 h-4" :class="favoritesOnly ? 'fill-white' : 'fill-gray-400'" viewBox="0 0 24 24">
          <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
        Favorites
      </button>
    </div>

    <!-- Meal Grid -->
    <div v-if="meals.length" class="grid grid-cols-2 gap-3">
      <MealCard v-for="meal in meals" :key="meal.id" :meal="meal" />
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-12">
      <svg class="w-16 h-16 mx-auto text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
      <p class="text-gray-400 text-lg font-medium">No meals yet</p>
      <p class="text-gray-300 text-sm mt-1">Tap "Add Meal" to get started</p>
    </div>
  </div>
</template>
