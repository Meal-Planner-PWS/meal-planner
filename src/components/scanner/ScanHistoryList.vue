<script setup>
import { computed } from 'vue'
import { useScannerStore } from '../../stores/scanner'

const emit = defineEmits(['select', 'scan'])

const scannerStore = useScannerStore()
const scans = computed(() => scannerStore.recentScans)

const riskDotColors = {
  safe: 'bg-emerald-400',
  moderate: 'bg-amber-400',
  avoid: 'bg-red-400'
}

const riskLabels = {
  safe: 'Safe',
  moderate: 'Moderate',
  avoid: 'Avoid'
}

function formatDate(iso) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now - d
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>

<template>
  <div>
    <div v-if="scans.length" class="space-y-2">
      <button
        v-for="scan in scans"
        :key="scan.barcode"
        @click="emit('select', scan)"
        class="w-full flex items-center gap-3 p-3 bg-surface-card rounded-xl border border-gray-100 text-left active:scale-[0.98] transition-transform"
      >
        <!-- Product thumbnail -->
        <div class="w-11 h-11 rounded-lg bg-surface-muted overflow-hidden shrink-0">
          <img
            v-if="scan.imageUrl"
            :src="scan.imageUrl"
            :alt="scan.productName"
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
          <p class="text-sm font-medium text-gray-800 truncate">{{ scan.productName }}</p>
          <div class="flex items-center gap-2 mt-0.5">
            <span v-if="scan.brand" class="text-xs text-gray-400 truncate">{{ scan.brand }}</span>
            <span class="text-xs text-gray-300">&middot;</span>
            <span class="text-xs text-gray-400">{{ formatDate(scan.scannedAt) }}</span>
          </div>
        </div>

        <!-- Risk dot + label -->
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="w-2.5 h-2.5 rounded-full" :class="riskDotColors[scan.riskLevel]" />
          <span class="text-xs font-medium" :class="{
            'text-emerald-600': scan.riskLevel === 'safe',
            'text-amber-600': scan.riskLevel === 'moderate',
            'text-red-600': scan.riskLevel === 'avoid'
          }">{{ riskLabels[scan.riskLevel] }}</span>
        </div>
      </button>
    </div>

    <!-- Empty state -->
    <div v-else class="text-center py-12">
      <svg class="w-16 h-16 mx-auto text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <p class="text-gray-400 text-lg font-medium">No scans yet</p>
      <p class="text-gray-300 text-sm mt-1">Tap the button below to scan a product</p>
      <p class="text-sm italic text-gray-400 mt-3">I don't lose things. I place things in locations which later elude me.</p>
    </div>
  </div>
</template>
