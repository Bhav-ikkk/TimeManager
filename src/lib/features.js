import { getSetting, setSetting } from './db';

export const DIET_FEATURE_KEY = 'diet-feature-enabled';
export const DIET_FEATURE_EVENT = 'tt-diet-feature-changed';

export const GITHUB_REPO_URL = 'https://github.com/Bhav-ikkk/TimeManager';
export const GITHUB_STAR_URL = GITHUB_REPO_URL;

export async function getDietFeatureEnabled() {
  return Boolean(await getSetting(DIET_FEATURE_KEY, false));
}

export async function setDietFeatureEnabled(enabled) {
  const value = Boolean(enabled);
  await setSetting(DIET_FEATURE_KEY, value);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DIET_FEATURE_EVENT, { detail: { enabled: value } }));
  }
  return value;
}