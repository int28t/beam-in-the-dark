export const BIOMES = Object.freeze({
  fortress: Object.freeze({
    id: 'fortress',
    name: 'Глухая крепость',
    description: 'Холодная кладка и покинутые караульные залы.',
    floor: 0x4a5b64,
    wall: 0x33434e,
    cap: 0x5b6c78,
    accent: 0x82919c,
    fog: 0x101114,
    fogDensity: 0.075,
    sky: 0x9aafb6,
    ground: 0x080b0d,
    ambient: 0.12,
    moon: 0.08,
    preferred: Object.freeze(['shadow', 'warden', 'mimic', 'listener', 'charger', 'parasite']),
  }),
  flooded: Object.freeze({
    id: 'flooded',
    name: 'Затопленный склеп',
    description: 'Мелководье, зелёный камень и заросшие гробницы.',
    floor: 0x3c5350,
    wall: 0x2d4741,
    cap: 0x4d6960,
    accent: 0x719b8d,
    water: 0x30675f,
    fog: 0x0e1312,
    fogDensity: 0.08,
    sky: 0x90b7ac,
    ground: 0x07110b,
    ambient: 0.1,
    moon: 0.065,
    preferred: Object.freeze(['listener', 'parasite', 'shadow', 'warden', 'mimic', 'charger']),
  }),
  ash: Object.freeze({
    id: 'ash',
    name: 'Пепельная часовня',
    description: 'Обугленные обелиски и тлеющие швы камня.',
    floor: 0x56443e,
    wall: 0x42332f,
    cap: 0x6c5144,
    accent: 0xa6663c,
    fog: 0x151111,
    fogDensity: 0.075,
    sky: 0xb59b9a,
    ground: 0x160a06,
    ambient: 0.11,
    moon: 0.055,
    preferred: Object.freeze(['mimic', 'charger', 'parasite', 'warden', 'shadow', 'listener']),
  }),
});
const ORDER = Object.freeze(['fortress', 'flooded', 'ash']);
export function getBiome(id) {
  return Object.hasOwn(BIOMES, id) ? BIOMES[id] : BIOMES.fortress;
}
export function getFloorBiome(floor) {
  const level = Number.isFinite(floor) ? Math.max(1, Math.floor(floor)) : 1;
  return BIOMES[ORDER[Math.floor((level - 1) / 3) % ORDER.length]];
}
