# Meal Planner PWA — Full Architecture Plan

---

## 1. App Overview

A mobile-first Progressive Web App built for personal use. Designed around one user's workflow: managing a library of trusted recipes, planning the week ahead, discovering new meals by available ingredients, and scanning grocery products for additive safety.

**Primary user:** Wife  
**Access:** PWA installed on phone (home screen icon, full-screen, offline-capable)  
**Stack:** Vue 3 + Vite + Tailwind CSS
**Backend:** Netlify serverless functions (API proxy) + Turso (cloud SQLite)
**External APIs:** Spoonacular (ingredient-to-recipe), Open Food Facts (barcode/additive)

---

## 2. Navigation Structure

Persistent bottom navigation bar — 4 tabs, always visible:

```
[ 📅 Planner ]  [ 🍽️ Library ]  [ 💡 New Ideas ]  [ 📷 Scanner ]
```

Each tab is a top-level route. No nested navigation deeper than 2 levels.

---

## 3. Pages & Features

### 3.1 📅 Weekly Planner (`/planner`)

**Purpose:** The home screen. Plan the full week at a glance.

**Layout:**
- 7 day sections stacked vertically (Mon–Sun)
- Each day expands to show meal slots: Breakfast, Lunch, Dinner, Snack
- Current day auto-scrolls into view on load

**Meal Slot Interactions:**
- Tap empty slot → opens Meal Picker (search/browse Library)
- Tap filled slot → options: Edit, Swap, Remove
- Swap: select source slot → tap destination slot → meals exchange
- Long-press slot → drag-to-reorder within same day (stretch goal)

**Additional Features:**
- "Clear Week" button with confirmation
- "Copy to next week" shortcut
- Each slot shows meal name + optional small thumbnail

---

### 3.2 🍽️ Meal Library (`/library`)

**Purpose:** The master list of all saved recipes. Her go-to meals live here.

**Layout:**
- Search bar (filters in real-time)
- Filter chips: All / Favorites / Breakfast / Lunch / Dinner / Snack
- Card grid (2 col on mobile) or list toggle
- Favorites bubble to the top (star icon on each card)

**Meal Card:**
- Name
- Category tag (breakfast/lunch/dinner/snack)
- Favorite star (toggle)
- Tap → opens Meal Detail page

**Meal Detail (`/library/:id`):**
- Name, category, notes/description
- Ingredients list
- Instructions (freeform text or numbered steps)
- Link to source (optional URL)
- "Add to Planner" shortcut → opens week view to pick a slot
- Edit / Delete actions

**Add/Edit Meal (`/library/new`, `/library/:id/edit`):**
- Form: name, category, ingredients (tag-style input), instructions, source URL, notes
- Photo upload (stored as base64 or blob URL in localStorage)

---

### 3.3 💡 New Ideas (`/ideas`)

**Purpose:** Discover new recipes based on what's on hand.

**Flow:**
1. User types in available ingredients (tag-style input — type + Enter to add)
2. Tap "Find Recipes" → calls Spoonacular `findByIngredients` endpoint
3. Results show as cards: recipe name, image, match score ("uses 4 of your 6 ingredients")
4. Tap a result → see full recipe detail from Spoonacular
5. "Save to Library" button → pre-fills the Add Meal form with fetched data

**API:** Spoonacular free tier  
- Endpoint: `GET /recipes/findByIngredients`  
- Rate limit: 150 requests/day (plenty for personal use)  
- API key stored in `.env` (Vite's `VITE_SPOONACULAR_KEY`)

**Offline behavior:** Cache last set of results in localStorage so she can browse them without signal.

---

### 3.4 📷 Scanner (`/scanner`)

**Purpose:** Scan a grocery product barcode and check for harmful additives.

**Flow:**
1. Camera view opens (using `@zxing/browser`)
2. Point at barcode → auto-detects and freezes on scan
3. Fetches product from Open Food Facts API
4. Result screen shows:
   - Product name + brand
   - 🟢 / 🟡 / 🔴 additive risk indicator
   - List of flagged additives with risk level + plain-English explanation
   - "Healthier alternatives" section (same category, better additive profile from Open Food Facts)
5. Recent scans list (last 20, stored locally) — accessible offline

**Additive Risk Logic:**
- Pull `additives_tags` from Open Food Facts response
- Cross-reference against Open Food Facts' built-in risk classifications (`additives_n`, `additives_original_tags`)
- Risk levels: Safe / Moderate (worth knowing) / Avoid
- Display in plain language (e.g. "E102 Tartrazine — artificial dye, linked to hyperactivity in children. Risk: Avoid")

**API:** Open Food Facts  
- Endpoint: `https://world.openfoodfacts.org/api/v2/product/{barcode}.json`  
- Free, no API key required  
- No rate limit for personal use

**Offline behavior:** Cache all previously scanned products in localStorage by barcode.

---

## 4. Data Models

### Meal
```js
{
  id: String,            // uuid
  name: String,
  category: 'breakfast' | 'lunch' | 'dinner' | 'snack',
  ingredients: [String],
  instructions: String,
  sourceUrl: String,
  notes: String,
  photo: String,         // base64 or blob URL
  isFavorite: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### WeekPlan
```js
{
  weekStart: String,     // ISO date of Monday (e.g. "2026-03-02")
  days: {
    monday:    { breakfast: MealId|null, lunch: MealId|null, dinner: MealId|null, snack: MealId|null },
    tuesday:   { ... },
    wednesday: { ... },
    thursday:  { ... },
    friday:    { ... },
    saturday:  { ... },
    sunday:    { ... }
  }
}
```

### Settings
```js
{
  codes: [
    { letter: String, color: String, label: String }  // e.g. { letter: 'F', color: '#9B59B6', label: 'Purple' }
  ],
  assignments: {
    sunday:    { breakfast: String|null, lunch: String|null, dinner: String|null, snack: String|null },
    monday:    { ... },
    // ... one entry per day, value is a code letter or null
  }
}
```

### ScanHistory
```js
{
  barcode: String,
  productName: String,
  brand: String,
  riskLevel: 'safe' | 'moderate' | 'avoid',
  flaggedAdditives: [{ code, name, risk, description }],
  scannedAt: Date,
  rawData: Object        // full OFF response, cached for offline
}
```

---

## 5. State Management

### Three-Layer Persistence Architecture

```
┌─────────────────────────────────┐
│  Pinia Stores (reactive UI)     │  ← Vue components read/write here
├─────────────────────────────────┤
│  localStorage (offline buffer)  │  ← pinia-plugin-persistedstate auto-syncs
├─────────────────────────────────┤
│  Netlify Functions → Turso      │  ← cloud persistence via offline queue
└─────────────────────────────────┘
```

**Flow:** Every store mutation updates Pinia (instant UI), auto-persists to localStorage (survives refresh), and queues a change for cloud sync. When online, the queue flushes to Netlify serverless functions which write to Turso (cloud SQLite). On app load, `initialSync()` fetches server data and merges into stores.

**Pinia** (Vue's official store — lightweight, no boilerplate):

| Store | Responsibilities |
|---|---|
| `useMealStore` | CRUD for meal library, favorites sorting |
| `usePlannerStore` | Week plans, swap logic, week navigation |
| `useIdeasStore` | Ingredient input, Spoonacular results, cache |
| `useScannerStore` | Scan history, OFF API calls, additive lookup |
| `useSettingsStore` | Meal code definitions and day/slot assignments |

All stores persist to `localStorage` via Pinia's `pinia-plugin-persistedstate` and queue changes for cloud sync via `useSync().queueChange()`.

### 5a. Turso Schema

```sql
CREATE TABLE meals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'dinner',
  ingredients TEXT NOT NULL DEFAULT '[]',       -- JSON array of strings
  instructions TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  photo TEXT NOT NULL DEFAULT '',
  is_favorite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE week_plans (
  week_start TEXT NOT NULL,
  day TEXT NOT NULL,
  slot_type TEXT NOT NULL,
  meal_ids TEXT NOT NULL DEFAULT '[]',          -- JSON array of meal IDs
  updated_at TEXT NOT NULL,
  PRIMARY KEY (week_start, day, slot_type)
);

CREATE TABLE scan_history (
  barcode TEXT PRIMARY KEY,
  product_name TEXT NOT NULL DEFAULT 'Unknown Product',
  brand TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  risk_level TEXT NOT NULL DEFAULT 'safe',
  flagged_additives TEXT NOT NULL DEFAULT '[]', -- JSON array of objects
  categories_tags TEXT NOT NULL DEFAULT '[]',   -- JSON array of strings
  scanned_at TEXT NOT NULL,
  raw_data TEXT NOT NULL DEFAULT '{}'           -- Full OFF response JSON
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL                           -- JSON stringified value
);
```

### 5b. Netlify Functions

| Function | Methods | Purpose |
|---|---|---|
| `meals.js` | GET, POST, PUT, DELETE | Full CRUD for meals table |
| `planner.js` | GET, POST, DELETE | Week plan slot management by week_start |
| `scanner.js` | GET, POST, DELETE | Scan history (last 20, upsert by barcode) |
| `sync.js` | POST | Batch flush of offline queue (meals + slots + scans + settings in one transaction) |
| `settings.js` | GET, POST | Read/write meal code settings (codes + assignments) |
| `init-db.js` | POST | One-time table creation (run manually) |

All functions connect to Turso via `@libsql/client` using `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` environment variables.

---

## 6. PWA Configuration

**Service Worker:** Via `vite-plugin-pwa` (Workbox under the hood)

### Caching Strategy

| Resource | Strategy | Why |
|---|---|---|
| App shell (HTML/CSS/JS) | Cache First | Instant load, works offline |
| Meal photos | Cache First | Stored locally anyway |
| Spoonacular API | Network First + Cache fallback | Fresh results preferred, called client-side |
| Netlify Functions (sync API) | Network Only | Sync queue flush, no caching needed |
| Open Food Facts API | StaleWhileRevalidate | Additive data rarely changes |
| Barcode scan history | Runtime cache (localStorage) | Already persisted in Pinia |

**Manifest (`manifest.json`):**
```json
{
  "name": "Meal Planner",
  "short_name": "Meals",
  "start_url": "/planner",
  "display": "standalone",
  "background_color": "#FAFAF8",
  "theme_color": "#3D6B4F",
  "icons": [/* 192x192, 512x512 */]
}
```

**Install prompt:** Shown once after 3rd visit if not already installed. Dismissed state saved to localStorage.

---

## 7. Project Structure

```
netlify/
└── functions/
    ├── init-db.js         # One-time table creation
    ├── meals.js           # Meals CRUD
    ├── planner.js         # Week plan slot management
    ├── scanner.js         # Scan history management
    ├── settings.js        # Meal code settings (codes + assignments)
    └── sync.js            # Batch offline queue flush

src/
├── assets/
├── components/
│   ├── common/         # Button, Card, Modal, BottomNav, SearchBar
│   ├── planner/        # WeekView, DaySection, MealSlot, SwapOverlay
│   ├── library/        # MealCard, MealForm, MealDetail
│   ├── ideas/          # IngredientInput, RecipeResultCard
│   └── scanner/        # CameraView, ScanResult, AdditiveTag, ScanHistory
├── pages/
│   ├── PlannerPage.vue
│   ├── LibraryPage.vue
│   ├── MealDetailPage.vue
│   ├── MealFormPage.vue
│   ├── IdeasPage.vue
│   └── ScannerPage.vue
├── stores/
│   ├── meals.js
│   ├── planner.js
│   ├── ideas.js
│   ├── scanner.js
│   └── settings.js
├── composables/
│   ├── useSpoonacular.js
│   ├── useOpenFoodFacts.js
│   ├── useBarcodeScanner.js
│   └── useSync.js           # Cloud sync lifecycle (Turso via Netlify functions)
├── utils/
│   ├── additiveRisk.js    # Additive classification logic
│   ├── nutriScore.js      # Nutri-score calculation (optional)
│   └── dates.js           # Week navigation helpers
├── router/
│   └── index.js
├── App.vue
└── main.js
```

---

## 8. Key Dependencies

| Package | Purpose |
|---|---|
| `vue@3` | Framework |
| `vite` | Build tool |
| `tailwindcss` | Styling |
| `pinia` | State management |
| `vue-router` | Routing |
| `pinia-plugin-persistedstate` | Auto-persist stores to localStorage |
| `vite-plugin-pwa` | PWA + service worker generation |
| `@zxing/browser` | Barcode scanning via camera |
| `@libsql/client` | Turso database client (Netlify functions only) |
| `axios` | API requests |
| `netlify-cli` | Local dev server for functions + Vite (dev dependency) |

---

## 9. Build Phases

### Phase 1 — Core (Weeks 1–3)
- Project setup (Vite + Vue + Tailwind + PWA config)
- Bottom nav + routing
- Meal Library: full CRUD
- Basic Planner: view and assign meals to slots

### Phase 2 — Planner Polish (Weeks 4–5)
- Swap feature
- Week navigation (prev/next week)
- Copy week functionality
- Favorites sorting

### Phase 3 — New Ideas (Weeks 6–7)
- Ingredient tag input
- Spoonacular integration
- Save recipe to library
- Offline caching of results

### Phase 4 — Scanner (Weeks 8–9)
- Camera barcode scanning (`@zxing/browser`)
- Open Food Facts integration
- Additive risk logic + UI
- Healthier alternatives feature
- Scan history with offline support

### Phase 5 — PWA Hardening + Polish (Weeks 10–11)
- Service worker caching audit
- Install prompt
- Offline edge case handling
- Performance + mobile UX polish
- Icon set, splash screens, manifest finalization

**Total estimate: ~11 weeks**  
*(Faster with Claude Code — estimated 30–40% reduction = ~7 weeks)*

---

## 10. Open Questions to Decide Before Building

1. **Multi-week planning** — should she be able to plan more than one week ahead, or just the current week?
2. **Recipe photos** — are these pulled from Spoonacular/OFF when available, or always manually added?
3. **Grocery list** — should the planner auto-generate a shopping list from the week's meals? (natural next feature)
4. **Dark mode** — yes/no?
5. **Nutri-Score** — should the scanner show a nutrition quality score alongside the additive flag, or keep it to additives only?
