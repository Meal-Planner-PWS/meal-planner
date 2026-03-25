<script setup>
import { ref, onMounted } from 'vue'

const show = ref(false)
let deferredPrompt = null

const VISIT_COUNT_KEY = 'mp_visit_count'
const DISMISSED_KEY = 'mp_install_dismissed'

onMounted(() => {
  // Already installed in standalone mode — never show
  if (window.matchMedia('(display-mode: standalone)').matches) return

  // User already dismissed — never show again
  if (localStorage.getItem(DISMISSED_KEY) === 'true') return

  // Track visit count
  const count = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10) + 1
  localStorage.setItem(VISIT_COUNT_KEY, String(count))

  // Only show after 3rd visit
  if (count < 3) return

  // Listen for the browser's install prompt event
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    show.value = true
  })
})

async function install() {
  if (!deferredPrompt) return
  deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null
  show.value = false
  if (outcome === 'dismissed') {
    localStorage.setItem(DISMISSED_KEY, 'true')
  }
}

function dismiss() {
  show.value = false
  localStorage.setItem(DISMISSED_KEY, 'true')
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-transform duration-300 ease-out"
      enter-from-class="translate-y-full"
      enter-to-class="translate-y-0"
      leave-active-class="transition-transform duration-200 ease-in"
      leave-from-class="translate-y-0"
      leave-to-class="translate-y-full"
    >
      <div
        v-if="show"
        class="fixed bottom-20 left-3 right-3 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <div class="flex items-start gap-3">
          <img src="/icons/icon-192x192.png" alt="Meal Planner" class="w-12 h-12 rounded-xl shrink-0" width="48" height="48" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-800">Add Meal Planner to your home screen</p>
            <p class="text-xs text-gray-400 mt-0.5">For the best experience with offline access</p>
          </div>
        </div>
        <div class="flex gap-2 mt-3">
          <button
            @click="dismiss"
            class="flex-1 py-2.5 text-sm font-medium text-gray-500 bg-gray-100 rounded-xl"
          >
            Not Now
          </button>
          <button
            @click="install"
            class="flex-1 py-2.5 text-sm font-semibold text-white bg-primary-500 rounded-xl"
          >
            Install
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
