const STORAGE_KEY = 'beam-in-the-dark:progress';
const defaults = () => ({
  version: 1,
  best: 0,
  muted: false,
  tutorialSeen: false,
  quality: 'auto',
  touchAim: 'movement',
});
function normalize(value) {
  const result = defaults();
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1)
    return result;
  if (Number.isSafeInteger(value.best) && value.best >= 0) result.best = value.best;
  if (typeof value.muted === 'boolean') result.muted = value.muted;
  if (typeof value.tutorialSeen === 'boolean') result.tutorialSeen = value.tutorialSeen;
  if (['auto', 'low', 'normal'].includes(value.quality)) result.quality = value.quality;
  if (['movement', 'dual'].includes(value.touchAim)) result.touchAim = value.touchAim;
  return result;
}
function getStorage(storage) {
  try {
    return storage === undefined ? globalThis.localStorage : storage;
  } catch {
    return null;
  }
}
export function loadProgress(storage) {
  try {
    return normalize(JSON.parse(getStorage(storage)?.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    return defaults();
  }
}
export function saveProgress(storage, progress) {
  try {
    const target = getStorage(storage);
    if (!target) return false;
    target.setItem(STORAGE_KEY, JSON.stringify(normalize({ ...progress, version: 1 })));
    return true;
  } catch {
    return false;
  }
}
