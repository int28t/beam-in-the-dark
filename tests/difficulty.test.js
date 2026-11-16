import { test, assert } from './harness.js?v=0.13.0';
import { getDifficulty } from '../difficulty.js?v=0.13.0';
import { generateFloor } from '../generator.js?v=0.13.0';
import { PLAYER } from '../config.js?v=0.13.0';
test('Сложность: ранний этаж мягче предельного, параметры ограничены', () => {
  const early = getDifficulty(1),
    late = getDifficulty(1000000000);
  assert(early.roomCount === 4 && early.enemyCount === 1);
  assert(
    late.roomCount === 8 && late.enemyCount <= 3 && late.enemyOptions.chaseSpeed < PLAYER.speed,
  );
  assert(JSON.stringify(late) === JSON.stringify(getDifficulty(1000)));
  assert(JSON.stringify(getDifficulty(NaN)) === JSON.stringify(early));
});
test('Сложность: генерация использует пределы и оставляет ресурсы на каждом диапазоне', () => {
  for (const floor of [1, 4, 8, 1000000]) {
    const difficulty = getDifficulty(floor),
      map = generateFloor({ seed: 80, floor, difficulty });
    assert(map.rooms.length === difficulty.roomCount);
    assert(map.enemies.length === difficulty.enemyCount);
    assert(map.batteries.length >= 3 && map.enemyOptions.chaseSpeed < PLAYER.speed);
  }
});
