import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/planner'
  },
  {
    path: '/planner',
    name: 'Planner',
    component: () => import('../pages/PlannerPage.vue')
  },
  {
    path: '/library',
    name: 'Library',
    component: () => import('../pages/LibraryPage.vue')
  },
  {
    path: '/library/new',
    name: 'MealNew',
    component: () => import('../pages/MealFormPage.vue')
  },
  {
    path: '/library/:id/edit',
    name: 'MealEdit',
    component: () => import('../pages/MealFormPage.vue')
  },
  {
    path: '/library/:id',
    name: 'MealDetail',
    component: () => import('../pages/MealDetailPage.vue')
  },
  {
    path: '/ideas',
    name: 'Ideas',
    component: () => import('../pages/IdeasPage.vue')
  },
  {
    path: '/scanner',
    name: 'Scanner',
    component: () => import('../pages/ScannerPage.vue')
  }
]

/**
 * Scroll cache keyed by route path. We snapshot scroll on leave and restore on return —
 * this gives us scroll preservation for the Planner specifically (where it matters most)
 * without depending on browser back/forward history (PWA standalone mode loses that).
 */
const scrollCache = new Map()

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    // Honor browser back/forward saved position when present
    if (savedPosition) return savedPosition

    // For the Planner, restore the cached scroll position from when the user last left it.
    // Other routes always scroll to top.
    if (to.path === '/planner' && scrollCache.has('/planner')) {
      return { top: scrollCache.get('/planner'), left: 0 }
    }
    return { top: 0, left: 0 }
  }
})

// Capture scroll position before leaving the planner so we can restore it on return
router.beforeEach((to, from) => {
  if (from.path === '/planner') {
    scrollCache.set('/planner', window.scrollY)
  }
})

export default router
