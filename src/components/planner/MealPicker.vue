<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMealStore } from '../../stores/meals'
import { usePlannerStore } from '../../stores/planner'

const props = defineProps({
  day: { type: String, required: true },
  slot: { type: String, required: true }
})

const emit = defineEmits(['close'])

const router = useRouter()
const mealStore = useMealStore()
const plannerStore = usePlannerStore()

const search = ref('')

const dayLabels = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday'
}

const slotLabels = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack'
}

const meals = computed(() => {
  return mealStore.filteredMeals(search.value, 'all', false)
})

/** Current meal IDs in this slot (reactive — reads directly from store) */
const selectedIds = computed(() => {
  const daySlots = plannerStore.currentWeek.days[props.day]
  const val = daySlots?.[props.slot]
  return Array.isArray(val) ? val : []
})

const selectedCount = computed(() => selectedIds.value.length)

const categoryDotColors = {
  breakfast: 'bg-amber-400',
  lunch: 'bg-sky-400',
  dinner: 'bg-violet-400',
  snack: 'bg-emerald-400'
}

function isSelected(mealId) {
  return selectedIds.value.includes(mealId)
}

function toggleMeal(mealId) {
  if (isSelected(mealId)) {
    plannerStore.removeMealFromSlot(props.day, props.slot, mealId)
  } else {
    plannerStore.addMealToSlot(props.day, props.slot, mealId)
  }
}

function createNewMeal() {
  emit('close')
  router.push({
    path: '/library/new',
    query: { plannerDay: props.day, plannerSlot: props.slot }
  })
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[60] flex flex-col bg-black/40" @click.self="emit('close')">
      <div class="mt-auto bg-surface rounded-t-2xl max-h-[85dvh] flex flex-col shadow-xl">
        <!-- Header with Done button -->
        <div class="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            <h2 class="text-lg font-bold text-gray-800">Pick Meals</h2>
            <p class="text-xs text-gray-400">
              {{ dayLabels[day] }} &middot; {{ slotLabels[slot] }}
              <span v-if="selectedCount" class="text-primary-500 font-semibold">
                &middot; {{ selectedCount }} selected
              </span>
            </p>
          </div>
          <button
            @click="emit('close')"
            class="px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-semibold active:scale-95 transition-transform"
          >
            Done
          </button>
        </div>

        <!-- Search -->
        <div class="px-4 pb-3">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              v-model="search"
              type="text"
              placeholder="Search meals..."
              class="w-full pl-10 pr-4 py-2.5 bg-surface-muted rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
              autofocus
            />
          </div>
        </div>

        <!-- Meal list -->
        <div class="flex-1 overflow-y-auto px-4 pb-[env(safe-area-inset-bottom)] pb-6">
          <!-- Create new meal shortcut -->
          <button
            @click="createNewMeal"
            class="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-primary-300 bg-primary-50/50 text-left active:scale-[0.98] transition-transform mb-3"
          >
            <div class="w-11 h-11 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
              <svg class="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <span class="text-sm font-semibold text-primary-600">Create New Meal</span>
              <p class="text-xs text-primary-400 mt-0.5">Add a meal and assign it here</p>
            </div>
            <svg class="w-4 h-4 text-primary-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div v-if="meals.length" class="space-y-1.5">
            <button
              v-for="meal in meals"
              :key="meal.id"
              @click="toggleMeal(meal.id)"
              class="w-full flex items-center gap-3 p-3 rounded-xl text-left active:scale-[0.98] transition-all"
              :class="isSelected(meal.id)
                ? 'bg-primary-50 border-2 border-primary-400'
                : 'bg-surface-card border border-gray-100'"
            >
              <!-- Checkbox indicator -->
              <div
                class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                :class="isSelected(meal.id)
                  ? 'bg-primary-500'
                  : 'bg-surface-muted border border-gray-300'"
              >
                <svg
                  v-if="isSelected(meal.id)"
                  class="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <!-- Thumbnail -->
              <div class="w-10 h-10 rounded-lg bg-surface-muted overflow-hidden shrink-0">
                <img
                  v-if="meal.photo"
                  :src="meal.photo"
                  :alt="meal.name"
                  class="w-full h-full object-cover"
                />
                <div v-else class="w-full h-full flex items-center justify-center text-gray-300">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>

              <!-- Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <svg
                    v-if="meal.isFavorite"
                    class="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0"
                    viewBox="0 0 24 24"
                  >
                    <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  <span class="text-sm font-medium text-gray-800 truncate">{{ meal.name }}</span>
                </div>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <span class="w-1.5 h-1.5 rounded-full" :class="categoryDotColors[meal.category]" />
                  <span class="text-xs text-gray-400 capitalize">{{ meal.category }}</span>
                </div>
              </div>
            </button>
          </div>

          <!-- Empty search state -->
          <div v-else class="text-center py-6">
            <p class="text-gray-400 text-sm">No meals match your search</p>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
