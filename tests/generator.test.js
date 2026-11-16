import { test, assert } from './harness.js';
import { generateFloor, validateFloor, ROOM_TEMPLATES } from '../generator.js';
import { cellIndex, distancesFrom } from '../navigation.js';
test('Генерация: одинаковые seed и этаж дают одинаковые карты и размещения', () => {
  const a = generateFloor({ seed: 142, floor: 2 }),
    b = generateFloor({ seed: 142, floor: 2 });
  assert(JSON.stringify(a) === JSON.stringify(b));
  assert(JSON.stringify(a) !== JSON.stringify(generateFloor({ seed: 143, floor: 2 })));
  assert(ROOM_TEMPLATES.length === 8);
});
test('Генерация: 1000 seeds связны, цели достижимы, предметы не пересекаются', () => {
  for (let seed = 0; seed < 1000; seed++) {
    const map = generateFloor({ seed, floor: 1 + (seed % 20) });
    const result = validateFloor(map);
    assert(result.valid, `Seed ${seed}: ${result.errors.join(', ')}`);
    assert(map.rooms.length >= 4 && map.rooms.length <= 8);
    const distances = distancesFrom(map.spawns.player, map);
    const used = new Set();
    for (const point of [
      map.spawns.player,
      map.spawns.key,
      map.spawns.exit,
      ...map.batteries,
      ...map.enemies,
    ]) {
      const index = cellIndex(point, map);
      assert(distances[index] >= 0 && !used.has(index));
      used.add(index);
    }
    for (const enemy of map.enemies) assert(distances[cellIndex(enemy, map)] >= 8);
    for (const link of map.connections)
      for (const point of link.cells) assert(map.walkable[cellIndex(point, map)]);
  }
});
test('Генерация: пустая библиотека ограничивает попытки и возвращает резервную карту', () => {
  const map = generateFloor({ seed: 19, floor: 1, roomTemplates: [] });
  assert(map.fallback && map.attempts === 20 && validateFloor(map).valid);
});
test('Валидация: отсутствующая цель, стена под предметом и изолированный пол отклоняются', () => {
  const map = generateFloor({ seed: 5, floor: 1 });
  assert(!validateFloor({ ...map, spawns: { ...map.spawns, key: null } }).valid);
  assert(!validateFloor({ ...map, enemies: [{ x: 0, z: 0 }] }).valid);
  const walkable = map.walkable.slice();
  walkable[0] = 1;
  assert(!validateFloor({ ...map, walkable }).valid);
});
