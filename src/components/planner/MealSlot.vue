<script setup>
import { computed } from 'vue'
import { useMealStore } from '../../stores/meals'
import { useSettingsStore } from '../../stores/settings'

const props = defineProps({
  day: { type: String, required: true },
  slot: { type: String, required: true },
  /** MealEntry | null — { text, recipeIds, helperIds, prepTasks } */
  entry: { type: Object, default: null },
  swapMode: { type: Boolean, default: false },
  isSwapSource: { type: Boolean, default: false },
  /** When this slot is a valid drop target during a drag */
  isDropTarget: { type: Boolean, default: false },
  isDragSource: { type: Boolean, default: false }
})

const emit = defineEmits(['edit', 'slot-action', 'swap-target', 'clear', 'drag-start'])

const mealStore = useMealStore()
const settingsStore = useSettingsStore()

const isEmpty = computed(() => !props.entry || (!props.entry.text?.trim() && (!props.entry.recipeIds || props.entry.recipeIds.length === 0)))

const linkedRecipes = computed(() => {
  const ids = props.entry?.recipeIds || []
  return ids.map((id) => mealStore.getMealById(id)).filter(Boolean)
})

const linkedHelpers = computed(() => {
  const ids = props.entry?.helperIds || []
  return ids.map((id) => settingsStore.helpers.find((h) => h.id === id)).filter(Boolean)
})

/** Display name: explicit text wins; otherwise fall back to joined recipe names. */
const displayText = computed(() => {
  if (props.entry?.text?.trim()) return props.entry.text.trim()
  return linkedRecipes.value.map((r) => r.name).join(' + ')
})

const slotInitial = { breakfast: 'B', lunch: 'L', dinner: 'D' }

function handleTap() {
  if (props.swapMode) {
    if (!props.isSwapSource) emit('swap-target', { day: props.day, slot: props.slot })
    return
  }
  emit('edit', { day: props.day, slot: props.slot })
}

function handleSlotAction(e) {
  e.stopPropagation()
  if (props.swapMode || isEmpty.value) return
  emit('slot-action', { day: props.day, slot: props.slot })
}

function handleClear(e) {
  e.stopPropagation()
  emit('clear', { day: props.day, slot: props.slot })
}

function handlePointerDown(e) {
  if (props.swapMode || isEmpty.value) return
  emit('drag-start', { day: props.day, slot: props.slot, pointerEvent: e })
}
</script>

<template>
  <div
    @click="handleTap"
    @pointerdown="handlePointerDown"
    :data-drop-day="day"
    :data-drop-slot="slot"
    class="w-full text-left rounded-xl px-3 py-2.5 transition-all duration-150 cursor-pointer select-none"
    :class="[
      isSwapSource || isDragSource
        ? 'bg-primary-100 border-2 border-primary-500 ring-2 ring-primary-500/20 opacity-60'
        : isDropTarget
          ? 'bg-emerald-50 border-2 border-dashed border-emerald-400'
          : swapMode
            ? 'bg-amber-50 border-2 border-dashed border-amber-400'
            : isEmpty
              ? 'bg-surface-muted border border-dashed border-gray-300 active:scale-[0.98]'
              : 'bg-surface-card border border-gray-100 active:scale-[0.98]'
    ]"
    :style="{ touchAction: 'manipulation' }"
  >
    <!-- Empty state — small subtle "+ B/L/D" -->
    <div v-if="isEmpty" class="flex items-center gap-2 min-h-9">
      <span class="text-[11px] font-bold text-gray-400 w-5">{{ slotInitial[slot] }}</span>
      <svg v-if="!swapMode" class="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
      <span class="text-sm text-gray-300">
        {{ swapMode ? 'Tap to swap here' : 'Add meal' }}
      </span>
    </div>

    <!-- Filled state — meal text is the dominant element -->
    <div v-else class="flex items-start gap-2.5">
      <!-- Left rail: B/L/D label only — meal codes are managed in Settings
           and intentionally not rendered on the slot itself -->
      <div class="flex flex-col items-center shrink-0 pt-0.5 w-5">
        <span class="text-[10px] font-bold uppercase tracking-wider text-gray-400">{{ slotInitial[slot] }}</span>
      </div>

      <!-- Main: meal text large + helper dots + linked recipe chips -->
      <div class="flex-1 min-w-0">
        <div class="flex items-start gap-1.5">
          <p class="text-base font-semibold text-gray-800 leading-tight break-words flex-1 min-w-0">{{ displayText }}</p>
          <!-- Helper color dots — stacked tight on the right of the meal text -->
          <div v-if="linkedHelpers.length" class="flex -space-x-1 shrink-0 pt-1">
            <span
              v-for="h in linkedHelpers"
              :key="h.id"
              class="w-3.5 h-3.5 rounded-full ring-2 ring-white shadow-sm"
              :style="{ backgroundColor: h.color }"
            />
          </div>
        </div>
        <div v-if="linkedRecipes.length && entry.text?.trim()" class="flex flex-wrap gap-1 mt-1.5">
          <span
            v-for="r in linkedRecipes"
            :key="r.id"
            class="inline-flex items-center gap-1 text-[10px] bg-primary-50 text-primary-700 px-1.5 py-0.5 rounded-full max-w-full"
          >
            <svg class="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <span class="truncate">{{ r.name }}</span>
          </span>
        </div>
      </div>

      <!-- Action rail: clear + options -->
      <div v-if="!swapMode" class="flex items-center gap-1 shrink-0">
        <button
          @click="handleClear"
          class="w-9 h-9 flex items-center justify-center rounded-lg text-gray-300 active:text-red-400 active:bg-red-50"
          aria-label="Clear meal"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <button
          @click="handleSlotAction"
          class="w-9 h-9 flex items-center justify-center rounded-lg text-gray-300 active:text-gray-500 active:bg-gray-100"
          aria-label="Slot options"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
      </div>

      <!-- Swap mode target indicator -->
      <svg
        v-if="swapMode && !isSwapSource"
        class="w-5 h-5 text-amber-400 shrink-0 self-center"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    </div>
  </div>
</template>
