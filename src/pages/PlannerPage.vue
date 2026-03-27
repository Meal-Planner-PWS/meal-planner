<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { usePlannerStore } from '../stores/planner'
import { useMealStore } from '../stores/meals'
import DaySection from '../components/planner/DaySection.vue'
import MealPicker from '../components/planner/MealPicker.vue'
import MealCodeSettings from '../components/planner/MealCodeSettings.vue'

const plannerStore = usePlannerStore()
const mealStore = useMealStore()

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

// --- Week navigation ---

const weekLabel = computed(() => {
  const start = new Date(plannerStore.currentWeekStart + 'T00:00:00')
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const sMonth = start.toLocaleString('default', { month: 'short' })
  const eMonth = end.toLocaleString('default', { month: 'short' })
  if (sMonth === eMonth) {
    return `${sMonth} ${start.getDate()}–${end.getDate()}`
  }
  return `${sMonth} ${start.getDate()} – ${eMonth} ${end.getDate()}`
})

function todayDayKey() {
  const dayIndex = new Date().getDay()
  const mapped = dayIndex === 0 ? 6 : dayIndex - 1
  return DAYS[mapped]
}

const isCurrentWeek = computed(() => {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
  const thisMonday = new Date(now)
  thisMonday.setDate(diff)
  return plannerStore.currentWeekStart === thisMonday.toISOString().split('T')[0]
})

function isToday(dayKey) {
  return isCurrentWeek.value && dayKey === todayDayKey()
}

// --- Meal picker ---

const showPicker = ref(false)
const pickerTarget = ref({ day: '', slot: '' })

function openPicker({ day, slot }) {
  pickerTarget.value = { day, slot }
  showPicker.value = true
}

// --- Inline remove from MealSlot × button ---

function onRemoveMeal({ day, slot, mealId }) {
  plannerStore.removeMealFromSlot(day, slot, mealId)
}

// --- Slot action sheet (filled slot options) ---

const showActions = ref(false)
const actionTarget = ref({ day: '', slot: '' })

function openSlotAction({ day, slot }) {
  actionTarget.value = { day, slot }
  showActions.value = true
}

const actionSlotMeals = computed(() => {
  const daySlots = plannerStore.currentWeek.days[actionTarget.value.day]
  if (!daySlots) return []
  const ids = daySlots[actionTarget.value.slot] || []
  return ids.map((id) => mealStore.getMealById(id)).filter(Boolean)
})

const actionSlotSummary = computed(() => {
  const names = actionSlotMeals.value.map((m) => m.name)
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  return `${names.length} meals`
})

function clearSlot() {
  plannerStore.clearSlot(actionTarget.value.day, actionTarget.value.slot)
  showActions.value = false
}

// --- Swap mode ---

const swapMode = ref(false)
const swapSource = ref(null)

function enterSwapMode() {
  showActions.value = false
  swapMode.value = true
  swapSource.value = { day: actionTarget.value.day, slot: actionTarget.value.slot }
}

function onSwapTarget({ day, slot }) {
  if (!swapSource.value) return
  plannerStore.swapSlots(swapSource.value.day, swapSource.value.slot, day, slot)
  exitSwapMode()
}

function exitSwapMode() {
  swapMode.value = false
  swapSource.value = null
}

// --- Copy / Clear week ---

const showSettings = ref(false)
const showCopyConfirm = ref(false)
const showClearConfirm = ref(false)

function confirmCopyWeek() {
  plannerStore.copyToNextWeek()
  showCopyConfirm.value = false
}

function confirmClearWeek() {
  plannerStore.clearWeek()
  showClearConfirm.value = false
}

// --- Auto-scroll to today ---

onMounted(async () => {
  if (!isCurrentWeek.value) return
  await nextTick()
  const todayEl = document.getElementById(`day-${todayDayKey()}`)
  if (todayEl) {
    todayEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
})

watch(() => plannerStore.currentWeekStart, async (val) => {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
  const thisMonday = new Date(now)
  thisMonday.setDate(diff)
  if (val === thisMonday.toISOString().split('T')[0]) {
    await nextTick()
    const todayEl = document.getElementById(`day-${todayDayKey()}`)
    if (todayEl) {
      todayEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }
})
</script>

<template>
  <div class="p-4" @click="swapMode && exitSwapMode()">
    <!-- Header -->
    <div class="flex items-center justify-between mb-1" @click.stop>
      <h1 class="text-2xl font-bold text-gray-800">Planner</h1>
      <div class="flex items-center gap-1">
        <button
          @click="showSettings = true"
          class="p-2 text-gray-400 active:text-primary-500"
          title="Meal code settings"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        <button
          @click="showCopyConfirm = true"
          class="p-2 text-gray-400 active:text-primary-500"
          title="Copy to next week"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
        <button
          @click="showClearConfirm = true"
          class="p-2 text-gray-400 active:text-red-500"
          title="Clear week"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Week navigation -->
    <div class="flex items-center justify-between mb-4" @click.stop>
      <button
        @click="plannerStore.navigateWeek(-1)"
        class="p-2 -m-2 text-gray-500 active:text-primary-500"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <span class="text-sm font-semibold text-gray-600">{{ weekLabel }}</span>
      <button
        @click="plannerStore.navigateWeek(1)"
        class="p-2 -m-2 text-gray-500 active:text-primary-500"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <!-- Swap mode banner -->
    <div
      v-if="swapMode"
      class="mb-3 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-center justify-between"
      @click.stop
    >
      <div>
        <p class="text-sm font-semibold text-amber-700">Swap Mode</p>
        <p class="text-xs text-amber-500">Tap another slot to swap meals</p>
      </div>
      <button
        @click="exitSwapMode"
        class="text-xs font-semibold text-amber-600 bg-amber-100 px-3 py-1.5 rounded-lg"
      >
        Cancel
      </button>
    </div>

    <!-- Day sections -->
    <div class="space-y-3" @click.stop>
      <DaySection
        v-for="day in DAYS"
        :key="day"
        :day="day"
        :slots="plannerStore.currentWeek.days[day]"
        :is-today="isToday(day)"
        :swap-mode="swapMode"
        :swap-source="swapSource"
        @pick="openPicker"
        @slot-action="openSlotAction"
        @swap-target="onSwapTarget"
        @remove-meal="onRemoveMeal"
      />
    </div>
  </div>

  <!-- Meal Code Settings -->
  <MealCodeSettings
    v-if="showSettings"
    default-tab="codes"
    @close="showSettings = false"
  />

  <!-- Meal Picker overlay -->
  <MealPicker
    v-if="showPicker"
    :day="pickerTarget.day"
    :slot="pickerTarget.slot"
    @close="showPicker = false"
  />

  <!-- Slot Action Sheet -->
  <Teleport to="body">
    <div
      v-if="showActions"
      class="fixed inset-0 z-60 flex items-end justify-center bg-black/40"
      @click.self="showActions = false"
    >
      <div class="bg-white rounded-t-2xl w-full max-w-sm pb-[env(safe-area-inset-bottom)] shadow-xl">
        <div class="px-5 pt-5 pb-2">
          <h3 class="text-base font-bold text-gray-800 truncate">{{ actionSlotSummary }}</h3>
          <p class="text-xs text-gray-400 capitalize mt-0.5">
            {{ actionTarget.day }} &middot; {{ actionTarget.slot }}
          </p>
        </div>
        <div class="px-3 pb-4 space-y-1">
          <button
            @click="openPicker({ day: actionTarget.day, slot: actionTarget.slot }); showActions = false"
            class="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left active:bg-gray-50"
          >
            <svg class="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            <div>
              <span class="text-sm font-medium text-gray-700">Add / Remove Meals</span>
              <p class="text-xs text-gray-400">Manage meals in this slot</p>
            </div>
          </button>
          <button
            @click="enterSwapMode"
            class="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left active:bg-gray-50"
          >
            <svg class="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            <div>
              <span class="text-sm font-medium text-gray-700">Swap</span>
              <p class="text-xs text-gray-400">Exchange with another slot</p>
            </div>
          </button>
          <button
            @click="clearSlot"
            class="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left active:bg-gray-50"
          >
            <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <div>
              <span class="text-sm font-medium text-gray-700">Clear All</span>
              <p class="text-xs text-gray-400">Remove all meals from this slot</p>
            </div>
          </button>
          <button
            @click="showActions = false"
            class="w-full py-3 mt-1 rounded-xl text-sm font-medium text-gray-400 active:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Copy Week Confirmation -->
  <Teleport to="body">
    <div
      v-if="showCopyConfirm"
      class="fixed inset-0 z-60 flex items-end justify-center bg-black/40 p-4"
      @click.self="showCopyConfirm = false"
    >
      <div class="bg-white rounded-2xl w-full max-w-sm p-5 mb-[env(safe-area-inset-bottom)]">
        <h3 class="text-lg font-bold text-gray-800 mb-2">Copy to Next Week?</h3>
        <p class="text-sm text-gray-500 mb-5">
          This will duplicate this week's meal plan into next week. Any existing meals in next week will be overwritten.
        </p>
        <div class="flex gap-3">
          <button
            @click="showCopyConfirm = false"
            class="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm"
          >
            Cancel
          </button>
          <button
            @click="confirmCopyWeek"
            class="flex-1 py-3 bg-primary-500 text-white rounded-xl font-semibold text-sm"
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Clear Week Confirmation -->
  <Teleport to="body">
    <div
      v-if="showClearConfirm"
      class="fixed inset-0 z-60 flex items-end justify-center bg-black/40 p-4"
      @click.self="showClearConfirm = false"
    >
      <div class="bg-white rounded-2xl w-full max-w-sm p-5 mb-[env(safe-area-inset-bottom)]">
        <h3 class="text-lg font-bold text-gray-800 mb-2">Clear This Week?</h3>
        <p class="text-sm text-gray-500 mb-5">
          This will remove all meals from every slot this week. This cannot be undone.
        </p>
        <div class="flex gap-3">
          <button
            @click="showClearConfirm = false"
            class="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm"
          >
            Cancel
          </button>
          <button
            @click="confirmClearWeek"
            class="flex-1 py-3 bg-red-500 text-white rounded-xl font-semibold text-sm"
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
