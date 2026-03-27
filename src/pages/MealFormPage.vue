<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMealStore } from '../stores/meals'
import { usePlannerStore } from '../stores/planner'
import { useIdeasStore } from '../stores/ideas'

const route = useRoute()
const router = useRouter()
const mealStore = useMealStore()
const plannerStore = usePlannerStore()
const ideasStore = useIdeasStore()

// If we arrived from the planner's MealPicker, these will be set
const plannerDay = route.query.plannerDay || null
const plannerSlot = route.query.plannerSlot || null

const isEdit = computed(() => !!route.params.id)
const pageTitle = computed(() => (isEdit.value ? 'Edit Meal' : 'Add Meal'))

const form = ref({
  name: '',
  category: 'dinner',
  ingredients: [],
  instructions: '',
  sourceUrl: '',
  notes: '',
  photo: '',
  prepTime: null
})

const nameError = ref(false)
const ingredientInput = ref('')
const photoInput = ref(null)

function fillForm(meal) {
  form.value = {
    name: meal.name || '',
    category: meal.category || 'dinner',
    ingredients: [...(meal.ingredients || [])],
    instructions: meal.instructions || '',
    sourceUrl: meal.sourceUrl || '',
    notes: meal.notes || '',
    photo: meal.photo || '',
    prepTime: meal.prepTime || null
  }
}

onMounted(async () => {
  if (isEdit.value) {
    // Use local data immediately, then fetch full detail from server
    const local = mealStore.getMealById(route.params.id)
    if (local) {
      fillForm(local)
    }
    const full = await mealStore.fetchMealDetail(route.params.id)
    if (full) {
      fillForm(full)
    } else if (!local) {
      router.replace('/library')
    }
  } else {
    // Check for pre-filled data from the Ideas "Save to Library" flow
    const pending = ideasStore.consumePendingRecipe()
    if (pending) {
      fillForm(pending)
    }
  }
})

function addIngredient() {
  const val = ingredientInput.value.trim()
  if (val && !form.value.ingredients.includes(val)) {
    form.value.ingredients.push(val)
  }
  ingredientInput.value = ''
}

function removeIngredient(idx) {
  form.value.ingredients.splice(idx, 1)
}

function handlePhoto(e) {
  const file = e.target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (ev) => {
    form.value.photo = ev.target.result
  }
  reader.readAsDataURL(file)
}

function removePhoto() {
  form.value.photo = ''
  if (photoInput.value) {
    photoInput.value.value = ''
  }
}

function save() {
  nameError.value = false

  if (!form.value.name.trim()) {
    nameError.value = true
    document.getElementById('meal-name-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }

  try {
    if (isEdit.value) {
      mealStore.updateMeal(route.params.id, { ...form.value })
      router.push(`/library/${route.params.id}`)
    } else {
      const meal = { ...form.value }
      mealStore.addMeal(meal)

      if (plannerDay && plannerSlot) {
        const newMeal = mealStore.meals[mealStore.meals.length - 1]
        plannerStore.addMealToSlot(plannerDay, plannerSlot, newMeal.id)
        router.push('/planner')
      } else {
        router.push('/library')
      }
    }
  } catch (err) {
    console.error('[MealForm] save failed:', err)
    if (isEdit.value) {
      router.push(`/library/${route.params.id}`)
    } else if (plannerDay && plannerSlot) {
      router.push('/planner')
    } else {
      router.push('/library')
    }
  }
}

const categories = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'drink', label: 'Drink' }
]
</script>

<template>
  <div class="p-4">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-6">
      <button
        @click="router.push('/library')"
        class="p-2 -m-2 text-gray-500"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-2xl font-bold text-gray-800">{{ pageTitle }}</h1>
    </div>

    <div class="space-y-5">
      <!-- Name -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Meal Name *</label>
        <input
          id="meal-name-input"
          v-model="form.name"
          type="text"
          placeholder="e.g. Chicken Stir Fry"
          class="w-full px-4 py-3 bg-surface-card rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
          :class="nameError ? 'border-red-400 ring-2 ring-red-400/30' : 'border-gray-200'"
          @input="nameError = false"
        />
        <p v-if="nameError" class="text-red-500 text-xs mt-1">Please enter a meal name</p>
      </div>

      <!-- Category -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Category</label>
        <div class="flex gap-2 flex-wrap">
          <button
            v-for="cat in categories"
            :key="cat.value"
            type="button"
            @click="form.category = cat.value"
            class="px-4 py-2 rounded-full text-sm font-medium transition-colors"
            :class="form.category === cat.value
              ? 'bg-primary-500 text-white'
              : 'bg-surface-card text-gray-600 border border-gray-200'"
          >
            {{ cat.label }}
          </button>
        </div>
      </div>

      <!-- Photo -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Photo</label>
        <div v-if="form.photo" class="relative mb-2">
          <img :src="form.photo" class="w-full h-48 object-cover rounded-xl" />
          <button
            type="button"
            @click="removePhoto"
            class="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1.5"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <label
          v-else
          class="flex items-center justify-center w-full h-32 bg-surface-muted rounded-xl border-2 border-dashed border-gray-300 cursor-pointer"
        >
          <div class="text-center">
            <svg class="w-8 h-8 mx-auto text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span class="text-sm text-gray-400">Tap to add photo</span>
          </div>
          <input
            ref="photoInput"
            type="file"
            accept="image/*"
            class="hidden"
            @change="handlePhoto"
          />
        </label>
      </div>

      <!-- Ingredients -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Ingredients</label>
        <div class="flex gap-2 mb-2">
          <input
            v-model="ingredientInput"
            type="text"
            placeholder="Type ingredient + Enter"
            class="flex-1 px-4 py-3 bg-surface-card rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
            @keydown.enter.prevent="addIngredient"
          />
          <button
            type="button"
            @click="addIngredient"
            class="px-4 py-3 bg-primary-500 text-white rounded-xl text-sm font-medium shrink-0 active:scale-95 transition-transform"
          >
            Add
          </button>
        </div>
        <div v-if="form.ingredients.length" class="flex flex-wrap gap-2">
          <span
            v-for="(ing, idx) in form.ingredients"
            :key="idx"
            class="inline-flex items-center gap-1 bg-primary-100 text-primary-700 px-3 py-1.5 rounded-full text-sm"
          >
            {{ ing }}
            <button
              type="button"
              @click="removeIngredient(idx)"
              class="text-primary-500 hover:text-primary-700 ml-0.5"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        </div>
      </div>

      <!-- Instructions -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
        <textarea
          v-model="form.instructions"
          rows="5"
          placeholder="Step-by-step instructions..."
          class="w-full px-4 py-3 bg-surface-card rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 resize-none"
        />
      </div>

      <!-- Source URL -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Source URL</label>
        <input
          v-model="form.sourceUrl"
          type="text"
          inputmode="url"
          placeholder="https://..."
          class="w-full px-4 py-3 bg-surface-card rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
        />
      </div>

      <!-- Notes -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          v-model="form.notes"
          rows="3"
          placeholder="Any extra notes..."
          class="w-full px-4 py-3 bg-surface-card rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 resize-none"
        />
      </div>

      <!-- Prep Time -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Prep Time (minutes)</label>
        <input
          v-model.number="form.prepTime"
          type="number"
          inputmode="numeric"
          min="0"
          placeholder="e.g. 30"
          class="w-full px-4 py-3 bg-surface-card rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
        />
      </div>

      <!-- Submit -->
      <button
        type="button"
        @click="save"
        class="w-full py-3.5 bg-primary-500 text-white rounded-xl font-semibold text-base shadow-sm active:scale-[0.98] transition-transform"
      >
        {{ isEdit ? 'Save Changes' : 'Add Meal' }}
      </button>
    </div>
  </div>
</template>
