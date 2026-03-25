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
  routes
})

export default router
