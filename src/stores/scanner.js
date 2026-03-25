import { defineStore } from 'pinia'
import axios from 'axios'
import { classifyAdditives } from '../utils/additiveRisk'
import { useSync } from '../composables/useSync'

const OFF_PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product'
const OFF_SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl'

export const useScannerStore = defineStore('scanner', {
  state: () => ({
    scanHistory: [],
    currentScan: null,
    alternatives: [],
    loading: false,
    alternativesLoading: false,
    error: null
  }),

  getters: {
    recentScans: (state) => {
      return state.scanHistory.slice(0, 20)
    },

    getScanByBarcode: (state) => (barcode) => {
      return state.scanHistory.find((s) => s.barcode === barcode)
    }
  },

  actions: {
    addScan(scan) {
      // Remove existing scan of same barcode to avoid duplicates
      this.scanHistory = this.scanHistory.filter((s) => s.barcode !== scan.barcode)

      this.scanHistory.unshift({
        barcode: scan.barcode,
        productName: scan.productName || 'Unknown Product',
        brand: scan.brand || '',
        imageUrl: scan.imageUrl || '',
        riskLevel: scan.riskLevel || 'safe',
        flaggedAdditives: scan.flaggedAdditives || [],
        categoriesTags: scan.categoriesTags || [],
        scannedAt: new Date().toISOString(),
        rawData: scan.rawData || {}
      })

      // Keep only last 20
      if (this.scanHistory.length > 20) {
        this.scanHistory = this.scanHistory.slice(0, 20)
      }

      useSync().queueChange('scan_upsert', this.scanHistory[0])
    },

    /** Look up a barcode — returns cached result or null */
    getCachedScan(barcode) {
      return this.scanHistory.find((s) => s.barcode === barcode) || null
    },

    setCurrentScan(scan) {
      this.currentScan = scan
    },

    clearCurrentScan() {
      this.currentScan = null
      this.alternatives = []
    },

    clearHistory() {
      this.scanHistory = []
      useSync().queueChange('scan_delete_all', {})
    },

    /** Fetch product from Open Food Facts and classify additives */
    async lookupBarcode(barcode) {
      // Check cache first
      const cached = this.getCachedScan(barcode)
      if (cached) {
        this.currentScan = cached
        // Fetch alternatives in background if risky
        if (cached.riskLevel !== 'safe') {
          this.fetchAlternatives(cached.categoriesTags)
        }
        return
      }

      this.loading = true
      this.error = null

      try {
        const response = await axios.get(`${OFF_PRODUCT_URL}/${barcode}.json`)

        if (response.data.status === 0) {
          this.error = 'not_found'
          this.loading = false
          return
        }

        const product = response.data.product || {}
        const additiveTags = product.additives_tags || []
        const { flagged, overallRisk } = classifyAdditives(additiveTags)

        const scanData = {
          barcode,
          productName: product.product_name || 'Unknown Product',
          brand: product.brands || '',
          imageUrl: product.image_url || '',
          riskLevel: overallRisk,
          flaggedAdditives: flagged,
          categoriesTags: product.categories_tags || [],
          rawData: product
        }

        this.addScan(scanData)
        this.currentScan = scanData

        // Fetch alternatives if risky
        if (overallRisk !== 'safe' && scanData.categoriesTags.length) {
          this.fetchAlternatives(scanData.categoriesTags)
        }
      } catch (err) {
        if (!navigator.onLine) {
          this.error = 'offline'
        } else {
          this.error = 'network'
        }
      } finally {
        this.loading = false
      }
    },

    /** Fetch healthier alternatives from the same category */
    async fetchAlternatives(categoriesTags) {
      if (!categoriesTags?.length) return

      this.alternatives = []
      this.alternativesLoading = true

      try {
        // Use the first (most specific) category tag
        const category = categoriesTags[categoriesTags.length - 1]

        const response = await axios.get(OFF_SEARCH_URL, {
          params: {
            action: 'process',
            tagtype_0: 'categories',
            tag_contains_0: 'contains',
            tag_0: category,
            sort_by: 'unique_scans_n',
            page_size: 10,
            json: 1
          }
        })

        const products = response.data.products || []

        // Filter to products with no "avoid" additives and show up to 3
        const safe = []
        for (const p of products) {
          if (safe.length >= 3) break
          const tags = p.additives_tags || []
          const { overallRisk } = classifyAdditives(tags)
          if (overallRisk !== 'avoid' && p.product_name) {
            safe.push({
              name: p.product_name,
              brand: p.brands || '',
              imageUrl: p.image_url || '',
              riskLevel: overallRisk
            })
          }
        }

        this.alternatives = safe
      } catch {
        // Silently skip alternatives if offline or error
        this.alternatives = []
      } finally {
        this.alternativesLoading = false
      }
    }
  },

  persist: {
    // Don't persist alternatives or loading state
    pick: ['scanHistory']
  }
})
