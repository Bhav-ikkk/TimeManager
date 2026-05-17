/**
 * src/lib/aiProviders.js
 *
 * Multi-provider LLM client. The user picks ONE provider (Groq, Gemini,
 * OpenRouter) and pastes their own key. Everything is BYOK and stays in
 * the browser — keys live in IndexedDB and are sent directly to the
 * provider's endpoint over HTTPS. We never proxy anything.
 *
 * All three providers can return strict JSON. We always ask for JSON,
 * defensively strip ``` fences, and parse.
 */

export const PROVIDERS = {
  groq: {
    id: 'groq',
    label: 'Groq (free, very fast)',
    docs: 'https://console.groq.com/keys',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'llama-3.3-70b-versatile',
    models: [
      { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (recommended)' },
      { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (fastest)' },
      { value: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B' },
      { value: 'qwen/qwen3-32b', label: 'Qwen 3 32B' },
    ],
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    docs: 'https://aistudio.google.com/apikey',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    defaultModel: 'gemini-2.5-flash',
    models: [
      { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash (fast, free tier)' },
      { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro (most accurate)' },
      { value: 'gemini-2.0-flash', label: 'gemini-2.0-flash' },
    ],
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter (many free models)',
    docs: 'https://openrouter.ai/keys',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    models: [
      { value: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (free)' },
      { value: 'deepseek/deepseek-chat-v3.1:free', label: 'DeepSeek Chat v3.1 (free)' },
      { value: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash (free)' },
      { value: 'qwen/qwen-2.5-72b-instruct:free', label: 'Qwen 2.5 72B (free)' },
      { value: 'mistralai/mistral-small-3.2-24b-instruct:free', label: 'Mistral Small 3.2 (free)' },
    ],
  },
};

export function maskKey(key) {
  if (!key) return '';
  if (key.length <= 8) return '•'.repeat(key.length);
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

function stripJsonFences(text) {
  return String(text || '')
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

function parseJsonLoose(text) {
  const cleaned = stripJsonFences(text);
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // Last resort: extract the largest {...} block.
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch (_) {}
    }
    throw new Error('AI provider returned non-JSON text. Try again.');
  }
}

const DEFAULT_SYSTEM_PROMPT = 'You are a strict, evidence-based clinical dietitian. You always reply with a single valid JSON object that matches the requested schema exactly. No prose outside the JSON. No markdown fences.';

async function callGroqOrOpenRouter(provider, { prompt, key, model, system, temperature = 0.2 }) {
  const cfg = PROVIDERS[provider];
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
  };
  if (provider === 'openrouter') {
    // OpenRouter wants attribution headers (optional but recommended).
    headers['HTTP-Referer'] = 'https://taunttable.app';
    headers['X-Title'] = 'TauntTable Calories';
  }
  const body = {
    model: model || cfg.defaultModel,
    messages: [
      {
        role: 'system',
        content: system || DEFAULT_SYSTEM_PROMPT,
      },
      { role: 'user', content: prompt },
    ],
    temperature,
    response_format: { type: 'json_object' },
  };
  const res = await fetch(cfg.endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 400); } catch (_) {}
    throw new Error(`${cfg.label} ${res.status}: ${detail || res.statusText}`);
  }
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content || '';
  if (!text) throw new Error(`${cfg.label} returned an empty response.`);
  return parseJsonLoose(text);
}

async function callGemini({ prompt, key, model, system, temperature = 0.2 }) {
  const cfg = PROVIDERS.gemini;
  const m = model || cfg.defaultModel;
  const url = `${cfg.endpoint}/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        responseMimeType: 'application/json',
      },
    }),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 400); } catch (_) {}
    throw new Error(`Gemini ${res.status}: ${detail || res.statusText}`);
  }
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  if (!text) throw new Error('Gemini returned an empty response.');
  return parseJsonLoose(text);
}

export async function callAI({ provider, prompt, key, model, system, temperature }) {
  if (!key) throw new Error('No API key configured. Add one in Settings.');
  if (!PROVIDERS[provider]) throw new Error(`Unknown AI provider: ${provider}`);
  if (provider === 'gemini') return callGemini({ prompt, key, model, system, temperature });
  return callGroqOrOpenRouter(provider, { prompt, key, model, system, temperature });
}
