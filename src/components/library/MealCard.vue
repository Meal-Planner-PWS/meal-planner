<script setup>
import { useMealStore } from '../../stores/meals'

const props = defineProps({
  meal: { type: Object, required: true }
})

const mealStore = useMealStore()

function toggleFavorite(e) {
  e.preventDefault()
  e.stopPropagation()
  mealStore.toggleFavorite(props.meal.id)
}

const categoryColors = {
  breakfast: 'bg-amber-100 text-amber-700',
  lunch: 'bg-sky-100 text-sky-700',
  dinner: 'bg-violet-100 text-violet-700',
  snack: 'bg-emerald-100 text-emerald-700'
}
</script>

<template>
  <router-link
    :to="`/library/${meal.id}`"
    class="block bg-surface-card rounded-xl shadow-sm overflow-hidden active:scale-[0.98] transition-transform"
  >
    <!-- Photo -->
    <div class="aspect-[4/3] bg-surface-muted overflow-hidden">
      <img
        v-if="meal.photo"
        :src="meal.photo"
        :alt="meal.name"
        class="w-full h-full object-cover"
      />
      <div v-else class="w-full h-full flex items-center justify-center text-gray-300">
        <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    </div>

    <!-- Content -->
    <div class="p-3">
      <div class="flex items-start justify-between gap-2">
        <h3 class="font-semibold text-gray-800 text-sm leading-tight line-clamp-2">{{ meal.name }}</h3>
        <button
          @click="toggleFavorite"
          class="shrink-0 p-1 -m-1"
          :aria-label="meal.isFavorite ? 'Remove from favorites' : 'Add to favorites'"
        >
          <svg class="w-5 h-5" :class="meal.isFavorite ? 'text-amber-400 fill-amber-400' : 'text-gray-300'" viewBox="0 0 24 24" stroke="currentColor" fill="none">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </button>
      </div>
      <span
        class="inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full capitalize"
        :class="categoryColors[meal.category] || 'bg-gray-100 text-gray-600'"
      >
        {{ meal.category }}
      </span>
    </div>
  </router-link>
</template>
