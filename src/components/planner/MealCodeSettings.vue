<script setup>
import { useSettingsStore } from '../../stores/settings'

const emit = defineEmits(['close'])
const settingsStore = useSettingsStore()

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
        <div class="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h2 class="text-lg font-bold text-gray-800">Meal Codes</h2>
          <button
            @click="emit('close')"
            class="p-2 -m-2 text-gray-400 active:text-gray-600"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Scrollable content -->
        <div class="overflow-y-auto px-5 pb-5 space-y-6">
          <!-- Section A: Code Definitions -->
          <div>
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
          </div>

          <!-- Section B: Weekly Assignment Grid -->
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
      </div>
    </div>
  </Teleport>
</template>
