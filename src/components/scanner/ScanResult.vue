<script setup>
import { computed, ref } from 'vue'
import { useScannerStore } from '../../stores/scanner'

const emit = defineEmits(['scan-again', 'back'])

const scannerStore = useScannerStore()

const scan = computed(() => scannerStore.currentScan)
const alternatives = computed(() => scannerStore.alternatives)
const alternativesLoading = computed(() => scannerStore.alternativesLoading)

const showAllAdditives = ref(false)

const riskConfig = {
  safe: {
    label: 'All Clear',
    color: 'bg-emerald-500',
    bgLight: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    icon: 'check'
  },
  moderate: {
    label: 'Worth Knowing',
    color: 'bg-amber-500',
    bgLight: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    icon: 'info'
  },
  avoid: {
    label: 'Contains Additives to Avoid',
    color: 'bg-red-500',
    bgLight: 'bg-red-50',
    textColor: 'text-red-700',
    borderColor: 'border-red-200',
    icon: 'alert'
  }
}

const risk = computed(() => riskConfig[scan.value?.riskLevel] || riskConfig.safe)

const additiveRiskChipColors = {
  avoid: 'bg-red-100 text-red-700',
  moderate: 'bg-amber-100 text-amber-700'
}

const visibleAdditives = computed(() => {
  const all = scan.value?.flaggedAdditives || []
  return showAllAdditives.value ? all : all.slice(0, 3)
})

const hasMore = computed(() => {
  return (scan.value?.flaggedAdditives?.length || 0) > 3
})
</script>

<template>
  <div v-if="scan" class="pb-6">
    <!-- Product image -->
    <div v-if="scan.imageUrl" class="w-full h-48 bg-surface-muted">
      <img :src="scan.imageUrl" :alt="scan.productName" class="w-full h-full object-contain bg-white" width="400" height="400" />
    </div>

    <div class="p-4">
      <!-- Product name & brand -->
      <h2 class="text-xl font-bold text-gray-800">{{ scan.productName }}</h2>
      <p v-if="scan.brand" class="text-sm text-gray-400 mt-0.5">{{ scan.brand }}</p>

      <!-- Risk badge -->
      <div
        class="mt-4 rounded-xl p-4 border"
        :class="[risk.bgLight, risk.borderColor]"
      >
        <div class="flex items-center gap-3">
          <!-- Check icon -->
          <div v-if="risk.icon === 'check'" class="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <!-- Info icon -->
          <div v-if="risk.icon === 'info'" class="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <!-- Alert icon -->
          <div v-if="risk.icon === 'alert'" class="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center shrink-0">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <p class="font-bold" :class="risk.textColor">{{ risk.label }}</p>
            <p v-if="scan.flaggedAdditives?.length" class="text-xs mt-0.5" :class="risk.textColor" style="opacity: 0.7">
              {{ scan.flaggedAdditives.length }} additive{{ scan.flaggedAdditives.length === 1 ? '' : 's' }} flagged
            </p>
          </div>
        </div>
      </div>

      <!-- Flagged additives list -->
      <div v-if="scan.flaggedAdditives?.length" class="mt-4">
        <h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Flagged Additives</h3>
        <div class="space-y-2">
          <div
            v-for="additive in visibleAdditives"
            :key="additive.code"
            class="bg-surface-card rounded-xl p-3 border border-gray-100"
          >
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs font-mono font-bold text-gray-500">{{ additive.code.replace('en:', '').toUpperCase() }}</span>
              <span class="text-sm font-semibold text-gray-800">{{ additive.name }}</span>
              <span
                class="ml-auto text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                :class="additiveRiskChipColors[additive.risk] || 'bg-gray-100 text-gray-600'"
              >
                {{ additive.risk }}
              </span>
            </div>
            <p class="text-xs text-gray-500 leading-relaxed">{{ additive.description }}</p>
          </div>
        </div>

        <button
          v-if="hasMore"
          @click="showAllAdditives = !showAllAdditives"
          class="mt-2 text-sm text-primary-500 font-medium"
        >
          {{ showAllAdditives ? 'Show less' : `Show all ${scan.flaggedAdditives.length} additives` }}
        </button>
      </div>

      <!-- Healthier alternatives -->
      <div v-if="scan.riskLevel !== 'safe'" class="mt-5">
        <h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Healthier Alternatives</h3>

        <div v-if="alternativesLoading" class="space-y-2">
          <div v-for="n in 2" :key="n" class="bg-surface-card rounded-xl p-3 border border-gray-100 animate-pulse">
            <div class="h-4 bg-surface-muted rounded w-2/3 mb-1" />
            <div class="h-3 bg-surface-muted rounded w-1/3" />
          </div>
        </div>

        <div v-else-if="alternatives.length" class="space-y-2">
          <div
            v-for="alt in alternatives"
            :key="alt.name"
            class="bg-surface-card rounded-xl p-3 border border-gray-100 flex items-center gap-3"
          >
            <div class="w-10 h-10 rounded-lg bg-surface-muted overflow-hidden shrink-0">
              <img v-if="alt.imageUrl" :src="alt.imageUrl" :alt="alt.name" class="w-full h-full object-cover" />
              <div v-else class="w-full h-full flex items-center justify-center">
                <svg class="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-800 truncate">{{ alt.name }}</p>
              <p v-if="alt.brand" class="text-xs text-gray-400 truncate">{{ alt.brand }}</p>
            </div>
            <div class="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" title="Safer option" />
          </div>
        </div>

        <p v-else class="text-xs text-gray-400">No alternatives found in this category.</p>
      </div>

      <!-- Actions -->
      <div class="mt-6 space-y-2">
        <button
          @click="emit('scan-again')"
          class="w-full py-3.5 bg-primary-500 text-white rounded-xl font-semibold text-sm active:scale-[0.98] transition-transform"
        >
          Scan Another
        </button>
        <button
          @click="emit('back')"
          class="w-full py-3 text-gray-500 text-sm font-medium"
        >
          Back to History
        </button>
      </div>
    </div>
  </div>
</template>
