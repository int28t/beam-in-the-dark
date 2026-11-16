import { test, assert, near } from './harness.js';
import { parseMap } from '../map.js';
import { hasLineOfSight, findPath, inCone } from '../navigation.js';
import { createEllipseCollider } from '../collision.js';
import { createEnemy } from '../enemy.js';
const map = parseMap(['#######', '#P.#..#', '#..#..#', '#.....#', '#######']);
test('Видимость: стена перекрывает взгляд и свет, проход не перекрывает', () => {
  assert(!hasLineOfSight({ x: 1.5, z: 1.5 }, { x: 7.5, z: 1.5 }, map));
  assert(hasLineOfSight({ x: 1.5, z: 4.5 }, { x: 7.5, z: 4.5 }, map));
  assert(inCone({ x: 0, z: 0 }, { x: 0, z: 1 }, { x: 0, z: 4 }, 5, 0.8));
  assert(!inCone({ x: 0, z: 0 }, { x: 0, z: 1 }, { x: 4, z: 0 }, 5, 0.8));
  assert(!inCone({ x: 0, z: 0 }, { x: 0, z: 1 }, { x: 0, z: 6 }, 5, 0.8));
});
test('Навигация: путь огибает стену, не перескакивает через край строки', () => {
  const path = findPath({ x: 1.5, z: 1.5 }, { x: 7.5, z: 1.5 }, map);
  assert(path.length === 9);
  assert(path.some((p) => p.z === 4.5));
  assert(findPath({ x: 0, z: 0 }, { x: 7.5, z: 1.5 }, map).length === 0);
});
test('HOTFIX: эллипс проходит вдоль стены нижней частью и не пробивает её', () => {
  const wall = { minX: 1, maxX: 2, minZ: -1, maxZ: 1 };
  const collider = createEllipseCollider([wall], 0.24, 0.16);
  const p = { x: 0, z: 0 };
  collider.move(p, { x: 5, z: 0 });
  near(p.x, 0.76);
  const below = { x: 1.5, z: 1.18 };
  collider.move(below, { x: 0.1, z: 0 });
  near(below.x, 1.6);
  collider.move(below, { x: 0, z: -5 });
  near(below.z, 1.16);
});
test('Враг: за стеной нет обнаружения и замедления фонарём', () => {
  const enemy = createEnemy(
    { x: 7.5, z: 1.5, aimX: -1, aimZ: 0, patrol: [{ x: 7.5, z: 1.5 }] },
    map,
  );
  const world = { player: { x: 1.5, z: 1.5 }, moving: true, lightOn: true, aim: { x: 1, z: 0 } };
  enemy.update(0.05, world);
  assert(enemy.phase === 'patrol' && !enemy.illuminated);
});
test('Враг: погоня, последняя известная позиция, поиск и возврат к патрулю', () => {
  const enemy = createEnemy(
    { x: 1.5, z: 4.5, aimX: 1, aimZ: 0, patrol: [{ x: 1.5, z: 4.5 }] },
    map,
  );
  const world = { player: { x: 4.5, z: 4.5 }, moving: true, lightOn: false, aim: { x: -1, z: 0 } };
  enemy.update(0.05, world);
  assert(enemy.phase === 'chase');
  near(enemy.lastKnown.x, 4.5);
  world.player.x = 7.5;
  world.player.z = 1.5;
  world.moving = false;
  enemy.update(0.05, world);
  assert(enemy.phase === 'search');
  near(enemy.lastKnown.x, 4.5);
  for (let i = 0; i < 160; i++) enemy.update(0.05, world);
  assert(enemy.phase === 'patrol');
});
test('Враг: прямой свет замедляет движение и сброс возвращает старт', () => {
  const spawn = { x: 1.5, z: 4.5, aimX: 1, aimZ: 0, patrol: [{ x: 1.5, z: 4.5 }] };
  const normal = createEnemy(spawn, map),
    lit = createEnemy(spawn, map);
  const world = { player: { x: 6, z: 4.5 }, moving: false, lightOn: false, aim: { x: -1, z: 0 } };
  normal.update(0.05, world);
  world.lightOn = true;
  lit.update(0.05, world);
  assert(lit.illuminated && lit.position.x < normal.position.x);
  lit.reset();
  near(lit.position.x, 1.5);
  assert(lit.phase === 'patrol' && !lit.illuminated);
});
