/**
 * src/lib/calories.js
 *
 * BYOK (bring-your-own-key) Gemini-powered calorie analysis.
 *
 * Why local-only: the user's API key is *their* secret. We never ship it to
 * a server, never log it, never include it in a default header. It lives in
 * IndexedDB (Dexie `settings` store) and is sent only as a query param to
 * Google's Generative Language endpoint when the user explicitly clicks
 * "Run analysis".
 *
 * The Gemini prompt is intentionally strict and judgemental — the user
 * asked for an honest dietitian, not a cheerleader.
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

/* ----- profile + api key ----------------------------------------------- */

const PROFILE_KEY = 'calorie-profile';
const API_KEY_KEY = 'gemini-api-key';
const MODEL_KEY = 'gemini-model';

const DEFAULT_MODEL = 'gemini-2.5-flash';

export const DEFAULT_PROFILE = {
  name: '',
  gender: 'male',         // 'male' | 'female' | 'other'
  age: 25,
  heightCm: 175,
  weightKg: 70,
  goalWeightKg: 65,
  activity: 'light',      // 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete'
  goal: 'cut',            // 'cut' | 'maintain' | 'bulk'
  dailyCalorieTarget: 2000,
  proteinTargetG: 130,
  dietaryNotes: '',       // allergies, vegetarian, etc.
};

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

export async function getGeminiKey() {
  const v = await getSetting(API_KEY_KEY, '');
  return typeof v === 'string' ? v : '';
}

export async function setGeminiKey(key) {
  await setSetting(API_KEY_KEY, String(key || '').trim());
}

export async function getGeminiModel() {
  const v = await getSetting(MODEL_KEY, DEFAULT_MODEL);
  return v || DEFAULT_MODEL;
}

export async function setGeminiModel(model) {
  await setSetting(MODEL_KEY, String(model || DEFAULT_MODEL));
}

export function maskKey(key) {
  if (!key) return '';
  if (key.length <= 8) return '•'.repeat(key.length);
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

/* ----- BMR / TDEE estimation (used as a sanity floor / display) -------- */

export function estimateBMR(profile) {
  const { gender, age, heightCm, weightKg } = profile;
  // Mifflin-St Jeor.
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

export function dayReportId(dateKey) {
  return `day-${dateKey}`;
}

export function weekReportId(startKey, endKey) {
  return `week-${startKey}_${endKey}`;
}

export function monthReportId(startKey) {
  // startKey is yyyy-MM-01
  return `month-${startKey.slice(0, 7)}`;
}

/* ----- Gemini call ----------------------------------------------------- */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

function strictDailyPrompt(profile, dateKey, entries) {
  return `You are an experienced, no-nonsense clinical dietitian.
The user is logging what they ate today and wants an honest, evidence-based
daily report. Do NOT sugarcoat. Do NOT moralise. Be specific, numerical,
and direct. If the data is too sparse to be confident, say so.

User profile:
${JSON.stringify(profile, null, 2)}

Date: ${dateKey}

Food log (free text, in the order eaten):
${entries.map((e, i) => `${i + 1}. [${new Date(e.at).toTimeString().slice(0, 5)}] ${e.text}`).join('\n') || '(no entries)'}

Estimate calories and macros conservatively when portions are vague — pick
a reasonable middle estimate, never a flattering low one. Treat homemade
Indian/Asian portions as larger than menu defaults unless the user says
otherwise.

Reply ONLY with a single JSON object, no prose around it, matching this
TypeScript type exactly:

type DayReport = {
  totalCalories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  items: { name: string; qty: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number }[];
  targetCalories: number;        // from profile.dailyCalorieTarget
  surplusOrDeficit: number;      // totalCalories - targetCalories
  proteinTargetG: number;
  proteinGap: number;            // proteinTargetG - protein_g
  goalAlignment: 'aligned' | 'off-track' | 'badly-off-track';
  verdict: string;               // 2-4 sentences. Strict, plain, honest.
  riskFlags: string[];           // e.g. "very low protein", "ultra-processed >50% calories"
  improvements: string[];        // 3-6 concrete next-meal suggestions
};`;
}

function strictRangePrompt(profile, kind, startKey, endKey, entries, savedDailyReports) {
  return `You are an experienced, no-nonsense clinical dietitian writing a
${kind} report for the user. Be honest, specific, and brief. Compare
performance to their stated goal weight and daily calorie target.

User profile:
${JSON.stringify(profile, null, 2)}

Range: ${startKey} → ${endKey}

Daily reports already produced for days in this range (may be partial):
${JSON.stringify(savedDailyReports, null, 2)}

Raw food entries for the range (in case some days were never analysed):
${entries.map((e) => `[${e.date} ${new Date(e.at).toTimeString().slice(0, 5)}] ${e.text}`).join('\n') || '(none)'}

Reply ONLY with a single JSON object, no prose, matching:

type RangeReport = {
  kind: '${kind}';
  startDate: string;
  endDate: string;
  daysCovered: number;
  daysLogged: number;
  avgCaloriesPerLoggedDay: number;
  estimatedWeightChangeKg: number;   // negative = lost. Use 7700 kcal ≈ 1 kg fat.
  goalProgress: 'on-track' | 'slow' | 'off-track' | 'reversing';
  bestDay: { date: string; reason: string } | null;
  worstDay: { date: string; reason: string } | null;
  patterns: string[];                // e.g. "skips breakfast on weekdays"
  verdict: string;                   // 3-6 sentences. Strict. No flattery.
  nextWeekPlan: string[];            // 4-8 concrete actions for the next period
};`;
}

async function callGemini({ prompt, key, model }) {
  if (!key) throw new Error('No API key configured. Add it in Calorie settings.');
  const url = `${ENDPOINT}/${encodeURIComponent(model || DEFAULT_MODEL)}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    }),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 400); } catch (_) { /* ignore */ }
    throw new Error(`Gemini ${res.status}: ${detail || res.statusText}`);
  }
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  if (!text) throw new Error('Gemini returned an empty response.');
  // Be defensive — even with responseMimeType:application/json the model
  // sometimes wraps the payload in fences.
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error('Gemini returned non-JSON text. Try again.');
  }
}

/* ----- Public analysis API --------------------------------------------- */

export async function analyseDay(dateKey = todayKey()) {
  const [profile, key, model, entries] = await Promise.all([
    getCalorieProfile(),
    getGeminiKey(),
    getGeminiModel(),
    listFoodEntriesForDate(dateKey),
  ]);
  const prompt = strictDailyPrompt(profile, dateKey, entries);
  const json = await callGemini({ prompt, key, model });
  const id = dayReportId(dateKey);
  const report = {
    id,
    kind: 'day',
    startDate: dateKey,
    endDate: dateKey,
    json,
    profileSnapshot: profile,
    entryCount: entries.length,
  };
  await saveFoodReport(report);
  return report;
}

export async function analyseRange(kind, startKey, endKey) {
  if (!['week', 'month'].includes(kind)) throw new Error('Unsupported range kind');
  const [profile, key, model, entries, allReports] = await Promise.all([
    getCalorieProfile(),
    getGeminiKey(),
    getGeminiModel(),
    listFoodEntriesBetween(startKey, endKey),
    listFoodReports('day'),
  ]);
  const dailyReports = allReports
    .filter((r) => r.startDate >= startKey && r.startDate <= endKey)
    .map((r) => ({ date: r.startDate, json: r.json }));
  const prompt = strictRangePrompt(profile, kind, startKey, endKey, entries, dailyReports);
  const json = await callGemini({ prompt, key, model });
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
    entryCount: entries.length,
  };
  await saveFoodReport(report);
  return report;
}

export { getFoodReport };
