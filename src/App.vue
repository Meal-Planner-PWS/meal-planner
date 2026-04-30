<script setup>
import { ref, provide, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import BottomNav from './components/common/BottomNav.vue'
import OfflineBanner from './components/common/OfflineBanner.vue'
import InstallPrompt from './components/common/InstallPrompt.vue'
import TechSupportToast from './components/common/TechSupportToast.vue'
import { useSync } from './composables/useSync'

const route = useRoute()

// The ScannerPage syncs its view state into this ref via inject
const scannerView = ref('history')
provide('scannerViewRef', scannerView)

const hideBottomNav = computed(() => {
  return route.path === '/scanner' && scannerView.value === 'scanning'
})

// Cloud sync — hydrate from Turso on mount, listen for online/offline
const { initialSync, setupListeners } = useSync()

onMounted(() => {
  initialSync()
  setupListeners()
})
</script>

<template>
  <OfflineBanner />
  <TechSupportToast />
  <div class="flex-1 bg-surface" :class="hideBottomNav ? '' : 'pb-18'">
    <router-view />
  </div>
  <BottomNav v-if="!hideBottomNav" />
  <InstallPrompt />
</template>
