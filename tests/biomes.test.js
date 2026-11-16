import { test, assert } from './harness.js?v=0.13.0';
import { getFloorBiome, getBiome } from '../biomes.js?v=0.13.0';
import { getAvailableMonsterTypes } from '../monster-types.js?v=0.13.0';
import { decorateFloor } from '../floor-theme.js?v=0.13.0';
import { generateFloor, validateFloor } from '../generator.js?v=0.13.0';
import { getDifficulty } from '../difficulty.js?v=0.13.0';
test('Биомы: три последовательных этапа и повтор цикла, неверный ввод безопасен', () => {
  assert(getFloorBiome(1).id === 'fortress' && getFloorBiome(3).id === 'fortress');
  assert(getFloorBiome(4).id === 'flooded' && getFloorBiome(7).id === 'ash');
  assert(getFloorBiome(10).id === 'fortress');
  assert(getFloorBiome(NaN).id === 'fortress' && getBiome('missing').id === 'fortress');
});
test('Типы: новые монстры открываются постепенно', () => {
  assert(getAvailableMonsterTypes(1).join(',') === 'shadow');
  assert(getAvailableMonsterTypes(3).includes('listener'));
  assert(!getAvailableMonsterTypes(5).includes('charger'));
  assert(getAvailableMonsterTypes(6).includes('charger'));
});
test('Оформление: не меняет клетки/позиции и воспроизводит состав по seed', () => {
  const map = generateFloor({ seed: 39, floor: 9, difficulty: getDifficulty(9) });
  const base = { ...map, enemies: map.enemies.map(({ type, ...rest }) => rest) };
  const before = JSON.stringify(base);
  const a = decorateFloor(base, { seed: 39, floor: 9 }),
    b = decorateFloor(base, { seed: 39, floor: 9 });
  assert(JSON.stringify(base) === before);
  assert(a.walkable === base.walkable && a.walls === base.walls && a.spawns === base.spawns);
  assert(JSON.stringify(a) === JSON.stringify(b));
  assert(
    a.enemies.map((e) => `${e.x}:${e.z}`).join(',') ===
      base.enemies.map((e) => `${e.x}:${e.z}`).join(','),
  );
  assert(new Set(a.enemies.map((e) => e.type)).size === 3);
});
test('Генерация: биом и допустимые типы назначаются 1000 seeds и fallback', () => {
  for (let seed = 0; seed < 1000; seed++) {
    const floor = 1 + (seed % 18),
      map = generateFloor({ seed, floor, difficulty: getDifficulty(floor) });
    assert(map.biome === getFloorBiome(floor).id);
    assert(map.enemies.every((enemy) => getAvailableMonsterTypes(floor).includes(enemy.type)));
    assert(validateFloor(map).valid);
  }
  const fallback = generateFloor({ seed: 2, floor: 8, roomTemplates: [] });
  assert(fallback.biome === 'ash' && fallback.enemies.every((enemy) => enemy.type));
});
