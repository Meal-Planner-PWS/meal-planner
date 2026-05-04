<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useMealStore } from '../../stores/meals'
import { usePlannerStore } from '../../stores/planner'
import { useBodyScrollLock } from '../../composables/useBodyScrollLock'

const props = defineProps({
  day: { type: String, required: true },
  slot: { type: String, required: true }
})

const emit = defineEmits(['close'])

useBodyScrollLock()

const router = useRouter()
const mealStore = useMealStore()
const plannerStore = usePlannerStore()

// Working copy of the meal entry — committed on Save
const initial = computed(() => plannerStore.currentWeek.days[props.day]?.[props.slot] || null)

const text = ref('')
const linkedRecipeIds = ref([])

watch(() => initial.value, (val) => {
  text.value = val?.text || ''
  linkedRecipeIds.value = [...(val?.recipeIds || [])]
}, { immediate: true })

const dayLabels = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday'
}
const slotLabels = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' }

// Recipe linker — reuses meal store filteredMeals search
const showRecipePicker = ref(false)
const recipeSearch = ref('')
const recipeResults = computed(() =>
  mealStore.filteredMeals(recipeSearch.value, 'all', false, 'fav_first')
)

const linkedRecipes = computed(() =>
  linkedRecipeIds.value.map((id) => mealStore.getMealById(id)).filter(Boolean)
)

function toggleRecipe(id) {
  const idx = linkedRecipeIds.value.indexOf(id)
  if (idx === -1) linkedRecipeIds.value.push(id)
  else linkedRecipeIds.value.splice(idx, 1)
}

function unlinkRecipe(id) {
  linkedRecipeIds.value = linkedRecipeIds.value.filter((x) => x !== id)
}

function save() {
  plannerStore.setMeal(props.day, props.slot, {
    text: text.value,
    recipeIds: linkedRecipeIds.value,
    helperIds: initial.value?.helperIds || [],
    prepTasks: initial.value?.prepTasks || []
  })
  emit('close')
}

function clearAll() {
  plannerStore.clearSlot(props.day, props.slot)
  emit('close')
}

function createNewRecipe() {
  emit('close')
  router.push({ path: '/library/new', query: { plannerDay: props.day, plannerSlot: props.slot } })
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-60 flex flex-col bg-black/40" @click.self="emit('close')">
      <div class="mt-auto bg-surface rounded-t-2xl max-h-[88dvh] flex flex-col shadow-xl">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
          <div>
            <h2 class="text-lg font-bold text-gray-800">Edit Meal</h2>
            <p class="text-xs text-gray-400">{{ dayLabels[day] }} · {{ slotLabels[slot] }}</p>
          </div>
          <button
            @click="save"
            class="px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-semibold active:scale-95 transition-transform"
          >
            Done
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto px-4 pb-[env(safe-area-inset-bottom)] pb-6 space-y-4">
          <!-- Meal text -->
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">What's for {{ slotLabels[slot].toLowerCase() }}?</label>
            <textarea
              v-model="text"
              rows="2"
              placeholder="e.g. Sheet pan chicken & veggies"
              class="w-full px-4 py-3 bg-surface-card rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 resize-none"
              autofocus
            />
          </div>

          <!-- Linked recipes -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs font-medium text-gray-500">Linked recipes</label>
              <button
                @click="showRecipePicker = !showRecipePicker"
                class="text-xs font-medium text-primary-500 active:text-primary-700"
              >
                {{ showRecipePicker ? 'Done' : '+ Link' }}
              </button>
            </div>

            <!-- Currently linked chips -->
            <div v-if="linkedRecipes.length" class="flex flex-wrap gap-1.5 mb-2">
              <span
                v-for="r in linkedRecipes"
                :key="r.id"
                class="inline-flex items-center gap-1 bg-primary-100 text-primary-700 px-2.5 py-1 rounded-full text-xs"
              >
                {{ r.name }}
                <button @click="unlinkRecipe(r.id)" class="text-primary-500 active:text-primary-700">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            </div>
            <p v-else class="text-[11px] text-gray-400 italic mb-2">No recipes linked. Optional — you can plan a meal with just text.</p>

            <!-- Recipe picker (collapsible) -->
            <div v-if="showRecipePicker" class="bg-surface-muted rounded-xl p-2.5 space-y-2">
              <div class="relative">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  v-model="recipeSearch"
                  type="text"
                  placeholder="Search recipes..."
                  class="w-full pl-9 pr-3 py-2 bg-white rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                />
              </div>

              <button
                @click="createNewRecipe"
                class="w-full flex items-center gap-2 p-2 rounded-lg border-2 border-dashed border-primary-300 bg-primary-50/40 text-left active:scale-[0.98]"
              >
                <span class="w-7 h-7 rounded-md bg-primary-100 text-primary-500 flex items-center justify-center text-base font-bold">+</span>
                <span class="text-xs font-semibold text-primary-600">Add a new recipe</span>
              </button>

              <div class="max-h-56 overflow-y-auto space-y-1">
                <button
                  v-for="r in recipeResults"
                  :key="r.id"
                  @click="toggleRecipe(r.id)"
                  class="w-full flex items-center gap-2 p-2 rounded-lg text-left active:scale-[0.98]"
                  :class="linkedRecipeIds.includes(r.id) ? 'bg-primary-50 border border-primary-300' : 'bg-white border border-gray-100'"
                >
                  <div class="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                       :class="linkedRecipeIds.includes(r.id) ? 'bg-primary-500' : 'bg-gray-100 border border-gray-300'">
                    <svg v-if="linkedRecipeIds.includes(r.id)" class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span class="text-xs font-medium text-gray-700 truncate flex-1">{{ r.name }}</span>
                  <span class="text-[10px] text-gray-400 capitalize shrink-0">{{ r.category }}</span>
                </button>
                <p v-if="recipeResults.length === 0" class="text-[11px] text-gray-400 text-center py-2">No matching recipes</p>
              </div>
            </div>
          </div>

          <!-- Clear button -->
          <button
            v-if="initial"
            @click="clearAll"
            class="w-full py-2.5 text-sm text-red-500 active:bg-red-50 rounded-xl"
          >
            Clear this meal
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
