<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const isOffline = ref(!navigator.onLine)

function goOffline() {
  isOffline.value = true
}

function goOnline() {
  isOffline.value = false
}

onMounted(() => {
  window.addEventListener('offline', goOffline)
  window.addEventListener('online', goOnline)
})

onUnmounted(() => {
  window.removeEventListener('offline', goOffline)
  window.removeEventListener('online', goOnline)
})
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="-translate-y-full opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="-translate-y-full opacity-0"
  >
    <div
      v-if="isOffline"
      class="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-center py-2 px-4 text-xs font-medium pt-[calc(0.5rem+env(safe-area-inset-top))]"
    >
      You're offline — saved data still available
    </div>
  </Transition>
</template>
