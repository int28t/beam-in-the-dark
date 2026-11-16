const PROFILES = Object.freeze({
  low: Object.freeze({ name: 'low', pixelRatio: 1, shadowSize: 512, decor: false }),
  normal: Object.freeze({ name: 'normal', pixelRatio: 1.5, shadowSize: 1024, decor: true }),
});
export function getQualityProfile(mode, touch = false) {
  return mode === 'low' || (mode !== 'normal' && touch) ? PROFILES.low : PROFILES.normal;
}
export function applyQuality({
  renderer,
  light,
  mapView,
  mode = 'auto',
  touch = false,
  devicePixelRatio = 1,
}) {
  const profile = getQualityProfile(mode, touch);
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  renderer.setPixelRatio(Math.min(ratio, profile.pixelRatio));
  renderer.shadowMap.enabled = true;
  if (light.shadow.mapSize.x !== profile.shadowSize) {
    light.shadow.map?.dispose();
    light.shadow.mapPass?.dispose();
    light.shadow.map = null;
    light.shadow.mapPass = null;
    light.shadow.mapSize.set(profile.shadowSize, profile.shadowSize);
    light.shadow.needsUpdate = true;
  }
  mapView?.setQuality(profile.decor);
  return profile;
}
