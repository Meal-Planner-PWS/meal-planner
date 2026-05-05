<script setup>
import { ref, computed, watch } from 'vue'
import { useMealStore } from '../stores/meals'
import { useSettingsStore } from '../stores/settings'
import MealCard from '../components/library/MealCard.vue'

const mealStore = useMealStore()
const settingsStore = useSettingsStore()

// Persisted UI prefs
const SORT_KEY = 'mp_library_sort'
const CATEGORY_KEY = 'mp_library_category'

const search = ref('')
const activeCategory = ref(localStorage.getItem(CATEGORY_KEY) || 'all')
const favoritesOnly = ref(false)
const sort = ref(localStorage.getItem(SORT_KEY) || 'name_asc')

// Persist on change
watch(sort, (v) => localStorage.setItem(SORT_KEY, v))
watch(activeCategory, (v) => localStorage.setItem(CATEGORY_KEY, v))

const SORT_OPTIONS = [
  { value: 'name_asc', label: 'Name (A–Z)' },
  { value: 'name_desc', label: 'Name (Z–A)' },
  { value: 'recent', label: 'Recently Added' },
  { value: 'prep_asc', label: 'Prep Time' },
  { value: 'fav_first', label: 'Favorites First' }
]

// Categories from settings store, with "All" appended at the end
const categoryChips = computed(() => [
  ...settingsStore.categories,
  { value: 'all', label: 'All' }
])

const meals = computed(() =>
  mealStore.filteredMeals(search.value, activeCategory.value, favoritesOnly.value, sort.value)
)

const hasAnyMeals = computed(() => mealStore.meals.length > 0)
const hasAnyFavorites = computed(() => mealStore.meals.some((m) => m.isFavorite))

function toggleFavoritesFilter() {
  favoritesOnly.value = !favoritesOnly.value
}

function selectCategory(cat) {
  activeCategory.value = cat
}
</script>

<template>
  <div>
    <!-- Sticky header — search, add, filter chips, and sort all stay visible while scrolling -->
    <div class="sticky top-0 z-20 bg-surface px-4 pt-4 pb-2 border-b border-gray-100">
      <div class="flex items-center justify-between mb-3">
        <h1 class="text-2xl font-bold text-gray-800">Recipe Library</h1>
        <router-link
          to="/library/new"
          class="flex items-center gap-1.5 bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm active:scale-95 transition-transform"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Recipe
        </router-link>
      </div>

      <!-- Search + sort row -->
      <div class="flex items-stretch gap-2 mb-2">
        <div class="relative flex-1 min-w-0">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="search"
            type="text"
            placeholder="Search recipes or ingredients..."
            class="w-full pl-10 pr-4 py-3 bg-surface-card rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
          />
        </div>
        <select
          v-model="sort"
          aria-label="Sort recipes"
          class="shrink-0 px-3 py-3 bg-surface-card border border-gray-200 rounded-xl text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
        >
          <option v-for="opt in SORT_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>

      <!-- Filter chips: categories first, then "All", then Favorites -->
      <div class="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <button
          v-for="cat in categoryChips"
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
    </div>

    <!-- Scrollable content -->
    <div class="p-4">
      <p
        v-if="favoritesOnly && hasAnyFavorites"
        class="text-sm italic text-gray-400 mb-3"
      >
        I can't help it. My body craves buttery goodness.
      </p>

      <!-- Recipe Grid -->
      <div v-if="meals.length" class="grid grid-cols-2 gap-3">
        <MealCard v-for="meal in meals" :key="meal.id" :meal="meal" />
      </div>

      <!-- No search results state -->
      <div v-else-if="hasAnyMeals" class="text-center py-12">
        <svg class="w-16 h-16 mx-auto text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <p class="text-gray-400 text-lg font-medium">No recipes match</p>
        <p class="text-sm italic text-gray-400 mt-2">I've heard it both ways.</p>
      </div>

      <!-- Empty state -->
      <div v-else class="text-center py-12">
        <svg class="w-16 h-16 mx-auto text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        <p class="text-gray-400 text-lg font-medium">No recipes yet</p>
        <p class="text-gray-300 text-sm mt-1">Tap "Add Recipe" to get started</p>
        <p class="text-sm italic text-gray-400 mt-3">Are you a fan of delicious flavor?</p>
      </div>
    </div>
  </div>
</template>
