/**
 * src/lib/foodSearch.js
 *
 * USDA FoodData Central client. Lets the user search the global food
 * database, pick a real product, and log it with accurate per-100g
 * nutrition pulled directly from USDA. No AI guesswork at this stage.
 *
 * The default API key below is the demo key the user provided; a power
 * user can replace it in Calorie settings if they hit the rate limit.
 *
 * Docs: https://fdc.nal.usda.gov/api-guide
 */
import { getSetting, setSetting } from './db';

const FDC_BASE = 'https://api.nal.usda.gov/fdc/v1';
const FDC_KEY_KEY = 'usda-fdc-key';
const DEFAULT_FDC_KEY = 'XWTykX9hxzsYaVvyOC12IhEt3RiJkRU7TxfVPPRH';

export async function getFdcKey() {
  const v = await getSetting(FDC_KEY_KEY, '');
  return (typeof v === 'string' && v.trim()) || DEFAULT_FDC_KEY;
}

export async function setFdcKey(key) {
  await setSetting(FDC_KEY_KEY, String(key || '').trim());
}

export async function hasCustomFdcKey() {
  const v = await getSetting(FDC_KEY_KEY, '');
  return Boolean(typeof v === 'string' && v.trim());
}

/* ---- Nutrient extraction ---------------------------------------------- */

// USDA nutrient numbers we care about (per 100g for "Foundation"/"SR Legacy"
// entries; per "serving size" for "Branded" entries — we normalise to 100g).
const NUTRIENT_IDS = {
  calories: [1008, 2047, 2048], // kcal variants
  protein: [1003],
  fat: [1004],
  carbs: [1005],
  fiber: [1079],
  sugar: [2000],
  sodium: [1093],
};

function pickNutrient(nutrients, ids) {
  if (!Array.isArray(nutrients)) return 0;
  for (const id of ids) {
    const n = nutrients.find((x) => x.nutrientId === id || x?.nutrient?.id === id);
    if (n) {
      const v = n.value ?? n.amount ?? n?.nutrient?.amount;
      if (typeof v === 'number') return v;
    }
  }
  return 0;
}

/**
 * Normalise an FDC food record into a compact, per-100g nutrient summary.
 * For branded foods (which report per-serving), USDA sets
 * `servingSize` + `servingSizeUnit`; we scale to 100 g.
 */
export function normaliseFood(food) {
  const nutrients = food.foodNutrients || [];
  let scale = 1; // multiplier to reach 100g
  if (food.dataType === 'Branded' && food.servingSize && food.servingSizeUnit) {
    const unit = String(food.servingSizeUnit).toLowerCase();
    let grams = null;
    if (unit === 'g' || unit === 'gram' || unit === 'grams') grams = food.servingSize;
    else if (unit === 'mg') grams = food.servingSize / 1000;
    // Branded labelNutrients are *per serving*, but foodNutrients are
    // already per 100g for most modern branded entries. Trust foodNutrients.
    // If nutrient values are obviously per-serving (when labelNutrients
    // exists and matches), prefer scaling.
    if (food.labelNutrients && grams && grams > 0) {
      scale = 100 / grams;
    }
  }
  const kcal = pickNutrient(nutrients, NUTRIENT_IDS.calories) * (scale === 1 ? 1 : 1);
  // For branded, prefer labelNutrients per serving and scale to 100g.
  let perHundred;
  if (food.dataType === 'Branded' && food.labelNutrients && food.servingSize) {
    const sUnit = String(food.servingSizeUnit || '').toLowerCase();
    const grams = sUnit === 'g' ? food.servingSize : null;
    if (grams && grams > 0) {
      const s = 100 / grams;
      const ln = food.labelNutrients;
      perHundred = {
        kcal: round1((ln.calories?.value || 0) * s),
        protein_g: round1((ln.protein?.value || 0) * s),
        fat_g: round1((ln.fat?.value || 0) * s),
        carbs_g: round1((ln.carbohydrates?.value || 0) * s),
        fiber_g: round1((ln.fiber?.value || 0) * s),
        sugar_g: round1((ln.sugars?.value || 0) * s),
        sodium_mg: round1((ln.sodium?.value || 0) * s),
      };
    }
  }
  if (!perHundred) {
    perHundred = {
      kcal: round1(pickNutrient(nutrients, NUTRIENT_IDS.calories)),
      protein_g: round1(pickNutrient(nutrients, NUTRIENT_IDS.protein)),
      fat_g: round1(pickNutrient(nutrients, NUTRIENT_IDS.fat)),
      carbs_g: round1(pickNutrient(nutrients, NUTRIENT_IDS.carbs)),
      fiber_g: round1(pickNutrient(nutrients, NUTRIENT_IDS.fiber)),
      sugar_g: round1(pickNutrient(nutrients, NUTRIENT_IDS.sugar)),
      sodium_mg: round1(pickNutrient(nutrients, NUTRIENT_IDS.sodium)),
    };
  }
  return {
    fdcId: food.fdcId,
    name: food.description || food.lowercaseDescription || 'Unknown food',
    brand: food.brandOwner || food.brandName || '',
    dataType: food.dataType || '',
    servingSize: food.servingSize || null,
    servingSizeUnit: food.servingSizeUnit || '',
    perHundredGrams: perHundred,
  };
}

function round1(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0;
  return Math.round(n * 10) / 10;
}

/* ---- Search ----------------------------------------------------------- */

const _searchCache = new Map();

export async function searchFoods(query, { signal, pageSize = 20 } = {}) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  const cached = _searchCache.get(q);
  if (cached) return cached;
  const key = await getFdcKey();
  const url = `${FDC_BASE}/foods/search?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(q)}&pageSize=${pageSize}&dataType=Foundation,SR%20Legacy,Branded`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`USDA ${res.status}: ${detail.slice(0, 200) || res.statusText}`);
  }
  const json = await res.json();
  const list = Array.isArray(json.foods) ? json.foods.map(normaliseFood) : [];
  _searchCache.set(q, list);
  return list;
}

/**
 * Compute totals for a serving of a normalised food.
 * `grams` is how many grams the user says they ate.
 */
export function computeServing(food, grams) {
  const g = Math.max(0, Number(grams) || 0);
  const f = food.perHundredGrams || {};
  const k = g / 100;
  return {
    grams: g,
    kcal: round1(f.kcal * k),
    protein_g: round1(f.protein_g * k),
    fat_g: round1(f.fat_g * k),
    carbs_g: round1(f.carbs_g * k),
    fiber_g: round1(f.fiber_g * k),
    sugar_g: round1(f.sugar_g * k),
    sodium_mg: round1(f.sodium_mg * k),
  };
}
