<script setup>
import { computed } from 'vue'

const props = defineProps({
  recipe: { type: Object, required: true },
  totalIngredients: { type: Number, required: true }
})

const emit = defineEmits(['tap'])

const usedCount = computed(() => props.recipe.usedIngredientCount || 0)
const missedIngredients = computed(() => {
  return (props.recipe.missedIngredients || []).map((i) => i.name)
})

const isClean = computed(() => props.recipe._vetStatus === 'clean')
const isReview = computed(() => props.recipe._vetStatus === 'review')

const prepTime = computed(() => props.recipe.readyInMinutes)
const prepTimeColor = computed(() => {
  if (!prepTime.value) return ''
  if (prepTime.value <= 30) return 'bg-emerald-100 text-emerald-700'
  if (prepTime.value <= 60) return 'bg-amber-100 text-amber-700'
  return 'bg-gray-100 text-gray-500'
})
</script>

<template>
  <button
    @click="emit('tap', recipe.id)"
    class="w-full bg-surface-card rounded-xl shadow-sm overflow-hidden text-left active:scale-[0.98] transition-transform"
  >
    <!-- Image -->
    <div class="aspect-16/10 bg-surface-muted overflow-hidden relative">
      <img
        v-if="recipe.image"
        :src="recipe.image"
        :alt="recipe.title"
        class="w-full h-full object-cover"
        loading="lazy"
        width="312"
        height="195"
      />
      <div v-else class="w-full h-full flex items-center justify-center text-gray-300">
        <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>

      <!-- Badges row — top right of image -->
      <div class="absolute top-2 right-2 flex gap-1">
        <!-- Prep time badge -->
        <span
          v-if="prepTime"
          class="text-[10px] font-semibold px-1.5 py-0.5 rounded-md backdrop-blur-sm"
          :class="prepTimeColor"
        >
          {{ prepTime }}m
        </span>

        <!-- Vet badge -->
        <span
          v-if="isClean"
          class="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 backdrop-blur-sm"
        >
          Clean
        </span>
        <span
          v-else-if="isReview"
          class="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 backdrop-blur-sm"
        >
          Review
        </span>
      </div>
    </div>

    <!-- Content -->
    <div class="p-3">
      <h3 class="font-semibold text-gray-800 text-sm leading-tight line-clamp-2 mb-1.5">
        {{ recipe.title }}
      </h3>

      <!-- Match indicator -->
      <div class="flex items-center gap-1.5 mb-1">
        <div class="flex gap-0.5">
          <span
            v-for="n in totalIngredients"
            :key="n"
            class="w-1.5 h-1.5 rounded-full"
            :class="n <= usedCount ? 'bg-primary-500' : 'bg-gray-200'"
          />
        </div>
        <span class="text-xs text-gray-500">
          Uses {{ usedCount }} of {{ totalIngredients }}
        </span>
      </div>

      <!-- Missing ingredients -->
      <p v-if="missedIngredients.length" class="text-xs text-gray-400 line-clamp-1">
        Missing: {{ missedIngredients.join(', ') }}
      </p>
    </div>
  </button>
</template>
