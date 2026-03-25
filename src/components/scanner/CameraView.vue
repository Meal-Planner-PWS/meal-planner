<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useBarcodeScanner } from '../../composables/useBarcodeScanner'

const emit = defineEmits(['detected', 'cancel'])

const { scanning, error, permissionDenied, startScanning, stopScanning } = useBarcodeScanner()

const videoRef = ref(null)

onMounted(async () => {
  if (videoRef.value) {
    await startScanning(videoRef.value, (barcode) => {
      emit('detected', barcode)
    })
  }
})

onBeforeUnmount(() => {
  stopScanning()
})

function handleCancel() {
  stopScanning()
  emit('cancel')
}
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black flex flex-col">
    <!-- Camera permission denied -->
    <div v-if="permissionDenied" class="flex-1 flex flex-col items-center justify-center px-6 text-center">
      <div class="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
        <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      </div>
      <h2 class="text-lg font-bold text-white mb-2">Camera Access Needed</h2>
      <p class="text-sm text-gray-400 mb-6">
        To scan barcodes, allow camera access in your browser settings. On iOS, go to Settings &gt; Safari &gt; Camera. On Android, tap the lock icon in the address bar.
      </p>
      <button
        @click="handleCancel"
        class="px-6 py-3 bg-white/10 text-white rounded-xl text-sm font-medium"
      >
        Go Back
      </button>
    </div>

    <!-- Other error -->
    <div v-else-if="error && !scanning" class="flex-1 flex flex-col items-center justify-center px-6 text-center">
      <div class="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
        <svg class="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <h2 class="text-lg font-bold text-white mb-2">Camera Error</h2>
      <p class="text-sm text-gray-400 mb-6">{{ error }}</p>
      <button
        @click="handleCancel"
        class="px-6 py-3 bg-white/10 text-white rounded-xl text-sm font-medium"
      >
        Go Back
      </button>
    </div>

    <!-- Camera viewfinder -->
    <template v-else>
      <video
        ref="videoRef"
        class="flex-1 object-cover"
        autoplay
        playsinline
        muted
      />

      <!-- Scanning overlay -->
      <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <!-- Viewfinder frame -->
        <div class="w-64 h-40 border-2 border-white/60 rounded-2xl relative">
          <!-- Corner accents -->
          <div class="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-3 border-l-3 border-white rounded-tl-xl" />
          <div class="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-3 border-r-3 border-white rounded-tr-xl" />
          <div class="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-3 border-l-3 border-white rounded-bl-xl" />
          <div class="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-3 border-r-3 border-white rounded-br-xl" />

          <!-- Scanning line animation -->
          <div class="absolute left-4 right-4 h-0.5 bg-primary-400/80 top-1/2 animate-pulse" />
        </div>
        <p class="text-white/70 text-sm mt-4">Point at a barcode</p>
      </div>

      <!-- Cancel button -->
      <div class="absolute bottom-0 left-0 right-0 pb-[env(safe-area-inset-bottom)] p-6">
        <button
          @click="handleCancel"
          class="w-full py-3.5 bg-white/10 backdrop-blur-sm text-white rounded-xl font-semibold text-sm pointer-events-auto"
        >
          Cancel
        </button>
      </div>
    </template>
  </div>
</template>
