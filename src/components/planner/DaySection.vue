<script setup>
import { computed } from 'vue'
import MealSlot from './MealSlot.vue'

const props = defineProps({
  day: { type: String, required: true },
  slots: { type: Object, required: true },
  isToday: { type: Boolean, default: false },
  swapMode: { type: Boolean, default: false },
  swapSource: { type: Object, default: null }
})

const emit = defineEmits(['pick', 'slot-action', 'swap-target', 'remove-meal'])

const dayLabels = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday'
}

const slotOrder = ['breakfast', 'lunch', 'dinner', 'snack']

const filledCount = computed(() => {
  return slotOrder.filter((s) => {
    const val = props.slots[s]
    return Array.isArray(val) ? val.length > 0 : !!val
  }).length
})

function isSwapSource(slot) {
  return (
    props.swapSource &&
    props.swapSource.day === props.day &&
    props.swapSource.slot === slot
  )
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
      <span
        class="text-xs"
        :class="isToday ? 'text-white/70' : 'text-gray-400'"
      >
        {{ filledCount }}/4 planned
      </span>
    </div>

    <!-- Meal slots -->
    <div class="bg-surface-card p-2 space-y-1.5">
      <MealSlot
        v-for="slot in slotOrder"
        :key="slot"
        :day="day"
        :slot="slot"
        :meal-ids="Array.isArray(slots[slot]) ? slots[slot] : []"
        :swap-mode="swapMode"
        :is-swap-source="isSwapSource(slot)"
        @pick="emit('pick', $event)"
        @slot-action="emit('slot-action', $event)"
        @swap-target="emit('swap-target', $event)"
        @remove-meal="emit('remove-meal', $event)"
      />
    </div>
  </div>
</template>
