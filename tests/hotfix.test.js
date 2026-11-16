import { test, assert, near } from './harness.js?v=0.13.0';
import { createEnemy } from '../enemy.js?v=0.13.0';
import { createWorld } from '../world.js?v=0.13.0';
import { createGame } from '../game.js?v=0.13.0';
import { createInputState } from '../input.js?v=0.13.0';
import { parseMap } from '../map.js?v=0.13.0';
import { generateFloor } from '../generator.js?v=0.13.0';
import { MONSTER_TYPES } from '../monster-types.js?v=0.13.0';
const open = parseMap([
  '#############',
  '#P.K......D.#',
  '#...........#',
  '#...........#',
  '#...........#',
  '#...........#',
  '#############',
]);
const scene = (player, extra = {}) => ({
  player,
  moving: false,
  noise: 0,
  lightOn: false,
  aim: { x: -1, z: 0 },
  ...extra,
});
test('Сталкер: луч останавливает и затем отталкивает, стена блокирует эффект', () => {
  const enemy = createEnemy({ type: 'shadow', x: 4.5, z: 4.5, aimX: -1, aimZ: 0 }, open);
  const world = scene({ x: 1.5, z: 4.5 }, { lightOn: true, aim: { x: 1, z: 0 } });
  enemy.update(0.05, world);
  assert(enemy.phase === 'repelled');
  near(enemy.position.x, 4.5);
  for (let i = 0; i < 12; i++) enemy.update(0.05, world);
  assert(enemy.position.x > 4.5);
});
test('Громила: тихие шаги не слышны, громкие слышны, луч не замедляет', () => {
  const make = () => createEnemy({ type: 'listener', x: 4.5, z: 4.5 }, open);
  const quiet = make();
  quiet.update(0.05, scene({ x: 1.5, z: 4.5 }, { moving: true, noise: 0.4 }));
  assert(quiet.phase === 'patrol');
  const a = make(),
    b = make();
  a.update(0.05, scene({ x: 1.5, z: 4.5 }, { moving: true, noise: 1 }));
  b.update(
    0.05,
    scene({ x: 1.5, z: 4.5 }, { moving: true, noise: 1, lightOn: true, aim: { x: 1, z: 0 } }),
  );
  assert(a.phase === 'chase' && a.roared);
  near(a.position.x, b.position.x);
  assert(!b.lightAffected);
});
test('Надзиратель: красный конус видит, за спиной и за стеной не видит', () => {
  const make = (map) => createEnemy({ type: 'warden', x: 4.5, z: 4.5, aimX: 1, aimZ: 0 }, map);
  const a = make(open);
  a.update(0.05, scene({ x: 7.5, z: 4.5 }));
  assert(a.phase === 'chase');
  const b = make(open);
  b.update(0.05, scene({ x: 1.5, z: 4.5 }, { moving: true, noise: 1 }));
  assert(b.phase === 'patrol');
  const blocked = parseMap(['#######', '#P.#..#', '#..#..#', '#.....#', '#######']);
  const c = createEnemy({ type: 'warden', x: 3, z: 1.5, aimX: 1, aimZ: 0 }, blocked);
  c.update(0.05, scene({ x: 6, z: 1.5 }));
  assert(c.phase === 'patrol');
});
test('Мимик: наблюдение останавливает, отворот запускает, без линии видимости нет знания', () => {
  const enemy = createEnemy({ type: 'mimic', x: 4.5, z: 4.5 }, open);
  const world = scene({ x: 1.5, z: 4.5 }, { lightOn: true, aim: { x: 1, z: 0 } });
  enemy.update(0.05, world);
  near(enemy.position.x, 4.5);
  assert(enemy.phase === 'frozen');
  world.aim.x = -1;
  enemy.update(0.05, world);
  assert(enemy.position.x < 4.5 && enemy.isThreat);
  world.lightOn = false;
  world.aim.x = 1;
  enemy.update(0.05, world);
  assert(enemy.phase === 'frozen');
  enemy.reset();
  near(enemy.position.x, 4.5);
  assert(enemy.phase === 'patrol');
});
test('Паразит: контакт забирает 35 заряда, не убивает, кулдаун и выключение защищают', () => {
  const map = { ...open, enemies: [{ type: 'parasite', x: 1.65, z: 1.5 }] };
  const world = createWorld(map),
    game = createGame();
  game.dispatch('start');
  const controls = { moveX: 0, moveZ: 0, aimX: 1, aimZ: 0 };
  world.step(0.05, controls, game);
  assert(game.state.phase === 'playing');
  assert(game.state.battery < 65 && game.state.battery > 64);
  assert(world.feedback.parasiteHit);
  const after = game.state.battery;
  world.step(0.05, controls, game);
  assert(after - game.state.battery < 1);
  game.dispatch('toggleLight');
  world.enemies[0].reset();
  world.step(0.05, controls, game);
  assert(!world.feedback.parasiteHit);
});
test('Паразит: ноль выключает свет и пауза не допускает укуса', () => {
  const game = createGame();
  game.dispatch('start');
  game.drainBattery(90);
  game.drainBattery(35);
  near(game.state.battery, 0);
  assert(!game.state.lightOn);
  game.dispatch('pause');
  game.drainBattery(100);
  near(game.state.battery, 0);
});
test('Тихая ходьба: Shift и touch toggle сбрасываются на паузе, скорость ниже', () => {
  const input = createInputState();
  input.setEnabled(true);
  input.keyDown('KeyD');
  input.keyDown('ShiftLeft');
  assert(input.sample().sneaking);
  input.keyUp('ShiftLeft');
  assert(!input.sample().sneaking);
  input.toggleSneak();
  assert(input.sample().sneaking);
  input.reset();
  assert(!input.sample().sneaking);
  const normal = createWorld(open),
    quiet = createWorld(open),
    a = createGame(),
    b = createGame();
  a.dispatch('start');
  b.dispatch('start');
  const controls = { moveX: 1, moveZ: 0, aimX: 1, aimZ: 0 };
  normal.step(0.05, controls, a);
  quiet.step(0.05, { ...controls, sneaking: true }, b);
  near(quiet.position.x - open.spawns.player.x, (normal.position.x - open.spawns.player.x) * 0.4);
});
test('Типы HOTFIX: присутствуют в реальных seed-пулах, поздний паразит не появляется рано', () => {
  const seen = new Set();
  for (let seed = 0; seed < 200; seed++) {
    const floor = 1 + (seed % 18),
      map = generateFloor({ seed, floor, difficulty: { enemyCount: 3 } });
    for (const enemy of map.enemies) {
      seen.add(enemy.type);
      assert(MONSTER_TYPES[enemy.type].unlockFloor <= floor);
    }
  }
  assert(
    ['shadow', 'listener', 'charger', 'warden', 'mimic', 'parasite'].every((id) => seen.has(id)),
  );
});

test('Надзиратель: луч игрока не сдерживает, после стены остаётся только последняя позиция', () => {
  const map = parseMap(['#######', '#P.#..#', '#..#..#', '#.....#', '#######']);
  const enemy = createEnemy({ type: 'warden', x: 3, z: 4.5, aimX: 1, aimZ: 0 }, map);
  const world = scene({ x: 6, z: 4.5 }, { lightOn: true });
  enemy.update(0.05, world);
  assert(enemy.type === 'warden' && enemy.phase === 'chase' && !enemy.lightAffected);
  near(enemy.lastKnown.x, 6);
  world.player.z = 1.5;
  enemy.update(0.05, world);
  assert(enemy.phase === 'search');
  near(enemy.lastKnown.z, 4.5);
});
test('Мимик и паразит: не обнаруживают игрока за стеной', () => {
  const map = parseMap(['#######', '#P.#..#', '#..#..#', '#.....#', '#######']);
  for (const type of ['mimic', 'parasite']) {
    const enemy = createEnemy({ type, x: 3, z: 1.5 }, map);
    enemy.update(0.05, scene({ x: 6, z: 1.5 }, { lightOn: true }));
    assert(enemy.phase === 'patrol');
  }
});
test('Паразит: повторный укус только после кулдауна, reset очищает его', () => {
  const enemy = createEnemy({ type: 'parasite', x: 3, z: 3 }, open);
  assert(enemy.tryBite(true) === 35 && enemy.tryBite(true) === 0);
  const world = scene({ x: 3, z: 3 }, { lightOn: true });
  for (let i = 0; i < 59; i++) enemy.update(0.05, world);
  assert(enemy.tryBite(true) === 0);
  enemy.update(0.05, world);
  assert(enemy.tryBite(true) === 35);
  enemy.reset();
  assert(enemy.tryBite(false) === 0 && enemy.tryBite(true) === 35);
});
test('Тихая ходьба: полный упор в стену не выдаёт игрока Громиле', () => {
  const map = { ...open, enemies: [{ type: 'listener', x: 4.5, z: 1.5 }] },
    world = createWorld(map),
    game = createGame();
  game.dispatch('start');
  world.position.x = 0.75 + 0.24;
  world.step(0.05, { moveX: -1, moveZ: 0, aimX: 0, aimZ: 1 }, game);
  assert(!world.feedback.walking && world.enemies[0].phase === 'patrol');
});

test('Красный сектор: дистанция луча заканчивается у первой стены', async () => {
  const { rayWallDistance } = await import('../navigation.js?v=0.13.0');
  const map = parseMap(['#######', '#P.#..#', '#..#..#', '#.....#', '#######']);
  near(rayWallDistance(3, 1.5, 1, 0, 7, map), 0.75);
  near(rayWallDistance(3, 4.5, 1, 0, 7, map), 5.25);
  near(rayWallDistance(4.5, 1.5, 1, 0, 7, map), 0);
});

test('Мимик: дальний взгляд вне луча не останавливает только из-за включённого фонаря', () => {
  const enemy = createEnemy({ type: 'mimic', x: 6, z: 6 }, open);
  enemy.update(0.05, scene({ x: 3, z: 3 }, { lightOn: true, aim: { x: 1, z: 0 } }));
  assert(!enemy.illuminated && enemy.phase === 'chase');
});
test('Сдержанные враги запоминают реально увиденного игрока до потери видимости', () => {
  const map = parseMap(['#######', '#P.#..#', '#..#..#', '#.....#', '#######']);
  for (const type of ['shadow', 'mimic']) {
    const enemy = createEnemy({ type, x: 6, z: 4.5, aimX: -1, aimZ: 0 }, map);
    const world = scene({ x: 3, z: 4.5 }, { lightOn: true, aim: { x: 1, z: 0 } });
    enemy.update(0.05, world);
    near(enemy.lastKnown.x, 3);
    near(enemy.lastKnown.z, 4.5);
    world.player.z = 1.5;
    world.lightOn = false;
    enemy.update(0.05, world);
    assert(enemy.phase === 'search');
    near(enemy.lastKnown.z, 4.5);
  }
});
