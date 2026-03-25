<script setup>
import { computed } from 'vue'
import { useMealStore } from '../../stores/meals'

const props = defineProps({
  day: { type: String, required: true },
  slot: { type: String, required: true },
  mealIds: { type: Array, default: () => [] },
  swapMode: { type: Boolean, default: false },
  isSwapSource: { type: Boolean, default: false }
})

const emit = defineEmits(['pick', 'slot-action', 'swap-target', 'remove-meal'])

const mealStore = useMealStore()

const meals = computed(() => {
  return props.mealIds
    .map((id) => mealStore.getMealById(id))
    .filter(Boolean)
})

const isEmpty = computed(() => meals.value.length === 0)

const slotLabels = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack'
}

const categoryDotColors = {
  breakfast: 'bg-amber-400',
  lunch: 'bg-sky-400',
  dinner: 'bg-violet-400',
  snack: 'bg-emerald-400'
}

function handleTap() {
  if (props.swapMode) {
    if (!props.isSwapSource) {
      emit('swap-target', { day: props.day, slot: props.slot })
    }
    return
  }

  emit('pick', { day: props.day, slot: props.slot })
}

function handleSlotAction(e) {
  e.stopPropagation()
  if (props.swapMode || isEmpty.value) return
  emit('slot-action', { day: props.day, slot: props.slot })
}

function handleRemoveMeal(e, mealId) {
  e.stopPropagation()
  emit('remove-meal', { day: props.day, slot: props.slot, mealId })
}
</script>

<template>
  <div
    @click="handleTap"
    class="w-full text-left rounded-xl px-3 py-2.5 transition-all duration-150 cursor-pointer"
    :class="[
      isSwapSource
        ? 'bg-primary-100 border-2 border-primary-500 ring-2 ring-primary-500/20'
        : swapMode
          ? 'bg-amber-50 border-2 border-dashed border-amber-400 hover:bg-amber-100'
          : isEmpty
            ? 'bg-surface-muted border border-dashed border-gray-300 active:scale-[0.98]'
            : 'bg-surface-card border border-gray-100 active:scale-[0.98]'
    ]"
  >
    <div class="flex gap-4 min-h-9">
      <!-- Slot label -->
      <span
        class="text-[11px] font-semibold uppercase tracking-wider w-18 shrink-0 pt-1"
        :class="swapMode && !isSwapSource ? 'text-amber-500' : 'text-gray-400'"
      >
        {{ slotLabels[slot] }}
      </span>

      <!-- Empty slot -->
      <div v-if="isEmpty" class="flex items-center gap-2">
        <svg
          v-if="!swapMode"
          class="w-4 h-4 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        <span class="text-sm text-gray-300">
          {{ swapMode ? 'Tap to swap here' : 'Add meal' }}
        </span>
      </div>

      <!-- Filled slot: single meal -->
      <div v-else-if="meals.length === 1" class="flex items-center flex-1 min-w-0">
        <span
          class="w-2 h-2 rounded-full shrink-0"
          :class="categoryDotColors[meals[0].category] || 'bg-gray-300'"
        />
        <span class="text-sm text-gray-700 font-medium truncate flex-1 ml-2">{{ meals[0].name }}</span>

        <!-- Action buttons — 44px targets with 8px gap -->
        <div v-if="!swapMode" class="flex items-center gap-2 shrink-0 ml-2">
          <button
            @click="(e) => handleRemoveMeal(e, mealIds[0])"
            class="w-11 h-11 flex items-center justify-center rounded-lg text-gray-300 active:text-red-400 active:bg-red-50"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button
            @click="handleSlotAction"
            class="w-11 h-11 flex items-center justify-center rounded-lg text-gray-300 active:text-gray-500 active:bg-gray-100"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Filled slot: multiple meals — stacked list -->
      <div v-else class="flex-1 min-w-0">
        <!-- Each meal row: 44px tall touch target for the × -->
        <div class="space-y-0.5">
          <div
            v-for="(meal, idx) in meals"
            :key="mealIds[idx]"
            class="flex items-center min-h-11"
          >
            <span
              class="w-1.5 h-1.5 rounded-full shrink-0"
              :class="categoryDotColors[meal.category] || 'bg-gray-300'"
            />
            <span class="text-[13px] text-gray-700 font-medium truncate flex-1 ml-2">{{ meal.name }}</span>
            <button
              v-if="!swapMode"
              @click="(e) => handleRemoveMeal(e, mealIds[idx])"
              class="w-11 h-11 flex items-center justify-center rounded-lg text-gray-300 active:text-red-400 active:bg-red-50 shrink-0 ml-1"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Slot-level options — separated from meal rows with border -->
        <div v-if="!swapMode" class="flex justify-end border-t border-gray-100 mt-1 pt-1">
          <button
            @click="handleSlotAction"
            class="h-11 px-3 flex items-center gap-1.5 rounded-lg text-gray-400 active:text-gray-600 active:bg-gray-100 text-xs font-medium"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
            Options
          </button>
        </div>
      </div>

      <!-- Swap mode target indicator -->
      <svg
        v-if="swapMode && !isSwapSource"
        class="w-5 h-5 text-amber-400 ml-auto shrink-0 self-center"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    </div>
  </div>
</template>
