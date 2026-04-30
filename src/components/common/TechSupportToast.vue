<script setup>
import { ref, onMounted } from 'vue'

const SESSION_KEY = 'mp_tech_support_shown'
const show = ref(false)

onMounted(() => {
  // Only show once per browser session
  if (sessionStorage.getItem(SESSION_KEY) === '1') return
  sessionStorage.setItem(SESSION_KEY, '1')

  // Slight delay so it doesn't compete with first paint
  setTimeout(() => {
    show.value = true
    // Auto-dismiss after 6 seconds
    setTimeout(() => { show.value = false }, 6000)
  }, 500)
})

function dismiss() {
  show.value = false
}
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="-translate-y-full opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition-all duration-300 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="-translate-y-full opacity-0"
  >
    <div
      v-if="show"
      @click="dismiss"
      class="fixed top-0 left-0 right-0 z-40 px-4 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 pointer-events-auto cursor-pointer"
    >
      <div class="max-w-md mx-auto bg-primary-500 text-white rounded-xl shadow-lg px-4 py-2.5 flex items-center gap-2">
        <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636A9 9 0 11 5.636 18.364 9 9 0 0118.364 5.636zM12 8v4l3 2" />
        </svg>
        <p class="text-xs italic flex-1">
          24/7 tech support — except when we're working, sleeping, eating, or have other plans.
        </p>
      </div>
    </div>
  </Transition>
</template>
