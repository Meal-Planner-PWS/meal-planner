<script setup>
import { ref } from 'vue'

const props = defineProps({
  ingredients: { type: Array, required: true }
})

const emit = defineEmits(['add', 'remove', 'clear'])

const input = ref('')

function handleAdd() {
  const raw = input.value
  // Support comma-separated entry
  const parts = raw.split(',')
  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed) {
      emit('add', trimmed)
    }
  }
  input.value = ''
}

function handleKeydown(e) {
  // Also add on comma key
  if (e.key === ',') {
    e.preventDefault()
    handleAdd()
  }
}
</script>

<template>
  <div>
    <label class="block text-sm font-medium text-gray-700 mb-1.5">What ingredients do you have?</label>
    <div class="flex gap-2 mb-2.5">
      <input
        v-model="input"
        type="text"
        placeholder=""
        class="flex-1 px-4 py-3 bg-surface-card rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
        @keydown.enter.prevent="handleAdd"
        @keydown="handleKeydown"
      />
      <button
        type="button"
        @click="handleAdd"
        :disabled="!input.trim()"
        class="px-4 py-3 bg-primary-500 text-white rounded-xl text-sm font-medium shrink-0 active:scale-95 transition-transform disabled:opacity-40 disabled:active:scale-100"
      >
        Add
      </button>
    </div>

    <!-- Tags -->
    <div v-if="ingredients.length" class="flex flex-wrap gap-2">
      <span
        v-for="ing in ingredients"
        :key="ing"
        class="inline-flex items-center gap-1 bg-primary-100 text-primary-700 px-3 py-1.5 rounded-full text-sm"
      >
        {{ ing }}
        <button
          type="button"
          @click="emit('remove', ing)"
          class="text-primary-500 hover:text-primary-700 ml-0.5"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </span>

      <button
        type="button"
        @click="emit('clear')"
        class="text-xs text-gray-400 px-2 py-1.5 hover:text-gray-600"
      >
        Clear all
      </button>
    </div>
  </div>
</template>
