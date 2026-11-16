import { getFloorBiome } from './biomes.js?v=0.13.0';
import { getAvailableMonsterTypes } from './monster-types.js?v=0.13.0';

// A separate deterministic stream keeps existing room geometry and placements unchanged.
export function decorateFloor(map, { seed = map.seed ?? 1, floor = map.floor ?? 1 } = {}) {
  const biome = getFloorBiome(floor),
    available = getAvailableMonsterTypes(floor);
  const pool = biome.preferred.filter((id) => available.includes(id));
  const offset =
    (Math.imul((Number(seed) >>> 0) ^ Math.imul(floor, 2654435761), 1597334677) >>> 0) %
    pool.length;
  return {
    ...map,
    biome: biome.id,
    enemies: (map.enemies ?? []).map((spawn, index) => ({
      ...spawn,
      type: pool[(offset + index) % pool.length],
    })),
  };
}
