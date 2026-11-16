import { test } from './harness.js';
import { generateFloor } from '../generator.js';
import { getDifficulty } from '../difficulty.js';
import { findPath } from '../navigation.js';
import { createWorld } from '../world.js';
import { createGame } from '../game.js';
import { PLAYER } from '../config.js';
test('Интеграция: 100 этажей проходимы эллипсом, ключ и дверь работают (без врагов)', () => {
  let steps = 0;
  for (let seed = 0; seed < 50; seed++)
    for (const floor of [1, 12]) {
      const map = generateFloor({ seed, floor, difficulty: getDifficulty(floor) });
      const world = createWorld({ ...map, enemies: [] }),
        game = createGame();
      game.dispatch('start');
      const controls = { moveX: 0, moveZ: 0, aimX: 0, aimZ: -1 };
      const path = [
        ...findPath(world.position, map.spawns.key, map),
        ...findPath(map.spawns.key, map.spawns.exit, map).slice(1),
      ];
      for (const point of path) {
        let count = 0;
        while (
          Math.hypot(point.x - world.position.x, point.z - world.position.z) > 0.025 &&
          game.state.phase === 'playing'
        ) {
          if (++count > 1000)
            throw new Error(
              `Stuck seed=${seed} floor=${floor} at ${JSON.stringify(world.position)} towards ${JSON.stringify(point)}`,
            );
          const dx = point.x - world.position.x,
            dz = point.z - world.position.z,
            length = Math.hypot(dx, dz),
            strength = Math.min(1, length / (PLAYER.speed * 0.05));
          controls.moveX = (dx / length) * strength;
          controls.moveZ = (dz / length) * strength;
          controls.aimX = dx;
          controls.aimZ = dz;
          world.step(0.05, controls, game);
          steps++;
        }
      }
      if (game.state.phase !== 'floorComplete')
        throw new Error(`Incomplete seed ${seed}: ${game.state.phase}`);
    }
});
