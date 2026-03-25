/**
 * Additive risk classification logic.
 * Cross-references Open Food Facts additive tags against known risk levels.
 *
 * Risk levels:
 *   safe     — no concern
 *   moderate — worth knowing about
 *   avoid    — linked to health risks, best avoided
 */

const ADDITIVE_RISKS = {
  // --- AVOID ---
  'en:e102': { name: 'Tartrazine', risk: 'avoid', description: 'Artificial yellow dye, linked to hyperactivity in children' },
  'en:e110': { name: 'Sunset Yellow FCF', risk: 'avoid', description: 'Artificial orange dye, linked to hyperactivity in children' },
  'en:e122': { name: 'Carmoisine', risk: 'avoid', description: 'Artificial red dye, linked to hyperactivity in children' },
  'en:e124': { name: 'Ponceau 4R', risk: 'avoid', description: 'Artificial red dye, linked to hyperactivity in children' },
  'en:e129': { name: 'Allura Red AC', risk: 'avoid', description: 'Artificial red dye, linked to hyperactivity in children' },
  'en:e211': { name: 'Sodium Benzoate', risk: 'avoid', description: 'Preservative, may form benzene when combined with vitamin C' },
  'en:e250': { name: 'Sodium Nitrite', risk: 'avoid', description: 'Preservative in processed meats, linked to increased cancer risk' },
  'en:e621': { name: 'Monosodium Glutamate (MSG)', risk: 'avoid', description: 'Flavor enhancer, may cause headaches and sensitivity reactions' },
  'en:e951': { name: 'Aspartame', risk: 'avoid', description: 'Artificial sweetener, classified as possibly carcinogenic by IARC' },
  'en:e955': { name: 'Sucralose', risk: 'avoid', description: 'Artificial sweetener, may affect gut bacteria and insulin response' },

  // --- MODERATE ---
  'en:e100': { name: 'Curcumin', risk: 'moderate', description: 'Natural yellow color from turmeric, generally safe but may cause issues in large amounts' },
  'en:e120': { name: 'Cochineal / Carminic Acid', risk: 'moderate', description: 'Natural red dye from insects, may cause allergic reactions in some people' },
  'en:e150d': { name: 'Caramel Color (Sulfite Ammonia)', risk: 'moderate', description: 'Processed caramel coloring, may contain trace 4-MEI' },
  'en:e160a': { name: 'Beta-carotene', risk: 'moderate', description: 'Natural orange color, generally safe but synthetic forms less studied' },
  'en:e322': { name: 'Lecithins', risk: 'moderate', description: 'Emulsifier usually from soy or sunflower, generally safe' },
  'en:e415': { name: 'Xanthan Gum', risk: 'moderate', description: 'Thickener, safe in food amounts but may cause digestive issues in excess' },
  'en:e471': { name: 'Mono- and Diglycerides', risk: 'moderate', description: 'Emulsifier from fats, generally safe but source may be unclear' },
  'en:e500': { name: 'Sodium Carbonates', risk: 'moderate', description: 'Baking soda / raising agent, safe in normal food use' },

  // --- SAFE (common ones explicitly marked so they don't get flagged) ---
  'en:e100i': { name: 'Curcumin', risk: 'safe', description: 'Natural turmeric extract' },
  'en:e140': { name: 'Chlorophyll', risk: 'safe', description: 'Natural green color from plants' },
  'en:e160c': { name: 'Paprika Extract', risk: 'safe', description: 'Natural color from paprika' },
  'en:e170': { name: 'Calcium Carbonate', risk: 'safe', description: 'Natural mineral, used as color and calcium supplement' },
  'en:e270': { name: 'Lactic Acid', risk: 'safe', description: 'Natural acid, found in fermented foods' },
  'en:e290': { name: 'Carbon Dioxide', risk: 'safe', description: 'Carbonation gas, harmless' },
  'en:e296': { name: 'Malic Acid', risk: 'safe', description: 'Natural acid found in apples' },
  'en:e300': { name: 'Ascorbic Acid (Vitamin C)', risk: 'safe', description: 'Vitamin C, safe antioxidant' },
  'en:e301': { name: 'Sodium Ascorbate', risk: 'safe', description: 'Vitamin C salt, safe antioxidant' },
  'en:e306': { name: 'Tocopherols (Vitamin E)', risk: 'safe', description: 'Natural vitamin E, safe antioxidant' },
  'en:e307': { name: 'Alpha-tocopherol', risk: 'safe', description: 'Vitamin E form, safe antioxidant' },
  'en:e322i': { name: 'Lecithin', risk: 'safe', description: 'Natural emulsifier from soy or sunflower' },
  'en:e330': { name: 'Citric Acid', risk: 'safe', description: 'Natural acid found in citrus fruits' },
  'en:e331': { name: 'Sodium Citrate', risk: 'safe', description: 'Salt of citric acid, safe acidity regulator' },
  'en:e332': { name: 'Potassium Citrate', risk: 'safe', description: 'Potassium salt of citric acid, safe' },
  'en:e334': { name: 'Tartaric Acid', risk: 'safe', description: 'Natural acid found in grapes' },
  'en:e336': { name: 'Potassium Tartrate', risk: 'safe', description: 'Cream of tartar, safe' },
  'en:e339': { name: 'Sodium Phosphates', risk: 'safe', description: 'Common food additive, safe in normal amounts' },
  'en:e340': { name: 'Potassium Phosphates', risk: 'safe', description: 'Common food additive, safe in normal amounts' },
  'en:e375': { name: 'Niacin (Vitamin B3)', risk: 'safe', description: 'Essential vitamin, safe' },
  'en:e392': { name: 'Rosemary Extract', risk: 'safe', description: 'Natural antioxidant from rosemary' },
  'en:e400': { name: 'Alginic Acid', risk: 'safe', description: 'Natural thickener from seaweed' },
  'en:e401': { name: 'Sodium Alginate', risk: 'safe', description: 'Natural thickener from seaweed' },
  'en:e406': { name: 'Agar', risk: 'safe', description: 'Natural gelling agent from seaweed' },
  'en:e410': { name: 'Locust Bean Gum', risk: 'safe', description: 'Natural thickener from carob seeds' },
  'en:e412': { name: 'Guar Gum', risk: 'safe', description: 'Natural thickener from guar beans' },
  'en:e414': { name: 'Acacia Gum', risk: 'safe', description: 'Natural gum from acacia trees' },
  'en:e440': { name: 'Pectin', risk: 'safe', description: 'Natural gelling agent from fruit' },
  'en:e460': { name: 'Cellulose', risk: 'safe', description: 'Plant fiber, safe anti-caking agent' },
  'en:e500i': { name: 'Sodium Carbonate', risk: 'safe', description: 'Baking soda, safe raising agent' },
  'en:e500ii': { name: 'Sodium Hydrogen Carbonate', risk: 'safe', description: 'Baking soda, safe raising agent' },
  'en:e501': { name: 'Potassium Carbonates', risk: 'safe', description: 'Safe raising agent' },
  'en:e503': { name: 'Ammonium Carbonates', risk: 'safe', description: 'Safe raising agent used in baking' },
  'en:e508': { name: 'Potassium Chloride', risk: 'safe', description: 'Salt substitute, safe mineral' },
  'en:e509': { name: 'Calcium Chloride', risk: 'safe', description: 'Firming agent, safe mineral salt' },
  'en:e516': { name: 'Calcium Sulfate', risk: 'safe', description: 'Gypsum, used in tofu making' },
  'en:e948': { name: 'Oxygen', risk: 'safe', description: 'Packaging gas, harmless' },
  'en:e941': { name: 'Nitrogen', risk: 'safe', description: 'Packaging gas, harmless' }
}

/**
 * Classify a list of additive tags from Open Food Facts.
 * @param {string[]} additiveTags - e.g. ['en:e330', 'en:e211']
 * @returns {{ flagged: Array, overallRisk: 'safe'|'moderate'|'avoid' }}
 */
export function classifyAdditives(additiveTags = []) {
  const flagged = []

  for (const tag of additiveTags) {
    const key = tag.toLowerCase()
    const known = ADDITIVE_RISKS[key]

    if (known) {
      // Only include moderate and avoid in the flagged list — safe ones are fine
      if (known.risk !== 'safe') {
        flagged.push({ code: tag, ...known })
      }
    } else {
      // Unknown additive — default to safe per spec (don't flag it)
      // Assumption: unknown additives are safe unless proven otherwise,
      // to avoid noisy results for common harmless additives not in our table.
    }
  }

  let overallRisk = 'safe'
  if (flagged.some((a) => a.risk === 'avoid')) {
    overallRisk = 'avoid'
  } else if (flagged.some((a) => a.risk === 'moderate')) {
    overallRisk = 'moderate'
  }

  return { flagged, overallRisk }
}
