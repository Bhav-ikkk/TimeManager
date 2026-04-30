/**
 * src/lib/calories.js
 *
 * BYOK (bring-your-own-key) calorie analysis with provider choice
 * (Groq / Gemini / OpenRouter). Keys live in IndexedDB and are sent
 * directly to the provider — never to a server we control.
 *
 * The dietitian prompt is intentionally strict and judgemental — the
 * user asked for an honest dietitian, not a cheerleader. We also pass
 * USDA-grounded nutrition for any item the user added via product
 * search, so totals are accurate before the model even runs.
 */
import {
  getSetting,
  setSetting,
  listFoodEntriesForDate,
  listFoodEntriesBetween,
  listFoodReports,
  saveFoodReport,
  getFoodReport,
  todayKey,
} from './db';
import { callAI, PROVIDERS } from './aiProviders';

/* ----- profile + provider config -------------------------------------- */

const PROFILE_KEY = 'calorie-profile';
const PROVIDER_KEY = 'ai-provider';
const API_KEYS_KEY = 'ai-api-keys'; // { groq, gemini, openrouter }
const MODELS_KEY = 'ai-models';     // { groq, gemini, openrouter }

// Legacy single-key storage (kept for migration).
const LEGACY_GEMINI_KEY = 'gemini-api-key';
const LEGACY_GEMINI_MODEL = 'gemini-model';

export const DEFAULT_PROFILE = {
  name: '',
  gender: 'male',          // 'male' | 'female' | 'other'
  age: 25,
  heightCm: 175,
  weightKg: 70,
  goalWeightKg: 65,
  activity: 'light',       // sedentary | light | moderate | active | athlete
  goal: 'cut',             // cut | maintain | bulk
  diet: 'omnivore',        // omnivore | vegetarian | vegan | eggetarian | jain | pescatarian | keto
  cuisinePref: '',         // e.g. "North Indian, Italian"
  location: '',            // free text: city, country
  allergies: '',           // comma-separated
  dailyCalorieTarget: 2000,
  proteinTargetG: 130,
  dietaryNotes: '',
};

export const DIET_OPTIONS = [
  { value: 'omnivore', label: 'Omnivore (everything)' },
  { value: 'vegetarian', label: 'Vegetarian (no meat/fish)' },
  { value: 'eggetarian', label: 'Eggetarian (veg + eggs)' },
  { value: 'vegan', label: 'Vegan (no animal products)' },
  { value: 'jain', label: 'Jain (no roots/onion/garlic)' },
  { value: 'pescatarian', label: 'Pescatarian (veg + fish)' },
  { value: 'keto', label: 'Keto / low-carb' },
];

export async function getCalorieProfile() {
  const stored = await getSetting(PROFILE_KEY, null);
  return { ...DEFAULT_PROFILE, ...(stored || {}) };
}

export async function setCalorieProfile(patch) {
  const cur = await getCalorieProfile();
  const next = { ...cur, ...patch };
  await setSetting(PROFILE_KEY, next);
  return next;
}

/* ----- provider + per-provider key/model ------------------------------ */

export async function getProvider() {
  const v = await getSetting(PROVIDER_KEY, '');
  if (v && PROVIDERS[v]) return v;
  // Migrate: if legacy gemini key exists, default to gemini.
  const legacy = await getSetting(LEGACY_GEMINI_KEY, '');
  if (legacy) return 'gemini';
  return 'groq';
}

export async function setProvider(p) {
  if (!PROVIDERS[p]) throw new Error(`Unknown provider: ${p}`);
  await setSetting(PROVIDER_KEY, p);
}

async function getKeysMap() {
  const stored = (await getSetting(API_KEYS_KEY, null)) || {};
  if (!stored.gemini) {
    const legacy = await getSetting(LEGACY_GEMINI_KEY, '');
    if (legacy) stored.gemini = legacy;
  }
  return stored;
}

async function getModelsMap() {
  const stored = (await getSetting(MODELS_KEY, null)) || {};
  if (!stored.gemini) {
    const legacyModel = await getSetting(LEGACY_GEMINI_MODEL, '');
    if (legacyModel) stored.gemini = legacyModel;
  }
  return stored;
}

export async function getApiKey(provider) {
  const map = await getKeysMap();
  return String(map[provider] || '');
}

export async function setApiKey(provider, key) {
  const map = await getKeysMap();
  map[provider] = String(key || '').trim();
  await setSetting(API_KEYS_KEY, map);
}

export async function getModel(provider) {
  const map = await getModelsMap();
  return map[provider] || PROVIDERS[provider]?.defaultModel || '';
}

export async function setModel(provider, model) {
  const map = await getModelsMap();
  map[provider] = String(model || PROVIDERS[provider]?.defaultModel || '');
  await setSetting(MODELS_KEY, map);
}

/** Resolved active config: { provider, key, model }. */
export async function getActiveAIConfig() {
  const provider = await getProvider();
  const [key, model] = await Promise.all([getApiKey(provider), getModel(provider)]);
  return { provider, key, model: model || PROVIDERS[provider].defaultModel };
}

/* ----- Legacy alias (any caller asking "is a key set?") --------------- */

export async function getGeminiKey() {
  const cfg = await getActiveAIConfig();
  return cfg.key;
}

export { maskKey } from './aiProviders';

/* ----- BMR / TDEE estimation ------------------------------------------ */

export function estimateBMR(profile) {
  const { gender, age, heightCm, weightKg } = profile;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (gender === 'female') return Math.round(base - 161);
  return Math.round(base + 5);
}

const ACTIVITY_MULT = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
};

export function estimateTDEE(profile) {
  const m = ACTIVITY_MULT[profile.activity] ?? 1.375;
  return Math.round(estimateBMR(profile) * m);
}

export function suggestDailyTarget(profile) {
  const tdee = estimateTDEE(profile);
  if (profile.goal === 'cut') return Math.max(1200, tdee - 500);
  if (profile.goal === 'bulk') return tdee + 300;
  return tdee;
}

/* ----- Period helpers --------------------------------------------------- */

export function dayReportId(dateKey) { return `day-${dateKey}`; }
export function weekReportId(startKey, endKey) { return `week-${startKey}_${endKey}`; }
export function monthReportId(startKey) { return `month-${startKey.slice(0, 7)}`; }

/* ----- Pre-aggregated nutrition from USDA-tagged entries -------------- */

function preAggregate(entries) {
  const totals = {
    kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0,
    fiber_g: 0, sugar_g: 0, sodium_mg: 0,
  };
  let grounded = 0;
  for (const e of entries) {
    if (e.nutrition && typeof e.nutrition === 'object') {
      for (const k of Object.keys(totals)) {
        if (typeof e.nutrition[k] === 'number') totals[k] += e.nutrition[k];
      }
      grounded += 1;
    }
  }
  return { totals, groundedCount: grounded };
}

function describeEntry(e) {
  const time = new Date(e.at).toTimeString().slice(0, 5);
  if (e.nutrition && e.fdcId) {
    const n = e.nutrition;
    return `[${time}] ${e.text}${e.brand ? ` (${e.brand})` : ''} — USDA fdc:${e.fdcId}, ${e.grams || '?'}g, ${Math.round(n.kcal || 0)} kcal, P${Math.round(n.protein_g || 0)} C${Math.round(n.carbs_g || 0)} F${Math.round(n.fat_g || 0)}`;
  }
  return `[${time}] ${e.text}`;
}

/* ----- Prompts -------------------------------------------------------- */

function strictDailyPrompt(profile, dateKey, entries, preTotals) {
  const grounded = preTotals.groundedCount;
  return `You are an experienced, no-nonsense clinical dietitian.
The user is logging what they ate today and wants an honest, evidence-based
daily report. Do NOT sugarcoat. Do NOT moralise. Be specific, numerical,
and direct. If the data is too sparse to be confident, say so.

User profile (respect diet, allergies and cuisine preferences strictly):
${JSON.stringify(profile, null, 2)}

Date: ${dateKey}

Food log (in the order eaten). Items tagged with "USDA fdc:" already have
verified nutrition — use those numbers verbatim and only estimate the rest:
${entries.map((e, i) => `${i + 1}. ${describeEntry(e)}`).join('\n') || '(no entries)'}

${grounded > 0 ? `Pre-computed totals from ${grounded} USDA-grounded entries (these are already correct — only ADD free-text estimates ON TOP, do not double-count):
${JSON.stringify(preTotals.totals, null, 2)}` : 'No USDA-grounded items in this log; estimate everything conservatively.'}

Estimation rules:
- Treat homemade Indian/Asian portions as larger than menu defaults unless the user says otherwise.
- Account for the user's location (${profile.location || 'unspecified'}) when guessing typical portion sizes and cuisine.
- If profile.diet excludes a food the user logged, flag it explicitly in riskFlags.
- Pick a reasonable middle estimate, never a flattering low one.

Reply ONLY with a single JSON object, no prose around it, matching this
TypeScript type EXACTLY:

type DayReport = {
  totalCalories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  items: { name: string; qty: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; source: 'usda' | 'estimate' }[];
  targetCalories: number;
  surplusOrDeficit: number;
  proteinTargetG: number;
  proteinGap: number;
  goalAlignment: 'aligned' | 'off-track' | 'badly-off-track';
  verdict: string;
  riskFlags: string[];
  improvements: string[];
  mealSuggestions: { meal: 'breakfast' | 'lunch' | 'snack' | 'dinner'; idea: string; approxKcal: number; protein_g: number }[];
};`;
}

function strictRangePrompt(profile, kind, startKey, endKey, entries, savedDailyReports) {
  return `You are an experienced, no-nonsense clinical dietitian writing a
${kind} report for the user. Be honest, specific, and brief. Compare
performance to their stated goal weight and daily calorie target. Respect
the user's diet (${profile.diet}) and allergies (${profile.allergies || 'none'}).

User profile:
${JSON.stringify(profile, null, 2)}

Range: ${startKey} → ${endKey}

Daily reports already produced for days in this range (may be partial):
${JSON.stringify(savedDailyReports, null, 2)}

Raw food entries for the range (in case some days were never analysed):
${entries.map((e) => `[${e.date}] ${describeEntry(e)}`).join('\n') || '(none)'}

Reply ONLY with a single JSON object, no prose, matching:

type RangeReport = {
  kind: '${kind}';
  startDate: string;
  endDate: string;
  daysCovered: number;
  daysLogged: number;
  avgCaloriesPerLoggedDay: number;
  avgProteinPerLoggedDay: number;
  estimatedWeightChangeKg: number;
  goalProgress: 'on-track' | 'slow' | 'off-track' | 'reversing';
  bestDay: { date: string; reason: string } | null;
  worstDay: { date: string; reason: string } | null;
  patterns: string[];
  verdict: string;
  nextWeekPlan: string[];
  weeklyMealPlan: { day: string; breakfast: string; lunch: string; snack: string; dinner: string; approxKcal: number }[];
};`;
}

/* ----- Public analysis API -------------------------------------------- */

export async function analyseDay(dateKey = todayKey()) {
  const [profile, cfg, entries] = await Promise.all([
    getCalorieProfile(),
    getActiveAIConfig(),
    listFoodEntriesForDate(dateKey),
  ]);
  const pre = preAggregate(entries);
  const prompt = strictDailyPrompt(profile, dateKey, entries, pre);
  const json = await callAI({ ...cfg, prompt });
  const id = dayReportId(dateKey);
  const report = {
    id,
    kind: 'day',
    startDate: dateKey,
    endDate: dateKey,
    json,
    profileSnapshot: profile,
    provider: cfg.provider,
    model: cfg.model,
    entryCount: entries.length,
  };
  await saveFoodReport(report);
  return report;
}

export async function analyseRange(kind, startKey, endKey) {
  if (!['week', 'month'].includes(kind)) throw new Error('Unsupported range kind');
  const [profile, cfg, entries, allReports] = await Promise.all([
    getCalorieProfile(),
    getActiveAIConfig(),
    listFoodEntriesBetween(startKey, endKey),
    listFoodReports('day'),
  ]);
  const dailyReports = allReports
    .filter((r) => r.startDate >= startKey && r.startDate <= endKey)
    .map((r) => ({ date: r.startDate, json: r.json }));
  const prompt = strictRangePrompt(profile, kind, startKey, endKey, entries, dailyReports);
  const json = await callAI({ ...cfg, prompt });
  const id = kind === 'week'
    ? weekReportId(startKey, endKey)
    : monthReportId(startKey);
  const report = {
    id,
    kind,
    startDate: startKey,
    endDate: endKey,
    json,
    profileSnapshot: profile,
    provider: cfg.provider,
    model: cfg.model,
    entryCount: entries.length,
  };
  await saveFoodReport(report);
  return report;
}

export { getFoodReport };
