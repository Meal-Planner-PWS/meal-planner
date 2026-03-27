<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMealStore } from '../stores/meals'

const route = useRoute()
const router = useRouter()
const mealStore = useMealStore()

const showDeleteConfirm = ref(false)

const meal = computed(() => mealStore.getMealById(route.params.id))

function toggleFavorite() {
  mealStore.toggleFavorite(route.params.id)
}

function confirmDelete() {
  showDeleteConfirm.value = true
}

function deleteMeal() {
  mealStore.deleteMeal(route.params.id)
  router.replace('/library')
}

const categoryColors = {
  breakfast: 'bg-amber-100 text-amber-700',
  lunch: 'bg-sky-100 text-sky-700',
  dinner: 'bg-violet-100 text-violet-700',
  snack: 'bg-emerald-100 text-emerald-700'
}
</script>

<template>
  <div v-if="meal">
    <!-- Photo Header -->
    <div class="relative">
      <div v-if="meal.photo" class="w-full h-56 bg-surface-muted">
        <img :src="meal.photo" :alt="meal.name" class="w-full h-full object-cover" />
      </div>
      <div v-else class="w-full h-32 bg-surface-muted" />

      <!-- Back button -->
      <button
        @click="router.push('/library')"
        class="absolute top-4 left-4 bg-black/30 backdrop-blur-sm text-white rounded-full p-2"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <!-- Favorite button -->
      <button
        @click="toggleFavorite"
        class="absolute top-4 right-4 bg-black/30 backdrop-blur-sm rounded-full p-2"
      >
        <svg class="w-5 h-5" :class="meal.isFavorite ? 'text-amber-400 fill-amber-400' : 'text-white'" viewBox="0 0 24 24" stroke="currentColor" fill="none">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      </button>
    </div>

    <!-- Content -->
    <div class="p-4 -mt-4 relative bg-surface rounded-t-2xl">
      <div class="flex items-start justify-between gap-3 mb-3">
        <h1 class="text-2xl font-bold text-gray-800">{{ meal.name }}</h1>
        <span
          class="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full capitalize"
          :class="categoryColors[meal.category] || 'bg-gray-100 text-gray-600'"
        >
          {{ meal.category }}
        </span>
      </div>

      <!-- Notes -->
      <p v-if="meal.notes" class="text-gray-500 text-sm mb-4">{{ meal.notes }}</p>

      <!-- Ingredients -->
      <div v-if="meal.ingredients.length" class="mb-5">
        <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Ingredients</h2>
        <ul class="space-y-1.5">
          <li
            v-for="(ing, idx) in meal.ingredients"
            :key="idx"
            class="flex items-center gap-2 text-sm text-gray-600"
          >
            <span class="w-1.5 h-1.5 bg-primary-500 rounded-full shrink-0" />
            {{ ing }}
          </li>
        </ul>
      </div>

      <!-- Instructions -->
      <div v-if="meal.instructions" class="mb-5">
        <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Instructions</h2>
        <p class="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{{ meal.instructions }}</p>
      </div>

      <!-- Source URL -->
      <div v-if="meal.sourceUrl" class="mb-5">
        <a
          :href="meal.sourceUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 text-sm text-primary-500 font-medium"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          View Source Recipe
        </a>
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-3 mt-6">
        <router-link
          :to="`/library/${meal.id}/edit`"
          class="flex-1 py-3 bg-primary-500 text-white rounded-xl font-semibold text-center text-sm active:scale-[0.98] transition-transform"
        >
          Edit Meal
        </router-link>
        <button
          @click="confirmDelete"
          class="px-5 py-3 bg-red-50 text-red-500 rounded-xl font-semibold text-sm active:scale-[0.98] transition-transform"
        >
          Delete
        </button>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <div
        v-if="showDeleteConfirm"
        class="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4"
        @click.self="showDeleteConfirm = false"
      >
        <div class="bg-white rounded-2xl w-full max-w-sm p-5 mb-[env(safe-area-inset-bottom)]">
          <h3 class="text-lg font-bold text-gray-800 mb-2">Delete Meal?</h3>
          <p class="text-sm text-gray-500 mb-5">This will permanently remove "{{ meal.name }}" from your library.</p>
          <div class="flex gap-3">
            <button
              @click="showDeleteConfirm = false"
              class="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm"
            >
              Cancel
            </button>
            <button
              @click="deleteMeal"
              class="flex-1 py-3 bg-red-500 text-white rounded-xl font-semibold text-sm"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>

  <!-- Not Found -->
  <div v-else class="p-4 text-center py-12">
    <p class="text-gray-400 text-lg">Meal not found</p>
    <router-link to="/library" class="text-primary-500 text-sm mt-2 inline-block">Back to Library</router-link>
  </div>
</template>
