<script setup>
import { ref, inject, watch, onUnmounted } from 'vue'
import { useScannerStore } from '../stores/scanner'
import CameraView from '../components/scanner/CameraView.vue'
import ScanResult from '../components/scanner/ScanResult.vue'
import ScanHistoryList from '../components/scanner/ScanHistoryList.vue'

const scannerStore = useScannerStore()

// Views: 'history' | 'scanning' | 'loading' | 'result' | 'error'
const view = ref('history')

// Sync view state with App.vue so it can hide the bottom nav during scanning
const scannerViewRef = inject('scannerViewRef', ref('history'))
watch(view, (val) => { scannerViewRef.value = val }, { immediate: true })
onUnmounted(() => { scannerViewRef.value = 'history' })

function startScan() {
  scannerStore.clearCurrentScan()
  scannerStore.error = null
  view.value = 'scanning'
}

async function onBarcodeDetected(barcode) {
  view.value = 'loading'
  await scannerStore.lookupBarcode(barcode)

  if (scannerStore.error === 'not_found') {
    view.value = 'error'
  } else if (scannerStore.error) {
    view.value = 'error'
  } else {
    view.value = 'result'
  }
}

function onCameraCancel() {
  view.value = 'history'
}

function scanAgain() {
  scannerStore.clearCurrentScan()
  scannerStore.error = null
  view.value = 'scanning'
}

function backToHistory() {
  scannerStore.clearCurrentScan()
  scannerStore.error = null
  view.value = 'history'
}

function selectHistoryItem(scan) {
  scannerStore.setCurrentScan(scan)
  // Fetch alternatives in background if risky
  if (scan.riskLevel !== 'safe' && scan.categoriesTags?.length) {
    scannerStore.fetchAlternatives(scan.categoriesTags)
  }
  view.value = 'result'
}

function clearAllHistory() {
  scannerStore.clearHistory()
}
</script>

<template>
  <!-- Camera fullscreen view (no padding, no bottom nav) -->
  <CameraView
    v-if="view === 'scanning'"
    @detected="onBarcodeDetected"
    @cancel="onCameraCancel"
  />

  <!-- Loading state -->
  <div v-else-if="view === 'loading'" class="p-4 flex flex-col items-center justify-center min-h-[60dvh]">
    <div class="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mb-4" />
    <p class="text-gray-500 text-sm">Looking up product...</p>
  </div>

  <!-- Error state -->
  <div v-else-if="view === 'error'" class="p-4">
    <div class="flex flex-col items-center justify-center min-h-[50dvh] text-center">
      <div v-if="scannerStore.error === 'not_found'" class="mb-6">
        <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 class="text-lg font-bold text-gray-800 mb-1">Product Not Found</h2>
        <p class="text-sm text-gray-400">This barcode isn't in the Open Food Facts database yet.</p>
      </div>

      <div v-else-if="scannerStore.error === 'offline'" class="mb-6">
        <div class="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414" />
          </svg>
        </div>
        <h2 class="text-lg font-bold text-gray-800 mb-1">No Connection</h2>
        <p class="text-sm text-gray-400">This product hasn't been scanned before so we can't look it up right now.</p>
      </div>

      <div v-else class="mb-6">
        <div class="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 class="text-lg font-bold text-gray-800 mb-1">Something Went Wrong</h2>
        <p class="text-sm text-gray-400">Couldn't look up this product right now. Please try again.</p>
      </div>

      <div class="flex gap-3 w-full max-w-xs">
        <button
          @click="scanAgain"
          class="flex-1 py-3 bg-primary-500 text-white rounded-xl font-semibold text-sm active:scale-[0.98] transition-transform"
        >
          Scan Again
        </button>
        <button
          @click="backToHistory"
          class="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm active:scale-[0.98] transition-transform"
        >
          History
        </button>
      </div>
    </div>
  </div>

  <!-- Result view -->
  <div v-else-if="view === 'result'">
    <ScanResult
      @scan-again="scanAgain"
      @back="backToHistory"
    />
  </div>

  <!-- History view (default) -->
  <div v-else class="p-4">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-gray-800">Scanner</h1>
      <button
        v-if="scannerStore.recentScans.length"
        @click="clearAllHistory"
        class="text-xs text-gray-400 font-medium"
      >
        Clear All
      </button>
    </div>

    <ScanHistoryList
      @select="selectHistoryItem"
      @scan="startScan"
    />

    <!-- Scan button — positioned above bottom nav + safe area -->
    <div class="fixed bottom-24 left-0 right-0 px-4 pb-[env(safe-area-inset-bottom)] z-40">
      <button
        @click="startScan"
        class="w-full py-3.5 bg-primary-500 text-white rounded-xl font-semibold text-sm shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Scan Barcode
      </button>
    </div>
  </div>
</template>
