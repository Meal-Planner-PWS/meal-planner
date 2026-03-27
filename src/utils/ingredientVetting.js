/**
 * Ingredient vetting — flags problematic ingredients in recipe results.
 * Uses case-insensitive keyword matching against a configurable blocklist.
 */

/** Default flagged keywords — used as initial value in settings store */
export const DEFAULT_FLAGGED_KEYWORDS = [
  // Refined/processed oils and fats
  'canola oil', 'vegetable oil', 'soybean oil', 'corn oil', 'sunflower oil',
  'safflower oil', 'cottonseed oil', 'hydrogenated', 'margarine', 'shortening', 'crisco',

  // Refined sugars and sweeteners
  'high fructose corn syrup', 'corn syrup', 'aspartame', 'sucralose', 'saccharin',
  'acesulfame', 'maltodextrin', 'dextrose', 'artificial sweetener',

  // Preservatives and additives
  'sodium benzoate', 'potassium sorbate', 'sodium nitrate', 'sodium nitrite',
  'bha', 'bht', 'tbhq', 'carrageenan', 'msg', 'monosodium glutamate',

  // Artificial colors and flavors
  'artificial color', 'artificial flavor', 'artificial dye',
  'red 40', 'yellow 5', 'yellow 6', 'blue 1', 'blue 2', 'red 3',

  // Refined grains
  'bleached flour', 'enriched flour', 'white flour', 'refined flour'
]

/** Category groupings for display purposes only */
export const KEYWORD_CATEGORIES = {
  'Oils & Fats': [
    'canola oil', 'vegetable oil', 'soybean oil', 'corn oil', 'sunflower oil',
    'safflower oil', 'cottonseed oil', 'hydrogenated', 'margarine', 'shortening', 'crisco'
  ],
  'Sugars & Sweeteners': [
    'high fructose corn syrup', 'corn syrup', 'aspartame', 'sucralose', 'saccharin',
    'acesulfame', 'maltodextrin', 'dextrose', 'artificial sweetener'
  ],
  'Preservatives': [
    'sodium benzoate', 'potassium sorbate', 'sodium nitrate', 'sodium nitrite',
    'bha', 'bht', 'tbhq', 'carrageenan', 'msg', 'monosodium glutamate'
  ],
  'Artificial Additives': [
    'artificial color', 'artificial flavor', 'artificial dye',
    'red 40', 'yellow 5', 'yellow 6', 'blue 1', 'blue 2', 'red 3'
  ],
  'Refined Grains': [
    'bleached flour', 'enriched flour', 'white flour', 'refined flour'
  ]
}

export const VET_STATUS = {
  CLEAN: 'clean',
  REVIEW: 'review'
}

/**
 * Scan an ingredients array for flagged items.
 * @param {string[]} ingredients - array of ingredient strings
 * @param {string[]} flaggedList - keywords to flag (from settings store)
 * @returns {{ status: 'clean'|'review', flagged: string[] }}
 */
export function vetIngredients(ingredients, flaggedList) {
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return { status: VET_STATUS.CLEAN, flagged: [] }
  }

  const keywords = Array.isArray(flaggedList) && flaggedList.length > 0
    ? flaggedList
    : DEFAULT_FLAGGED_KEYWORDS

  const flagged = new Set()

  for (const ingredient of ingredients) {
    const lower = ingredient.toLowerCase()
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        flagged.add(keyword)
      }
    }
  }

  return {
    status: flagged.size > 0 ? VET_STATUS.REVIEW : VET_STATUS.CLEAN,
    flagged: [...flagged]
  }
}
