<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { usePlannerStore } from '../stores/planner'
import DaySection from '../components/planner/DaySection.vue'
import MealEditor from '../components/planner/MealEditor.vue'
import MealCodeSettings from '../components/planner/MealCodeSettings.vue'

const plannerStore = usePlannerStore()

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const isEmptyWeek = computed(() => {
  const days = plannerStore.currentWeek.days
  for (const day of DAYS) {
    for (const slot of ['breakfast', 'lunch', 'dinner']) {
      const v = days[day]?.[slot]
      if (v && (v.text?.trim() || (v.recipeIds && v.recipeIds.length > 0))) return false
    }
  }
  return true
})

// --- Week navigation (Monday-first) ---

function localDateKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function thisWeekStart() {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  // Roll back to Monday: getDay() 0=Sun → -6, 1=Mon → 0, 2=Tue → -1, ...
  const offset = d.getDay() === 0 ? -6 : 1 - d.getDay()
  d.setDate(d.getDate() + offset)
  return localDateKey(d)
}

const weekLabel = computed(() => {
  const start = new Date(plannerStore.currentWeekStart + 'T00:00:00')
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const sMonth = start.toLocaleString('default', { month: 'short' })
  const eMonth = end.toLocaleString('default', { month: 'short' })
  if (sMonth === eMonth) return `${sMonth} ${start.getDate()}–${end.getDate()}`
  return `${sMonth} ${start.getDate()} – ${eMonth} ${end.getDate()}`
})

function todayDayKey() {
  // getDay: 0=Sun, 1=Mon, ..., 6=Sat → DAYS index (Monday-first)
  const d = new Date().getDay()
  return d === 0 ? 'sunday' : DAYS[d - 1]
}

const isCurrentWeek = computed(() => plannerStore.currentWeekStart === thisWeekStart())
function isToday(dayKey) {
  return isCurrentWeek.value && dayKey === todayDayKey()
}

// --- Meal editor (replaces MealPicker) ---

const showEditor = ref(false)
const editorTarget = ref({ day: '', slot: '' })

function openEditor({ day, slot }) {
  editorTarget.value = { day, slot }
  showEditor.value = true
}

function clearMealFromSlot({ day, slot }) {
  plannerStore.clearSlot(day, slot)
}

function onNotesUpdate({ day, notes }) {
  plannerStore.setDayNotes(day, notes)
}

// --- Slot action sheet (filled slot options) ---

const showActions = ref(false)
const actionTarget = ref({ day: '', slot: '' })

function openSlotAction({ day, slot }) {
  actionTarget.value = { day, slot }
  showActions.value = true
}

const actionMealText = computed(() => {
  const entry = plannerStore.currentWeek.days[actionTarget.value.day]?.[actionTarget.value.slot]
  return entry?.text || ''
})

function clearSlotAction() {
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

// --- Drag-and-drop between slots (Pointer Events, mobile-friendly) ---

const dragSource = ref(null)        // { day, slot } currently being dragged
const dropTarget = ref(null)        // { day, slot } currently hovered as drop target
const dragGhostStyle = ref(null)    // { left, top } for the floating preview
const dragGhostText = ref('')

const LONG_PRESS_MS = 350
let longPressTimer = null
let pointerStartXY = null
let pointerId = null

function onDragStart({ day, slot, pointerEvent }) {
  if (swapMode.value) return
  // Don't start drag if the user actually tapped an interactive child (clear, options buttons)
  const targetEl = pointerEvent?.target
  if (targetEl && targetEl.closest && targetEl.closest('button')) return

  pointerStartXY = { x: pointerEvent.clientX, y: pointerEvent.clientY }
  pointerId = pointerEvent.pointerId

  // Hold to start drag — prevents drag-on-tap
  longPressTimer = setTimeout(() => {
    const entry = plannerStore.currentWeek.days[day]?.[slot]
    if (!entry) return
    dragSource.value = { day, slot }
    dragGhostText.value = entry.text || (entry.recipeIds || []).join(' + ') || '...'
    updateGhost(pointerStartXY.x, pointerStartXY.y)

    // Vibrate to confirm (where supported)
    if (navigator.vibrate) navigator.vibrate(15)

    // Capture pointer so move/up keep firing even if finger leaves the source element
    try { pointerEvent.target.setPointerCapture(pointerId) } catch {}
  }, LONG_PRESS_MS)
}

function onPointerMove(e) {
  if (longPressTimer && pointerStartXY) {
    // If the user moves more than 8px before the long-press fires, treat as scroll, not drag
    const dx = Math.abs(e.clientX - pointerStartXY.x)
    const dy = Math.abs(e.clientY - pointerStartXY.y)
    if (dx > 8 || dy > 8) {
      clearTimeout(longPressTimer)
      longPressTimer = null
      pointerStartXY = null
    }
    return
  }

  if (!dragSource.value) return
  e.preventDefault()
  updateGhost(e.clientX, e.clientY)

  // Find slot under finger
  const el = document.elementFromPoint(e.clientX, e.clientY)
  const slotEl = el?.closest?.('[data-drop-slot]')
  if (slotEl) {
    const day = slotEl.getAttribute('data-drop-day')
    const slot = slotEl.getAttribute('data-drop-slot')
    if (dropTarget.value?.day !== day || dropTarget.value?.slot !== slot) {
      dropTarget.value = { day, slot }
    }
  } else {
    dropTarget.value = null
  }
}

function onPointerUp() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
  pointerStartXY = null

  if (dragSource.value && dropTarget.value) {
    plannerStore.moveMeal(
      dragSource.value.day, dragSource.value.slot,
      dropTarget.value.day, dropTarget.value.slot
    )
  }
  dragSource.value = null
  dropTarget.value = null
  dragGhostStyle.value = null
  pointerId = null
}

function updateGhost(x, y) {
  dragGhostStyle.value = {
    transform: `translate(${x + 12}px, ${y + 12}px)`
  }
}

onMounted(() => {
  window.addEventListener('pointermove', onPointerMove, { passive: false })
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
})

// --- Copy / Clear week / Settings ---

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
// Only fires on first mount of the session (when there's no scroll cache).
// Subsequent visits to /planner restore the cached scroll position via the router.

let hasAutoScrolledThisSession = false

onMounted(async () => {
  if (!isCurrentWeek.value) return
  if (hasAutoScrolledThisSession) return
  // Skip if router already restored a scroll position
  if (window.scrollY > 50) return
  await nextTick()
  const todayEl = document.getElementById(`day-${todayDayKey()}`)
  if (todayEl) todayEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
  hasAutoScrolledThisSession = true
})

watch(() => plannerStore.currentWeekStart, async (val) => {
  if (val === thisWeekStart()) {
    await nextTick()
    const todayEl = document.getElementById(`day-${todayDayKey()}`)
    if (todayEl) todayEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
          title="Settings"
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
      <div class="flex flex-col items-center">
        <span class="text-sm font-semibold text-gray-600">{{ weekLabel }}</span>
        <span class="text-xs italic text-gray-400">You MAKE time.</span>
      </div>
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
      <button @click="exitSwapMode" class="text-xs font-semibold text-amber-600 bg-amber-100 px-3 py-1.5 rounded-lg">
        Cancel
      </button>
    </div>

    <!-- Empty-week quote -->
    <p
      v-if="isEmptyWeek && !swapMode"
      class="text-center text-sm italic text-gray-400 mb-3"
      @click.stop
    >
      I don't lose things. I place things in locations which later elude me.
    </p>

    <!-- Day sections -->
    <div class="space-y-3" @click.stop>
      <!-- Wrap each day so we can attach data attributes for drop-target hit-testing.
           Each MealSlot is wrapped at render time with the same data attributes. -->
      <div
        v-for="day in DAYS"
        :key="day"
      >
        <!-- Drop targets are inside DaySection's MealSlot — we tag the wrappers via data attrs in a loop. -->
        <DaySection
          :day="day"
          :day-data="plannerStore.currentWeek.days[day] || { breakfast: null, lunch: null, dinner: null, notes: '' }"
          :is-today="isToday(day)"
          :swap-mode="swapMode"
          :swap-source="swapSource"
          :drag-source="dragSource"
          :drop-target="dropTarget"
          @edit="openEditor"
          @slot-action="openSlotAction"
          @swap-target="onSwapTarget"
          @clear="clearMealFromSlot"
          @drag-start="onDragStart"
          @notes-update="onNotesUpdate"
        />
      </div>
    </div>

    <!-- Drag preview ghost -->
    <div
      v-if="dragSource"
      class="fixed top-0 left-0 z-[80] pointer-events-none bg-primary-500 text-white px-3 py-2 rounded-xl shadow-xl text-sm font-semibold"
      :style="dragGhostStyle"
    >
      {{ dragGhostText }}
    </div>
  </div>

  <!-- Settings -->
  <MealCodeSettings
    v-if="showSettings"
    default-tab="codes"
    @close="showSettings = false"
  />

  <!-- Meal Editor sheet -->
  <MealEditor
    v-if="showEditor"
    :day="editorTarget.day"
    :slot="editorTarget.slot"
    @close="showEditor = false"
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
          <h3 class="text-base font-bold text-gray-800 truncate">{{ actionMealText || 'Meal' }}</h3>
          <p class="text-xs text-gray-400 capitalize mt-0.5">
            {{ actionTarget.day }} &middot; {{ actionTarget.slot }}
          </p>
        </div>
        <div class="px-3 pb-4 space-y-1">
          <button
            @click="openEditor({ day: actionTarget.day, slot: actionTarget.slot }); showActions = false"
            class="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left active:bg-gray-50"
          >
            <svg class="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <div>
              <span class="text-sm font-medium text-gray-700">Edit Meal</span>
              <p class="text-xs text-gray-400">Change text or linked recipes</p>
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
              <p class="text-xs text-gray-400">Or long-press a meal to drag it</p>
            </div>
          </button>
          <button
            @click="clearSlotAction"
            class="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left active:bg-gray-50"
          >
            <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <div>
              <span class="text-sm font-medium text-gray-700">Clear meal</span>
              <p class="text-xs text-gray-400">Remove this meal entirely</p>
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
        <p class="text-sm text-gray-500 mb-2">
          This will duplicate this week's meal plan into next week. Any existing meals in next week will be overwritten.
        </p>
        <p class="text-xs italic text-gray-400 mb-5">Food is life.</p>
        <div class="flex gap-3">
          <button @click="showCopyConfirm = false" class="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm">Cancel</button>
          <button @click="confirmCopyWeek" class="flex-1 py-3 bg-primary-500 text-white rounded-xl font-semibold text-sm">Copy</button>
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
        <p class="text-sm text-gray-500 mb-5">This will remove all meals from every slot this week. This cannot be undone.</p>
        <div class="flex gap-3">
          <button @click="showClearConfirm = false" class="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm">Cancel</button>
          <button @click="confirmClearWeek" class="flex-1 py-3 bg-red-500 text-white rounded-xl font-semibold text-sm">Clear All</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
