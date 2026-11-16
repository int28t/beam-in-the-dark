import { earnedSkins } from './skins.js?v=0.13.0';
export const STORAGE_KEY = 'beam-in-the-dark:progress';
export const DEFAULT_SAVE = Object.freeze({
  version: 2,
  best: 0,
  muted: false,
  tutorialSeen: false,
  quality: 'auto',
  touchAim: 'movement',
  skins: Object.freeze({ unlocked: Object.freeze(['classic']), selected: 'classic' }),
  updatedAt: 0,
  resetAt: 0,
  resetPending: false,
});
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const skinId = (value) => typeof value === 'string' && /^[a-z0-9_-]{1,40}$/.test(value);
function clean(value, depth = 0) {
  if (depth > 20) return null;
  if (Array.isArray(value)) return value.map((item) => clean(item, depth + 1));
  if (object(value))
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !['__proto__', 'constructor', 'prototype'].includes(key))
        .map(([key, item]) => [key, clean(item, depth + 1)]),
    );
  return value;
}
export function mergeFields(base, patch) {
  if (!object(patch)) return clean(base);
  const out = clean(base);
  for (const [key, value] of Object.entries(clean(patch)))
    out[key] = object(value) && object(out[key]) ? mergeFields(out[key], value) : clean(value);
  return out;
}
export function isFutureSave(value) {
  return object(value) && Number.isInteger(value.version) && value.version > 2;
}
export function normalizeSave(value) {
  const source = object(value) && (value.version === 1 || value.version === 2) ? value : {};
  const out = mergeFields(DEFAULT_SAVE, source);
  out.version = 2;
  out.best = integer(source.best) ? source.best : 0;
  for (const key of ['muted', 'tutorialSeen', 'resetPending'])
    out[key] = typeof source[key] === 'boolean' ? source[key] : false;
  out.quality = ['auto', 'low', 'normal'].includes(source.quality) ? source.quality : 'auto';
  out.touchAim = ['movement', 'dual'].includes(source.touchAim) ? source.touchAim : 'movement';
  for (const key of ['updatedAt', 'resetAt']) out[key] = integer(source[key]) ? source[key] : 0;
  const skins = object(source.skins) ? source.skins : {};
  out.skins = {
    ...clean(skins),
    unlocked: [
      ...new Set([
        'classic',
        ...(Array.isArray(skins.unlocked) ? skins.unlocked.filter(skinId) : []),
      ]),
    ].slice(0, 64),
  };
  out.skins.unlocked = [...new Set([...out.skins.unlocked, ...earnedSkins(out.best)])];
  out.skins.selected =
    skinId(skins.selected) && out.skins.unlocked.includes(skins.selected)
      ? skins.selected
      : 'classic';
  return out;
}
export function mergeSaves(a, b) {
  a = normalizeSave(a);
  b = normalizeSave(b);
  if (a.resetAt !== b.resetAt) return normalizeSave(a.resetAt > b.resetAt ? a : b);
  const newer = a.updatedAt > b.updatedAt ? a : b,
    older = newer === a ? b : a;
  return normalizeSave(
    mergeFields(mergeFields(older, newer), {
      best: Math.max(a.best, b.best),
      tutorialSeen: a.tutorialSeen || b.tutorialSeen,
      skins: { unlocked: [...new Set([...a.skins.unlocked, ...b.skins.unlocked])] },
    }),
  );
}
export function getStorage(storage) {
  try {
    return storage === undefined ? globalThis.localStorage : storage;
  } catch {
    return null;
  }
}
export function readSave(storage, key = STORAGE_KEY) {
  try {
    return JSON.parse(getStorage(storage)?.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}
export function loadProgress(storage, key = STORAGE_KEY) {
  return normalizeSave(readSave(storage, key));
}
export function saveProgress(storage, progress, key = STORAGE_KEY) {
  try {
    const target = getStorage(storage);
    if (!target || isFutureSave(readSave(target, key))) return false;
    target.setItem(key, JSON.stringify(normalizeSave({ ...progress, version: 2 })));
    return true;
  } catch {
    return false;
  }
}
