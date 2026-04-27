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

const router = createRouter({
  history: createWebHistory(),
  routes,
  // Reset scroll on every navigation (including back/forward) so pages
  // always start at the top instead of mid-page.
  scrollBehavior() {
    return { top: 0, left: 0 }
  }
})

export default router
