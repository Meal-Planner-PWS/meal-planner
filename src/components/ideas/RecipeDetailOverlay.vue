<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useIdeasStore } from '../../stores/ideas'
import { useSettingsStore } from '../../stores/settings'
import { cleanifyIngredients } from '../../utils/cleanify'

const emit = defineEmits(['close'])
const router = useRouter()
const ideasStore = useIdeasStore()
const settingsStore = useSettingsStore()

const recipe = computed(() => ideasStore.recipeDetail)
const loading = computed(() => ideasStore.detailLoading)

const ingredients = computed(() => {
  if (!recipe.value?.extendedIngredients) return []
  return recipe.value.extendedIngredients.map((i) => i.original || i.name)
})

const instructions = computed(() => {
  if (!recipe.value) return ''

  if (recipe.value.analyzedInstructions?.length) {
    return recipe.value.analyzedInstructions
      .flatMap((group) => group.steps || [])
      .map((step) => `${step.number}. ${step.step}`)
      .join('\n')
  }

  if (recipe.value.instructions) {
    return recipe.value.instructions.replace(/<[^>]*>/g, '\n').replace(/\n{2,}/g, '\n').trim()
  }

  return ''
})

const vetStatus = computed(() => recipe.value?._vetStatus)
const vetFlagged = computed(() => recipe.value?._vetFlagged || [])

// --- Cleanify flow ---
const showCleanifySummary = ref(false)
const cleanifyResult = ref(null)

function buildPendingRecipe(ingredientsList) {
  return {
    name: recipe.value.title || '',
    category: 'dinner',
    ingredients: ingredientsList,
    instructions: instructions.value,
    sourceUrl: recipe.value.sourceUrl || recipe.value.spoonacularSourceUrl || '',
    photo: recipe.value.image || '',
    notes: '',
    prepTime: recipe.value.readyInMinutes || null
  }
}

function saveAsIs() {
  if (!recipe.value) return
  ideasStore.setPendingRecipe(buildPendingRecipe(ingredients.value))
  emit('close')
  router.push('/library/new')
}

function startCleanify() {
  if (!recipe.value) return
  const result = cleanifyIngredients(ingredients.value, settingsStore.cleanifyRules)
  cleanifyResult.value = result
  showCleanifySummary.value = true
}

function saveCleanified() {
  if (!cleanifyResult.value) return
  ideasStore.setPendingRecipe(buildPendingRecipe(cleanifyResult.value.ingredients))
  emit('close')
  router.push('/library/new')
}

function saveOriginalFromSummary() {
  ideasStore.setPendingRecipe(buildPendingRecipe(ingredients.value))
  emit('close')
  router.push('/library/new')
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-60 flex flex-col bg-black/40"
      @click.self="emit('close')"
    >
      <div class="mt-auto bg-surface rounded-t-2xl max-h-[90dvh] flex flex-col shadow-xl">
        <!-- Loading -->
        <div v-if="loading" class="p-8 text-center">
          <div class="w-8 h-8 border-3 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-3" />
          <p class="text-sm text-gray-400">Loading recipe...</p>
        </div>

        <!-- Cleanify Summary Modal -->
        <template v-else-if="showCleanifySummary && cleanifyResult">
          <div class="px-5 pt-5 pb-3 shrink-0">
            <h2 class="text-lg font-bold text-gray-800">
              {{ cleanifyResult.substitutions.length > 0 ? 'Cleanified' : 'Already Clean!' }}
            </h2>
          </div>

          <div class="flex-1 overflow-y-auto px-5 pb-4">
            <template v-if="cleanifyResult.substitutions.length > 0">
              <p class="text-xs text-gray-500 mb-3">These ingredients were swapped:</p>
              <div class="space-y-2.5">
                <div
                  v-for="(sub, idx) in cleanifyResult.substitutions"
                  :key="idx"
                  class="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5"
                >
                  <div class="flex items-center gap-2 text-sm">
                    <span class="text-red-400 line-through">{{ sub.rule.from }}</span>
                    <svg class="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    <span class="text-emerald-700 font-medium">{{ sub.rule.to }}</span>
                  </div>
                  <p class="text-[11px] text-gray-400 mt-1 truncate">in: {{ sub.original }}</p>
                </div>
              </div>
            </template>
            <template v-else>
              <p class="text-sm text-gray-500 mt-2">This recipe has no ingredients that match your cleanify rules. No changes needed!</p>
            </template>
          </div>

          <div class="shrink-0 px-4 pb-4 pt-2 border-t border-gray-100 pb-[env(safe-area-inset-bottom)] space-y-2">
            <template v-if="cleanifyResult.substitutions.length > 0">
              <button
                @click="saveCleanified"
                class="w-full py-3.5 bg-emerald-500 text-white rounded-xl font-semibold text-sm shadow-sm active:scale-[0.98] transition-transform"
              >
                Looks good, save it
              </button>
              <button
                @click="saveOriginalFromSummary"
                class="w-full py-3 bg-surface-muted text-gray-600 rounded-xl font-medium text-sm active:scale-[0.98] transition-transform"
              >
                Edit manually instead
              </button>
            </template>
            <template v-else>
              <button
                @click="saveAsIs"
                class="w-full py-3.5 bg-primary-500 text-white rounded-xl font-semibold text-sm shadow-sm active:scale-[0.98] transition-transform"
              >
                Save to Library
              </button>
            </template>
            <button
              @click="showCleanifySummary = false"
              class="w-full py-2 text-gray-400 text-sm font-medium"
            >
              Back
            </button>
          </div>
        </template>

        <!-- Content -->
        <template v-else-if="recipe">
          <!-- Header with image -->
          <div class="relative shrink-0">
            <div v-if="recipe.image" class="w-full h-48 bg-surface-muted">
              <img :src="recipe.image" :alt="recipe.title" class="w-full h-full object-cover rounded-t-2xl" width="556" height="370" />
            </div>
            <button
              @click="emit('close')"
              class="absolute top-3 right-3 bg-black/30 backdrop-blur-sm text-white rounded-full p-2"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Scrollable body -->
          <div class="flex-1 overflow-y-auto p-4">
            <h2 class="text-xl font-bold text-gray-800 mb-1">{{ recipe.title }}</h2>

            <!-- Meta row -->
            <div class="flex items-center gap-3 text-xs text-gray-400 mb-3">
              <span v-if="recipe.readyInMinutes" class="flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {{ recipe.readyInMinutes }} min
              </span>
              <span v-if="recipe.servings" class="flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {{ recipe.servings }} servings
              </span>
            </div>

            <!-- Vet status badge -->
            <div v-if="vetStatus === 'clean'" class="mb-4">
              <span class="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Clean Ingredients
              </span>
            </div>
            <div v-else-if="vetStatus === 'review'" class="mb-4">
              <div class="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <div class="flex items-center gap-1.5 mb-1.5">
                  <svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <span class="text-xs font-semibold text-amber-700">Ingredients to Review</span>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="item in vetFlagged"
                    :key="item"
                    class="text-[11px] bg-amber-200/60 text-amber-800 px-2 py-0.5 rounded-full capitalize"
                  >
                    {{ item }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Ingredients -->
            <div v-if="ingredients.length" class="mb-5">
              <h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Ingredients</h3>
              <ul class="space-y-1.5">
                <li
                  v-for="(ing, idx) in ingredients"
                  :key="idx"
                  class="flex items-start gap-2 text-sm text-gray-600"
                >
                  <span class="w-1.5 h-1.5 bg-primary-500 rounded-full shrink-0 mt-1.5" />
                  {{ ing }}
                </li>
              </ul>
            </div>

            <!-- Instructions -->
            <div v-if="instructions" class="mb-5">
              <h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Instructions</h3>
              <p class="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{{ instructions }}</p>
            </div>

            <!-- Source -->
            <a
              v-if="recipe.sourceUrl"
              :href="recipe.sourceUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 text-sm text-primary-500 font-medium mb-4"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View original recipe
            </a>
          </div>

          <!-- Save buttons -->
          <div class="shrink-0 px-4 pb-4 pt-2 border-t border-gray-100 pb-[env(safe-area-inset-bottom)] space-y-2">
            <button
              @click="startCleanify"
              class="w-full py-3.5 bg-emerald-500 text-white rounded-xl font-semibold text-sm shadow-sm active:scale-[0.98] transition-transform"
            >
              Cleanify + Save
            </button>
            <button
              @click="saveAsIs"
              class="w-full py-3 bg-surface-muted text-gray-600 rounded-xl font-medium text-sm active:scale-[0.98] transition-transform"
            >
              Save as-is
            </button>
          </div>
        </template>

        <!-- Error fallback -->
        <div v-else class="p-8 text-center">
          <p class="text-gray-400 text-sm">Could not load recipe details.</p>
          <button @click="emit('close')" class="mt-3 text-primary-500 text-sm font-medium">Close</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
