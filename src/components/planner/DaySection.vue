<script setup>
import { computed, ref, watch } from 'vue'
import MealSlot from './MealSlot.vue'
import { usePlannerStore } from '../../stores/planner'

const plannerStore = usePlannerStore()

const props = defineProps({
  day: { type: String, required: true },
  /** Day data: { breakfast, lunch, dinner, notes } — slot values are MealEntry|null */
  dayData: { type: Object, required: true },
  isToday: { type: Boolean, default: false },
  swapMode: { type: Boolean, default: false },
  swapSource: { type: Object, default: null },
  /** Drag state passed from parent */
  dragSource: { type: Object, default: null },
  dropTarget: { type: Object, default: null }
})

const emit = defineEmits([
  'edit', 'slot-action', 'swap-target', 'clear', 'drag-start', 'notes-update'
])

const dayLabels = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday'
}

// Breakfast is hidden when empty unless the user has explicitly enabled it for this day
const breakfastEnabled = ref(false)

// Show breakfast row whenever it's filled OR the user toggled it on
const showBreakfast = computed(() => {
  const b = props.dayData.breakfast
  const hasContent = !!b && (b.text?.trim() || (b.recipeIds && b.recipeIds.length > 0))
  return hasContent || breakfastEnabled.value
})

// Auto-collapse breakfast back to "+ breakfast" when cleared, unless user is mid-add
watch(() => props.dayData.breakfast, (newVal) => {
  const hasContent = !!newVal && (newVal.text?.trim() || (newVal.recipeIds && newVal.recipeIds.length > 0))
  if (!hasContent) breakfastEnabled.value = false
})

const slotOrder = ['breakfast', 'lunch', 'dinner']

const filledCount = computed(() => {
  return slotOrder.filter((s) => {
    const v = props.dayData[s]
    return !!v && (v.text?.trim() || (v.recipeIds && v.recipeIds.length > 0))
  }).length
})

function isSwapSource(slot) {
  return props.swapSource?.day === props.day && props.swapSource?.slot === slot
}

function isDropTarget(slot) {
  return props.dropTarget?.day === props.day && props.dropTarget?.slot === slot
}

function isDragSource(slot) {
  return props.dragSource?.day === props.day && props.dragSource?.slot === slot
}

// Prep tasks across the week that are due TODAY (this day card)
const prepDueToday = computed(() => plannerStore.prepTasksByDay(props.day))

function togglePrepDone(item) {
  plannerStore.togglePrepTask(item.ownerDay, item.task.id)
}

const localNotes = ref(props.dayData.notes || '')
watch(() => props.dayData.notes, (val) => {
  if (val !== localNotes.value) localNotes.value = val || ''
})

function commitNotes() {
  if (localNotes.value !== (props.dayData.notes || '')) {
    emit('notes-update', { day: props.day, notes: localNotes.value })
  }
}
</script>

<template>
  <div
    :id="`day-${day}`"
    class="rounded-2xl overflow-hidden"
    :class="isToday ? 'ring-2 ring-primary-500/30' : ''"
  >
    <!-- Day header -->
    <div
      class="flex items-center justify-between px-4 py-2.5"
      :class="isToday ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-700'"
    >
      <div class="flex items-center gap-2">
        <span class="font-bold text-sm">{{ dayLabels[day] }}</span>
        <span
          v-if="isToday"
          class="text-[10px] font-semibold uppercase tracking-wider bg-white/20 px-1.5 py-0.5 rounded-full"
        >
          Today
        </span>
      </div>
      <span class="text-xs" :class="isToday ? 'text-white/70' : 'text-gray-400'">
        {{ filledCount }}/3 planned
      </span>
    </div>

    <!-- Prep tasks due today (drawn from any meal in the week) -->
    <div v-if="prepDueToday.length" class="bg-amber-50 border-x border-amber-100 px-3 py-2 space-y-1">
      <div class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        Prep
      </div>
      <button
        v-for="item in prepDueToday"
        :key="item.task.id"
        @click="togglePrepDone(item)"
        class="w-full flex items-center gap-2 text-left active:opacity-70"
      >
        <span
          class="w-4 h-4 rounded border shrink-0 flex items-center justify-center"
          :class="item.task.done ? 'bg-amber-500 border-amber-500' : 'bg-white border-amber-300'"
        >
          <svg v-if="item.task.done" class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <span
          class="text-xs flex-1 min-w-0 truncate"
          :class="item.task.done ? 'line-through text-amber-400' : 'text-amber-800'"
        >
          {{ item.task.text }}
        </span>
      </button>
    </div>

    <!-- Meal slots -->
    <div class="bg-surface-card p-2 space-y-1.5">
      <!-- Breakfast (optional, hidden when empty unless toggled) -->
      <button
        v-if="!showBreakfast && !swapMode"
        @click="breakfastEnabled = true"
        class="w-full text-left text-xs text-gray-400 italic px-3 py-1.5 rounded-lg active:bg-gray-50"
      >
        + breakfast
      </button>
      <MealSlot
        v-if="showBreakfast"
        :day="day"
        :slot="'breakfast'"
        :entry="dayData.breakfast"
        :swap-mode="swapMode"
        :is-swap-source="isSwapSource('breakfast')"
        :is-drop-target="isDropTarget('breakfast')"
        :is-drag-source="isDragSource('breakfast')"
        @edit="emit('edit', $event)"
        @slot-action="emit('slot-action', $event)"
        @swap-target="emit('swap-target', $event)"
        @clear="emit('clear', $event)"
        @drag-start="emit('drag-start', $event)"
      />

      <!-- Lunch (always visible) -->
      <MealSlot
        :day="day"
        :slot="'lunch'"
        :entry="dayData.lunch"
        :swap-mode="swapMode"
        :is-swap-source="isSwapSource('lunch')"
        :is-drop-target="isDropTarget('lunch')"
        :is-drag-source="isDragSource('lunch')"
        @edit="emit('edit', $event)"
        @slot-action="emit('slot-action', $event)"
        @swap-target="emit('swap-target', $event)"
        @clear="emit('clear', $event)"
        @drag-start="emit('drag-start', $event)"
      />

      <!-- Dinner (always visible) -->
      <MealSlot
        :day="day"
        :slot="'dinner'"
        :entry="dayData.dinner"
        :swap-mode="swapMode"
        :is-swap-source="isSwapSource('dinner')"
        :is-drop-target="isDropTarget('dinner')"
        :is-drag-source="isDragSource('dinner')"
        @edit="emit('edit', $event)"
        @slot-action="emit('slot-action', $event)"
        @swap-target="emit('swap-target', $event)"
        @clear="emit('clear', $event)"
        @drag-start="emit('drag-start', $event)"
      />

      <!-- Day notes — single-line input that lets you tap to expand -->
      <textarea
        v-model="localNotes"
        rows="1"
        placeholder=""
        class="w-full mt-1 px-3 py-1.5 bg-transparent border-0 border-t border-gray-100 text-xs text-gray-500 placeholder-gray-300 focus:outline-none focus:bg-amber-50/30 resize-none"
        @blur="commitNotes"
      />
    </div>
  </div>
</template>
