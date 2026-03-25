import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Meal Planner',
        short_name: 'Meals',
        start_url: '/planner',
        display: 'standalone',
        background_color: '#FAFAF8',
        theme_color: '#3D6B4F',
        permissions: ['camera'],
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // SPA fallback — serve index.html for all navigation requests
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // Spoonacular API — Network First with cache fallback
            urlPattern: /^https:\/\/api\.spoonacular\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'spoonacular-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 }
            }
          },
          {
            // Open Food Facts API — StaleWhileRevalidate
            urlPattern: /^https:\/\/world\.openfoodfacts\.org\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'openfoodfacts-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 604800 }
            }
          },
          {
            // Spoonacular recipe images — Cache First
            urlPattern: /^https:\/\/img\.spoonacular\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'spoonacular-images',
              expiration: { maxEntries: 100, maxAgeSeconds: 2592000 }
            }
          },
          {
            // Open Food Facts product images — Cache First
            urlPattern: /^https:\/\/images\.openfoodfacts\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'openfoodfacts-images',
              expiration: { maxEntries: 50, maxAgeSeconds: 2592000 }
            }
          }
        ]
      }
    })
  ]
})
