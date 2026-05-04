<script setup>
import { ref, computed } from 'vue'
import { useSettingsStore } from '../../stores/settings'
import { KEYWORD_CATEGORIES } from '../../utils/ingredientVetting'
import { useBodyScrollLock } from '../../composables/useBodyScrollLock'

useBodyScrollLock()

const props = defineProps({
  defaultTab: { type: String, default: 'codes' }
})

const emit = defineEmits(['close'])
const settingsStore = useSettingsStore()

const activeTab = ref(props.defaultTab)
const TABS = [
  { key: 'codes', label: 'Meal Codes' },
  { key: 'categories', label: 'Categories' },
  { key: 'ingredients', label: 'Ingredients' },
  { key: 'cleanify', label: 'Cleanify' },
  { key: 'support', label: 'Support' }
]

// --- Categories state ---
const newCategoryLabel = ref('')
const categoryDuplicateWarning = ref(false)

function addCategory() {
  categoryDuplicateWarning.value = false
  const added = settingsStore.addCategory(newCategoryLabel.value)
  if (!added) {
    categoryDuplicateWarning.value = true
    return
  }
  newCategoryLabel.value = ''
}

// --- Support / mailto link ---
const SUPPORT_EMAIL = 'eric@ericphifer.tech'

const supportMailto = computed(() => {
  const subject = 'Meal Planner — Feedback'
  const standalone = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches
  const platform = standalone ? 'PWA (standalone)' : 'Browser'
  const body = [
    '',
    '',
    '— sent from Meal Planner —',
    `Date: ${new Date().toISOString()}`,
    `Mode: ${platform}`,
    `URL: ${typeof window !== 'undefined' ? window.location.href : ''}`,
    `User Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : ''}`
  ].join('\n')
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
})

// --- Flagged ingredients state ---
const newIngredient = ref('')
const duplicateWarning = ref(false)
const showResetConfirm = ref(false)

// Build all default keywords into a flat set for category lookup
const defaultKeywordSet = new Set(Object.values(KEYWORD_CATEGORIES).flat())

// Group flagged ingredients by category for display
const groupedFlagged = computed(() => {
  const groups = {}
  const categoryNames = Object.keys(KEYWORD_CATEGORIES)

  for (const cat of categoryNames) {
    const items = KEYWORD_CATEGORIES[cat].filter((k) => settingsStore.flaggedIngredients.includes(k))
    if (items.length > 0) {
      groups[cat] = items
    }
  }

  // User-added keywords that aren't in any default category
  const other = settingsStore.flaggedIngredients.filter((k) => !defaultKeywordSet.has(k))
  if (other.length > 0) {
    groups['Other'] = other
  }

  return groups
})

function addIngredient() {
  duplicateWarning.value = false
  const val = newIngredient.value.trim().toLowerCase()
  if (!val) return
  const added = settingsStore.addFlaggedIngredient(val)
  if (!added) {
    duplicateWarning.value = true
    return
  }
  newIngredient.value = ''
}

function confirmReset() {
  settingsStore.resetFlaggedIngredients()
  showResetConfirm.value = false
}

// --- Cleanify rules state ---
const newRuleFrom = ref('')
const newRuleTo = ref('')
const ruleDuplicateWarning = ref(false)
const showRuleResetConfirm = ref(false)

function addRule() {
  ruleDuplicateWarning.value = false
  const added = settingsStore.addCleanifyRule(newRuleFrom.value, newRuleTo.value)
  if (!added) {
    ruleDuplicateWarning.value = true
    return
  }
  newRuleFrom.value = ''
  newRuleTo.value = ''
}

function confirmRuleReset() {
  settingsStore.resetCleanifyRules()
  showRuleResetConfirm.value = false
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DAY_LABELS = { sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat' }
const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack']
const SLOT_LABELS = { breakfast: 'Bkfst', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' }

const PRESET_COLORS = [
  { color: '#9B59B6', label: 'Purple' },
  { color: '#E74C3C', label: 'Red' },
  { color: '#3498DB', label: 'Blue' },
  { color: '#95A5A6', label: 'Grey' },
  { color: '#27AE60', label: 'Green' },
  { color: '#E67E22', label: 'Orange' },
  { color: '#F1C40F', label: 'Yellow' },
  { color: '#1ABC9C', label: 'Teal' }
]

function updateLetter(index, event) {
  const raw = event.target.value.toUpperCase().slice(0, 1)
  settingsStore.updateCode(index, { letter: raw })
}

function updateColor(index, color, label) {
  settingsStore.updateCode(index, { color, label })
}

function addCode() {
  // Find a letter not already used
  const used = new Set(settingsStore.codes.map((c) => c.letter))
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let letter = '?'
  for (const ch of alphabet) {
    if (!used.has(ch)) { letter = ch; break }
  }
  // Pick a color not already used
  const usedColors = new Set(settingsStore.codes.map((c) => c.color))
  const available = PRESET_COLORS.find((p) => !usedColors.has(p.color)) || PRESET_COLORS[0]
  settingsStore.addCode({ letter, color: available.color, label: available.label })
}

function codeFontColor(bgColor) {
  if (!bgColor) return '#fff'
  const hex = bgColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#1f2937' : '#ffffff'
}
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-60 flex items-end justify-center bg-black/40"
      @click.self="emit('close')"
    >
      <div class="bg-white rounded-t-2xl w-full max-w-lg max-h-[85vh] flex flex-col pb-[env(safe-area-inset-bottom)] shadow-xl">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 pt-5 pb-2 shrink-0">
          <h2 class="text-lg font-bold text-gray-800">Settings</h2>
          <button
            @click="emit('close')"
            class="p-2 -m-2 text-gray-400 active:text-gray-600"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Tabs -->
        <div class="flex px-5 pb-3 gap-1 shrink-0">
          <button
            v-for="tab in TABS"
            :key="tab.key"
            @click="activeTab = tab.key"
            class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
            :class="activeTab === tab.key
              ? 'bg-primary-500 text-white'
              : 'bg-surface-muted text-gray-500'"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- Scrollable content -->
        <div class="overflow-y-auto px-5 pb-5 space-y-6">
          <!-- Tab: Meal Codes -->
          <div v-if="activeTab === 'codes'">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Code Definitions</h3>
            <div class="space-y-3">
              <div
                v-for="(code, idx) in settingsStore.codes"
                :key="idx"
                class="bg-surface-muted rounded-xl p-3"
              >
                <div class="flex items-center gap-3 mb-2">
                  <!-- Preview swatch -->
                  <span
                    class="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    :style="{ backgroundColor: code.color, color: codeFontColor(code.color) }"
                  >
                    <span class="text-sm font-bold">{{ code.letter }}</span>
                  </span>

                  <!-- Letter input -->
                  <input
                    :value="code.letter"
                    @input="updateLetter(idx, $event)"
                    maxlength="1"
                    class="w-12 h-9 text-center text-sm font-bold uppercase bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                  />

                  <span class="flex-1" />

                  <!-- Delete -->
                  <button
                    v-if="settingsStore.codes.length > 1"
                    @click="settingsStore.removeCode(idx)"
                    class="p-2 text-gray-300 active:text-red-400"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                <!-- Color swatches -->
                <div class="flex gap-2 flex-wrap">
                  <button
                    v-for="preset in PRESET_COLORS"
                    :key="preset.color"
                    @click="updateColor(idx, preset.color, preset.label)"
                    class="w-7 h-7 rounded-full border-2 transition-transform active:scale-90"
                    :class="code.color === preset.color ? 'border-gray-800 scale-110' : 'border-transparent'"
                    :style="{ backgroundColor: preset.color }"
                    :title="preset.label"
                  />
                </div>
              </div>

              <!-- Add Code button -->
              <button
                @click="addCode"
                class="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-400 active:bg-gray-50"
              >
                + Add Code
              </button>
            </div>

          <!-- Weekly Assignment Grid -->
          <div>
            <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Weekly Assignments</h3>
            <div class="overflow-x-auto -mx-2 px-2">
              <table class="w-full min-w-[420px]">
                <thead>
                  <tr>
                    <th class="w-14" />
                    <th
                      v-for="day in DAYS"
                      :key="day"
                      class="text-[10px] font-semibold uppercase text-gray-400 pb-2 text-center"
                    >
                      {{ DAY_LABELS[day] }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="slot in SLOTS" :key="slot">
                    <td class="text-[11px] font-semibold text-gray-500 pr-2 py-1">{{ SLOT_LABELS[slot] }}</td>
                    <td
                      v-for="day in DAYS"
                      :key="day"
                      class="text-center py-1 px-0.5"
                    >
                      <button
                        @click="settingsStore.cycleAssignment(day, slot)"
                        class="w-9 h-9 rounded-lg flex items-center justify-center mx-auto transition-transform active:scale-90"
                        :style="
                          settingsStore.getCodeForSlot(day, slot)
                            ? { backgroundColor: settingsStore.getCodeForSlot(day, slot).color, color: codeFontColor(settingsStore.getCodeForSlot(day, slot).color) }
                            : { backgroundColor: '#f3f4f6' }
                        "
                      >
                        <span
                          v-if="settingsStore.getCodeForSlot(day, slot)"
                          class="text-xs font-bold"
                        >
                          {{ settingsStore.getCodeForSlot(day, slot).letter }}
                        </span>
                        <span v-else class="text-gray-300 text-[10px]">--</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="text-[10px] text-gray-400 mt-2 text-center">Tap a cell to cycle through codes</p>
          </div>
          </div>

          <!-- Tab: Categories -->
          <div v-if="activeTab === 'categories'">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Recipe Categories</h3>
            <p class="text-[10px] text-gray-400 mb-3">Reorder, add, or remove categories used in the Recipe Library</p>

            <div class="space-y-1.5 mb-3">
              <div
                v-for="(cat, idx) in settingsStore.categories"
                :key="cat.value"
                class="flex items-center gap-2 bg-surface-muted rounded-lg px-3 py-2"
              >
                <span class="text-sm text-gray-700 flex-1 truncate">{{ cat.label }}</span>
                <button
                  @click="settingsStore.moveCategory(cat.value, -1)"
                  :disabled="idx === 0"
                  class="p-1 text-gray-400 active:text-primary-500 disabled:opacity-30"
                  aria-label="Move up"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  @click="settingsStore.moveCategory(cat.value, 1)"
                  :disabled="idx === settingsStore.categories.length - 1"
                  class="p-1 text-gray-400 active:text-primary-500 disabled:opacity-30"
                  aria-label="Move down"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <button
                  @click="settingsStore.removeCategory(cat.value)"
                  class="p-1 text-red-300 active:text-red-500"
                  aria-label="Remove"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div class="flex gap-2 mb-1">
              <input
                v-model="newCategoryLabel"
                type="text"
                placeholder="New category..."
                class="flex-1 min-w-0 px-3 py-2 bg-surface-card rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                @keydown.enter.prevent="addCategory"
                @input="categoryDuplicateWarning = false"
              />
              <button
                @click="addCategory"
                class="px-3 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium shrink-0 active:scale-95 transition-transform"
              >
                Add
              </button>
            </div>
            <p v-if="categoryDuplicateWarning" class="text-amber-500 text-xs">A category with that name already exists</p>
            <p class="text-[10px] text-gray-400 mt-3">"All" is shown automatically at the end of the filter list and can't be edited.</p>
          </div>

          <!-- Tab: Flagged Ingredients -->
          <div v-if="activeTab === 'ingredients'">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Flagged Ingredients</h3>
            <p class="text-[10px] text-gray-400 mb-1">Recipes containing these ingredients will be marked Review in New Ideas</p>
            <p class="text-xs italic text-gray-400 mb-3">It does when it's being cooked by a sixty-watt bulb.</p>

            <!-- Grouped list -->
            <div class="space-y-3 mb-3">
              <div v-for="(items, category) in groupedFlagged" :key="category">
                <p class="text-[10px] font-semibold uppercase tracking-wider text-gray-300 mb-1">{{ category }}</p>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="keyword in items"
                    :key="keyword"
                    class="inline-flex items-center gap-1 bg-surface-muted text-gray-600 px-2.5 py-1 rounded-full text-xs"
                  >
                    {{ keyword }}
                    <button
                      @click="settingsStore.removeFlaggedIngredient(keyword)"
                      class="text-red-300 active:text-red-500 ml-0.5"
                    >
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                </div>
              </div>
            </div>

            <!-- Add ingredient input -->
            <div class="flex gap-2 mb-2">
              <input
                v-model="newIngredient"
                type="text"
                placeholder="Add ingredient keyword..."
                class="flex-1 px-3 py-2 bg-surface-card rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                @keydown.enter.prevent="addIngredient"
                @input="duplicateWarning = false"
              />
              <button
                @click="addIngredient"
                class="px-3 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium shrink-0 active:scale-95 transition-transform"
              >
                Add
              </button>
            </div>
            <p v-if="duplicateWarning" class="text-amber-500 text-xs mb-2">Already in list</p>

            <!-- Reset to defaults -->
            <div class="text-center mt-3">
              <button
                v-if="!showResetConfirm"
                @click="showResetConfirm = true"
                class="text-xs text-gray-400 active:text-gray-600"
              >
                Reset to defaults
              </button>
              <div v-else class="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <p class="text-xs text-amber-700 mb-2">Reset to default flagged ingredients? This will replace your current list.</p>
                <div class="flex gap-2 justify-center">
                  <button
                    @click="showResetConfirm = false"
                    class="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    @click="confirmReset"
                    class="px-3 py-1.5 text-xs font-medium text-white bg-amber-500 rounded-lg"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Tab: Cleanify Rules -->
          <div v-if="activeTab === 'cleanify'">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Cleanify Rules</h3>
            <p class="text-[10px] text-gray-400 mb-1">When saving a recipe, these ingredients will be automatically swapped</p>
            <p class="text-xs italic text-gray-400 mb-3">Did you just kill a guy with an appetizer?</p>

            <!-- Rules list -->
            <div class="space-y-1.5 mb-3">
              <div
                v-for="rule in settingsStore.cleanifyRules"
                :key="rule.from"
                class="flex items-center gap-2 bg-surface-muted rounded-lg px-3 py-2"
              >
                <span class="text-xs text-gray-500 truncate">{{ rule.from }}</span>
                <svg class="w-3 h-3 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                <span class="text-xs text-emerald-600 font-medium truncate">{{ rule.to }}</span>
                <span class="flex-1" />
                <button
                  @click="settingsStore.removeCleanifyRule(rule.from)"
                  class="text-red-300 active:text-red-500 shrink-0 p-0.5"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Add rule inputs — stacked to fit mobile -->
            <div class="space-y-2 mb-1">
              <div class="flex gap-2">
                <input
                  v-model="newRuleFrom"
                  type="text"
                  placeholder="Replace..."
                  class="flex-1 min-w-0 px-3 py-2 bg-surface-card rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                  @input="ruleDuplicateWarning = false"
                />
                <span class="text-gray-300 text-xs self-center shrink-0">with</span>
                <input
                  v-model="newRuleTo"
                  type="text"
                  placeholder="..."
                  class="flex-1 min-w-0 px-3 py-2 bg-surface-card rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                  @keydown.enter.prevent="addRule"
                  @input="ruleDuplicateWarning = false"
                />
              </div>
              <button
                @click="addRule"
                class="w-full py-2 bg-primary-500 text-white rounded-lg text-sm font-medium active:scale-[0.98] transition-transform"
              >
                Add Rule
              </button>
            </div>
            <p v-if="ruleDuplicateWarning" class="text-amber-500 text-xs mb-2">Rule already exists for that ingredient</p>

            <!-- Reset to defaults -->
            <div class="text-center mt-3">
              <button
                v-if="!showRuleResetConfirm"
                @click="showRuleResetConfirm = true"
                class="text-xs text-gray-400 active:text-gray-600"
              >
                Reset to defaults
              </button>
              <div v-else class="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <p class="text-xs text-amber-700 mb-2">Reset to default cleanify rules? This will replace your current list.</p>
                <div class="flex gap-2 justify-center">
                  <button
                    @click="showRuleResetConfirm = false"
                    class="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    @click="confirmRuleReset"
                    class="px-3 py-1.5 text-xs font-medium text-white bg-amber-500 rounded-lg"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Tab: Support -->
          <div v-if="activeTab === 'support'">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Support</h3>
            <p class="text-[10px] text-gray-400 mb-1">Found a bug or have a suggestion?</p>
            <p class="text-xs italic text-gray-400 mb-4">I've heard it both ways.</p>

            <a
              :href="supportMailto"
              class="w-full flex items-center justify-center gap-2 py-3.5 bg-primary-500 text-white rounded-xl font-semibold text-sm shadow-sm active:scale-[0.98] transition-transform"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email Support
            </a>

            <div class="mt-4 bg-surface-muted rounded-xl px-3 py-2.5">
              <p class="text-[11px] text-gray-500">
                Opens your default mail app pre-filled to <span class="font-mono text-gray-700">{{ SUPPORT_EMAIL }}</span>.
              </p>
              <p class="text-[11px] text-gray-400 mt-1">
                Tip: To send from Gmail, set it as your default mail app in
                <span class="font-medium">iOS Settings → Mail → Default Mail App → Gmail</span>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
