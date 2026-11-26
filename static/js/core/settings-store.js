import { PROVIDERS } from '../ai/providers.js';
import { S, SETTINGS_KEY, busy, conversations, currentId, editingId, memorySettings, moodleAllFunctions, moodleCMIds, moodleContents, moodleContext, moodleCourses, moodleEvents, moodleFunctions, moodleMaterials, moodleMemory, moodlePeople, moodlePeopleIds, moodleProfileContext, moodleSessionPromise, moodleSessionReady, moodleTasks, moodleURLs, moodleUser, moodleUserId } from './state.js';
export function normalizeSettings(s) {
  const provider = PROVIDERS[s && s.provider] ? s.provider : "gemini";
  const model =
    typeof s?.model === "string" && s.model.trim()
      ? s.model.trim()
      : PROVIDERS[provider].defaultModel;
  return {
    provider,
    apiKey: typeof s?.apiKey === "string" ? s.apiKey.trim() : "",
    model,
  };
}
export function getSettings() {
  const fallback = normalizeSettings({});
  if (S.memorySettings) return normalizeSettings(S.memorySettings);
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? normalizeSettings(JSON.parse(raw)) : fallback;
  } catch (e) {
    return fallback;
  }
}
export function saveSettings(s) {
  S.memorySettings = normalizeSettings(s);
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(S.memorySettings));
  } catch (e) {}
}
export function clearSettings() {
  S.memorySettings = null;
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch (e) {}
}
