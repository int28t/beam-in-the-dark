import { test, assert, near } from './harness.js';
import { parseMap } from '../map.js';
import { createEnemy } from '../enemy.js';
import { getMonsterType } from '../monster-types.js';
const corner = parseMap(['#######', '#P.#..#', '#..#..#', '#.....#', '#######']);
const open = parseMap([
  '#############',
  '#P..........#',
  '#...........#',
  '#...........#',
  '#...........#',
  '#...........#',
  '#############',
]);
function world(player, moving = false) {
  return { player, moving, lightOn: false, aim: { x: -1, z: 0 } };
}
function until(enemy, phase, scene, limit = 80) {
  for (let i = 0; i < limit && enemy.phase !== phase; i++) enemy.update(0.05, scene);
  assert(enemy.phase === phase, `Ожидалось ${phase}, получено ${enemy.phase}`);
}
test('Слухач: не обнаруживает неподвижного игрока прямо перед собой', () => {
  const enemy = createEnemy({ x: 3, z: 4.5, type: 'listener', aimX: 1, aimZ: 0 }, open);
  enemy.update(0.05, world({ x: 6, z: 4.5 }));
  assert(enemy.type === 'listener' && enemy.phase === 'patrol');
});
test('Слухач: слышит шаги за углом и хранит именно последнюю услышанную позицию', () => {
  const enemy = createEnemy({ x: 3, z: 3, type: 'listener' }, corner);
  const scene = world({ x: 6, z: 3 }, true);
  enemy.update(0.05, scene);
  assert(enemy.phase === 'chase');
  near(enemy.lastKnown.x, 6);
  near(enemy.lastKnown.z, 3);
  scene.moving = false;
  scene.player.x = 7.5;
  scene.player.z = 1.5;
  enemy.update(0.05, scene);
  assert(enemy.phase === 'search');
  near(enemy.lastKnown.x, 6);
  near(enemy.lastKnown.z, 3);
});
test('Слухач: соседняя, но недоступная область не слышна', () => {
  const isolated = parseMap(['#######', '#P.#..#', '#..#..#', '#######']);
  const enemy = createEnemy({ x: 3, z: 1.5, type: 'listener' }, isolated);
  enemy.update(0.05, world({ x: 6, z: 1.5 }, true));
  assert(enemy.phase === 'patrol');
});
test('Ловчий: подготовка видна заранее, рывок не поворачивает за игроком', () => {
  const enemy = createEnemy({ x: 3, z: 4.5, type: 'charger', aimX: 1, aimZ: 0 }, open);
  const scene = world({ x: 6, z: 4.5 });
  enemy.update(0.05, scene);
  assert(enemy.phase === 'windup' && enemy.isThreat);
  near(enemy.position.x, 3);
  enemy.update(0.05, scene);
  assert(enemy.phase === 'windup');
  near(enemy.position.x, 3);
  scene.player.z = 7.5;
  until(enemy, 'dash', scene);
  enemy.update(0.05, scene);
  assert(enemy.position.x > 3);
  near(enemy.position.z, 4.5);
  until(enemy, 'recover', scene);
  assert(enemy.position.x < 6.3);
});
test('Ловчий: свет отменяет подготовку, сброс очищает атаку и память', () => {
  const enemy = createEnemy({ x: 3, z: 4.5, type: 'charger', aimX: 1, aimZ: 0 }, open);
  const scene = world({ x: 6, z: 4.5 });
  enemy.update(0.05, scene);
  assert(enemy.phase === 'windup');
  scene.lightOn = true;
  enemy.update(0.05, scene);
  assert(enemy.phase === 'recover');
  near(enemy.position.x, 3);
  enemy.reset();
  assert(enemy.phase === 'patrol' && !enemy.isThreat);
  near(enemy.lastKnown.x, 3);
  near(enemy.lastKnown.z, 4.5);
});
test('Ловчий: касание угла стены завершает рывок без скольжения сквозь стену', () => {
  const enemy = createEnemy({ x: 3, z: 3.9, type: 'charger', aimX: 1, aimZ: 0 }, corner);
  const scene = world({ x: 6, z: 3.9 });
  enemy.update(0.05, scene);
  assert(enemy.phase === 'windup');
  until(enemy, 'dash', scene);
  until(enemy, 'recover', scene);
  assert(enemy.position.x < 3.75);
  near(enemy.position.z, 3.9);
});
test('Типы: неизвестный тип совместим со старой Тенью', () => {
  const enemy = createEnemy({ x: 3, z: 4.5, type: 'constructor' }, open);
  assert(enemy.type === 'shadow' && getMonsterType('constructor').id === 'shadow');
});
