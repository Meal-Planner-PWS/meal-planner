import { ref } from 'vue'
import axios from 'axios'

const FUNCTIONS_BASE = '/.netlify/functions'
const QUEUE_KEY = 'mp_sync_queue'

const syncing = ref(false)
const lastSyncError = ref(null)

/**
 * Manages sync lifecycle between localStorage (offline buffer) and Turso (via Netlify functions).
 *
 * Flow:
 * 1. On app mount → initialSync() fetches server data and merges into Pinia stores
 * 2. On every store write → queueChange() adds to localStorage queue
 * 3. When online → flushQueue() sends queued changes to /sync endpoint
 * 4. Listens to online/offline events to trigger/pause sync
 */
export function useSync() {
  /** Fetch latest data from server and hydrate Pinia stores */
  async function initialSync() {
    if (!navigator.onLine) return

    // Import stores lazily to avoid circular deps
    const { useMealStore } = await import('../stores/meals')
    const { usePlannerStore } = await import('../stores/planner')
    const { useScannerStore } = await import('../stores/scanner')
    const { useSettingsStore } = await import('../stores/settings')

    const mealStore = useMealStore()
    const plannerStore = usePlannerStore()
    const scannerStore = useScannerStore()
    const settingsStore = useSettingsStore()

    try {
      // Flush any pending offline changes first so server has latest
      await flushQueue()

      // Fetch all data from server in parallel
      const [mealsRes, plannerRes, scansRes, settingsRes] = await Promise.all([
        axios.get(`${FUNCTIONS_BASE}/meals`).catch(() => ({ data: null })),
        axios.get(`${FUNCTIONS_BASE}/planner`, {
          params: { weekStart: plannerStore.currentWeekStart }
        }).catch(() => ({ data: null })),
        axios.get(`${FUNCTIONS_BASE}/scanner`).catch(() => ({ data: null })),
        axios.get(`${FUNCTIONS_BASE}/settings`).catch(() => ({ data: null }))
      ])

      // Merge meals — server list is lightweight (no ingredients/instructions/notes/sourceUrl).
      // Photos are now URL-only (Netlify Blobs), so server is authoritative for photo too.
      // Preserve local detail fields (loaded via fetchMealDetail) since they aren't in the list.
      if (Array.isArray(mealsRes.data) && mealsRes.data.length > 0) {
        const localMap = new Map(mealStore.meals.map((m) => [m.id, m]))
        const merged = mealsRes.data.map((serverMeal) => {
          const local = localMap.get(serverMeal.id)
          if (local) {
            // Server wins for all fields it provides (incl. photo URL).
            // Local-only fields (ingredients, instructions, etc.) are preserved.
            return { ...local, ...serverMeal }
          }
          // New from server — fill in missing detail fields with defaults
          return {
            ingredients: [], instructions: '', notes: '', sourceUrl: '',
            createdAt: serverMeal.updatedAt || new Date().toISOString(),
            ...serverMeal
          }
        })
        // Keep local-only meals (not yet synced to server)
        const serverIds = new Set(mealsRes.data.map((m) => m.id))
        const localOnly = mealStore.meals.filter((m) => !serverIds.has(m.id))
        mealStore.meals = [...merged, ...localOnly]
      }

      // Merge planner slots + day notes for current week
      if (plannerRes.data && (Array.isArray(plannerRes.data.slots) || Array.isArray(plannerRes.data))) {
        plannerStore.ensureWeekExists(plannerStore.currentWeekStart)
        const week = plannerStore.weekPlans[plannerStore.currentWeekStart]
        // New shape: { slots, notes }. Legacy shape: just an array of slots.
        const slotsArr = Array.isArray(plannerRes.data) ? plannerRes.data : (plannerRes.data.slots || [])
        for (const slot of slotsArr) {
          const dayData = week.days[slot.day]
          if (!dayData || slot.slotType === 'snack') continue
          if (slot.entry) {
            dayData[slot.slotType] = slot.entry
          } else if (Array.isArray(slot.mealIds) && slot.mealIds.length > 0) {
            // Legacy data — wrap in MealEntry shape with empty text
            dayData[slot.slotType] = { text: '', recipeIds: slot.mealIds, helperIds: [], prepTasks: [] }
          } else {
            dayData[slot.slotType] = null
          }
        }
        const notesArr = (plannerRes.data && plannerRes.data.notes) || []
        for (const n of notesArr) {
          if (week.days[n.day]) week.days[n.day].notes = n.notes || ''
        }
      }

      // Merge scan history — server is authoritative for overlap
      if (Array.isArray(scansRes.data) && scansRes.data.length > 0) {
        const serverBarcodes = new Set(scansRes.data.map((s) => s.barcode))
        const localOnly = scannerStore.scanHistory.filter((s) => !serverBarcodes.has(s.barcode))
        scannerStore.scanHistory = [...scansRes.data, ...localOnly].slice(0, 20)
      }

      // Merge settings — server wins if present
      if (settingsRes.data && typeof settingsRes.data === 'object') {
        if (Array.isArray(settingsRes.data.codes) && settingsRes.data.codes.length > 0) {
          settingsStore.codes = settingsRes.data.codes
        }
        if (settingsRes.data.assignments && typeof settingsRes.data.assignments === 'object') {
          settingsStore.assignments = settingsRes.data.assignments
        }
        if (Array.isArray(settingsRes.data.flagged_ingredients) && settingsRes.data.flagged_ingredients.length > 0) {
          settingsStore.flaggedIngredients = settingsRes.data.flagged_ingredients
        }
        if (Array.isArray(settingsRes.data.cleanify_rules) && settingsRes.data.cleanify_rules.length > 0) {
          settingsStore.cleanifyRules = settingsRes.data.cleanify_rules
        }
        if (Array.isArray(settingsRes.data.categories) && settingsRes.data.categories.length > 0) {
          settingsStore.categories = settingsRes.data.categories
        }
      }

      lastSyncError.value = null
    } catch (err) {
      console.warn('[sync] initialSync failed:', err.message)
      lastSyncError.value = err.message
    }
  }

  /**
   * Add a pending change to the localStorage queue.
   * @param {'meal_upsert'|'meal_delete'|'slot_upsert'|'slot_delete'|'scan_upsert'|'scan_delete_all'|'settings_upsert'} type
   * @param {Object} data - The data payload for this change
   */
  let flushTimer = null

  function queueChange(type, data) {
    const queue = getQueue()
    queue.push({ type, data, timestamp: Date.now() })
    saveQueue(queue)

    // Debounce auto-flush — batch rapid mutations (e.g. clearWeek queues 28 slots)
    if (navigator.onLine && !flushTimer) {
      flushTimer = setTimeout(() => {
        flushTimer = null
        flushQueue()
      }, 500)
    }
  }

  /** Send all queued changes to the sync endpoint, clear queue on success */
  async function flushQueue() {
    const queue = getQueue()
    if (queue.length === 0) return
    if (syncing.value) return

    syncing.value = true

    try {
      // Group queue items by type into the sync payload
      const meals = []
      const plannerSlots = []
      const dayNotes = []
      const scans = []
      const settings = []

      for (const item of queue) {
        switch (item.type) {
          case 'meal_upsert':
            meals.push({ action: 'upsert', data: item.data })
            break
          case 'meal_delete':
            meals.push({ action: 'delete', id: item.data.id })
            break
          case 'slot_upsert':
            plannerSlots.push({ action: 'upsert', data: item.data })
            break
          case 'slot_delete':
            plannerSlots.push({ action: 'delete', ...item.data })
            break
          case 'day_notes_upsert':
            dayNotes.push({ action: 'upsert', data: item.data })
            break
          case 'scan_upsert':
            scans.push({ action: 'upsert', data: item.data })
            break
          case 'scan_delete_all':
            scans.push({ action: 'delete_all' })
            break
          case 'settings_upsert':
            settings.push({ action: 'upsert', data: item.data })
            break
        }
      }

      await axios.post(`${FUNCTIONS_BASE}/sync`, { meals, plannerSlots, dayNotes, scans, settings })

      // Clear queue on success
      saveQueue([])
      lastSyncError.value = null
    } catch (err) {
      lastSyncError.value = err.message
      // Queue persists — will retry on next online event
    } finally {
      syncing.value = false
    }
  }

  /** Set up online/offline listeners */
  function setupListeners() {
    window.addEventListener('online', () => {
      flushQueue()
    })
  }

  return {
    syncing,
    lastSyncError,
    initialSync,
    queueChange,
    flushQueue,
    setupListeners
  }
}

function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}
