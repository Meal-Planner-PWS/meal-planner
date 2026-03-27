/**
 * Cleanify — automatically substitutes flagged ingredients with clean alternatives.
 */

export const DEFAULT_CLEANIFY_RULES = [
  { from: 'vegetable oil', to: 'olive oil' },
  { from: 'canola oil', to: 'olive oil' },
  { from: 'soybean oil', to: 'olive oil' },
  { from: 'corn oil', to: 'olive oil' },
  { from: 'sunflower oil', to: 'olive oil' },
  { from: 'safflower oil', to: 'olive oil' },
  { from: 'cottonseed oil', to: 'olive oil' },
  { from: 'shortening', to: 'butter' },
  { from: 'margarine', to: 'butter' },
  { from: 'crisco', to: 'butter' },
  { from: 'high fructose corn syrup', to: 'honey' },
  { from: 'corn syrup', to: 'maple syrup' },
  { from: 'white sugar', to: 'raw sugar' },
  { from: 'granulated sugar', to: 'raw sugar' },
  { from: 'bleached flour', to: 'whole wheat flour' },
  { from: 'enriched flour', to: 'whole wheat flour' },
  { from: 'white flour', to: 'whole wheat flour' },
  { from: 'all-purpose flour', to: 'whole wheat flour' },
  { from: 'artificial flavor', to: 'vanilla extract' },
  { from: 'msg', to: 'salt and pepper' },
  { from: 'monosodium glutamate', to: 'salt and pepper' }
]

/**
 * Apply substitution rules to an ingredients array.
 * @param {string[]} ingredientsArray
 * @param {{ from: string, to: string }[]} substitutions - rules from settings store
 * @returns {{ ingredients: string[], substitutions: { original: string, cleaned: string, rule: { from: string, to: string } }[] }}
 */
export function cleanifyIngredients(ingredientsArray, substitutions) {
  const rules = Array.isArray(substitutions) && substitutions.length > 0
    ? substitutions
    : DEFAULT_CLEANIFY_RULES

  const result = []
  const changes = []

  for (const ingredient of ingredientsArray) {
    const lower = ingredient.toLowerCase()
    let matched = false

    // First match wins — apply only one rule per ingredient
    for (const rule of rules) {
      const idx = lower.indexOf(rule.from.toLowerCase())
      if (idx !== -1) {
        // Replace the matched portion preserving surrounding text
        const cleaned = ingredient.substring(0, idx) + rule.to + ingredient.substring(idx + rule.from.length)
        result.push(cleaned)
        changes.push({ original: ingredient, cleaned, rule })
        matched = true
        break
      }
    }

    if (!matched) {
      result.push(ingredient)
    }
  }

  return { ingredients: result, substitutions: changes }
}
