import { parseMap } from '../map.js';
import { moveCircle } from '../collision.js';
import { normalizeMovement } from '../input.js';
import { createGame } from '../game.js';
import { FLOOR_TEMPLATE } from '../map.js';

const tests = [];
export function test(name, run) { tests.push({ name, run }); }
export function assert(value, message = 'Условие не выполнено') { if (!value) throw new Error(message); }
export function near(actual, expected, epsilon = 1e-6) {
  assert(Math.abs(actual - expected) < epsilon, `${actual} ≠ ${expected}`);
}
function throws(run) {
  let thrown = false;
  try { run(); } catch { thrown = true; }
  assert(thrown, 'Ожидалась ошибка входных данных');
}

test('Парсер: координаты, непроходимые стены и точки появления', () => {
  const map = parseMap(['#####', '#P.K#', '#..D#', '#####']);
  assert(map.width === 5 && map.height === 4);
  assert(map.walls.length === 14);
  near(map.spawns.player.x, 1.5); near(map.spawns.player.z, 1.5);
  near(map.spawns.key.x, 4.5); near(map.spawns.exit.z, 3);
  assert(map.walkable[1 * 5 + 1] === 1 && map.walkable[0] === 0);
});
test('Парсер отклоняет рваную карту, открытые границы и неизвестные символы', () => {
  throws(() => parseMap(['###', '#P#', '##']));
  throws(() => parseMap(['###', '.P#', '###']));
  throws(() => parseMap(['#####', '#P?K#', '#..D#', '#####']));
});
test('Парсер требует ровно один старт и не принимает повторные предметы', () => {
  throws(() => parseMap(['####', '#..#', '####']));
  throws(() => parseMap(['#####', '#PP.#', '#####']));
  throws(() => parseMap(['######', '#PKK.#', '######']));
});
test('Нормализация: диагональ не быстрее прямого движения, аналоговая сила сохраняется', () => {
  const out = { x: 0, z: 0 };
  normalizeMovement(1, 1, out); near(Math.hypot(out.x, out.z), 1);
  normalizeMovement(0.3, 0.4, out); near(out.x, 0.3); near(out.z, 0.4);
  normalizeMovement(0, 0, out); near(out.x, 0); near(out.z, 0);
});
const wall = { minX: 1, maxX: 2, minZ: -1, maxZ: 1 };
test('Столкновение: прямое движение останавливается перед стеной', () => {
  const result = moveCircle({ x: 0, z: 0 }, { x: 1.8, z: 0 }, 0.25, [wall]);
  near(result.x, 0.75); near(result.z, 0);
});
test('Столкновение: скольжение сохраняет движение вдоль стены', () => {
  const result = moveCircle({ x: 0.75, z: -0.5 }, { x: 0.5, z: 0.6 }, 0.25, [wall]);
  near(result.x, 0.75); near(result.z, 0.1);
});
test('Столкновение: большое смещение не проходит сквозь стену', () => {
  const result = moveCircle({ x: -2, z: 0 }, { x: 10, z: 0 }, 0.25, [wall]);
  near(result.x, 0.75);
});
test('Столкновение: проход шире диаметра остаётся проходимым', () => {
  const walls = [{ minX: -2, maxX: -0.4, minZ: -1, maxZ: 1 }, { minX: 0.4, maxX: 2, minZ: -1, maxZ: 1 }];
  const result = moveCircle({ x: 0, z: 2 }, { x: 0, z: -4 }, 0.25, walls);
  near(result.x, 0); near(result.z, -2);
});
test('Столкновение: круг огибает внешний угол без квадратного зацепа', () => {
  const result = moveCircle({ x: 0.6, z: 1.2 }, { x: 0.23, z: 0 }, 0.25, [wall]);
  near(result.x, 0.83);
});
test('Столкновение: внутренний угол блокирует обе оси', () => {
  const walls = [wall, { minX: -1, maxX: 2, minZ: 1, maxZ: 2 }];
  const result = moveCircle({ x: 0, z: 0 }, { x: 2, z: 2 }, 0.25, walls);
  near(result.x, 0.75); near(result.z, 0.75);
});
test('Движение за секунду одинаково при 30 и 144 шагах', () => {
  function simulate(fps) {
    const position = { x: 0, z: 0 };
    for (let i = 0; i < fps; i++) moveCircle(position, { x: 2.65 / fps, z: 0 }, 0.25, []);
    return position.x;
  }
  near(simulate(30), 2.65); near(simulate(144), 2.65);
});

test('Готовая карта: все клетки, ключ и выход достижимы от старта', () => {
  const map = parseMap(FLOOR_TEMPLATE);
  const start = Math.round(map.spawns.player.z / 1.5) * map.width + Math.round(map.spawns.player.x / 1.5);
  const visited = new Set([start]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    for (const offset of [-1, 1, -map.width, map.width]) {
      const next = queue[i] + offset;
      if (map.walkable[next] && !visited.has(next)) { visited.add(next); queue.push(next); }
    }
  }
  assert(visited.size === map.walkable.reduce((a, b) => a + b, 0));
  for (const name of ['key', 'exit']) {
    const point = map.spawns[name];
    assert(visited.has(Math.round(point.z / 1.5) * map.width + Math.round(point.x / 1.5)));
  }
});
test('Состояния: запертая дверь не завершает этаж, ключ открывает выход', () => {
  const game = createGame();
  assert(game.state.phase === 'menu');
  game.dispatch('start');
  game.resolveFrame({ exit: true });
  assert(game.state.phase === 'playing' && !game.state.hasKey);
  game.resolveFrame({ key: true });
  assert(game.state.hasKey && game.state.phase === 'playing');
  game.resolveFrame({ exit: true });
  assert(game.state.phase === 'floorComplete');
});
test('Состояния: повторный подбор и события после завершения не меняют результат', () => {
  const game = createGame(); game.dispatch('start');
  game.resolveFrame({ key: true }); game.resolveFrame({ key: true });
  game.resolveFrame({ exit: true });
  game.resolveFrame({ caught: true });
  assert(game.state.phase === 'floorComplete' && game.state.floor === 1);
});
test('Состояния: поражение имеет приоритет над ключом и выходом в одном кадре', () => {
  const game = createGame(); game.dispatch('start');
  game.resolveFrame({ caught: true, key: true, exit: true });
  assert(game.state.phase === 'gameOver' && !game.state.hasKey);
});
test('Состояния: пауза блокирует взаимодействия, недопустимые действия игнорируются', () => {
  const game = createGame(); game.dispatch('start'); game.dispatch('pause');
  game.resolveFrame({ key: true, exit: true, caught: true });
  game.dispatch('next'); game.dispatch('start');
  assert(game.state.phase === 'paused' && !game.state.hasKey && game.state.floor === 1);
  game.dispatch('resume'); assert(game.state.phase === 'playing');
});
test('Состояния: следующий этаж сбрасывает ключ, повтор сохраняет номер и сбрасывает состояние', () => {
  const game = createGame(); game.dispatch('start');
  game.resolveFrame({ key: true, exit: true }); game.dispatch('next');
  assert(game.state.floor === 2 && !game.state.hasKey && game.state.phase === 'playing');
  const revision = game.state.revision;
  game.resolveFrame({ key: true }); game.dispatch('pause'); game.dispatch('restart');
  assert(game.state.floor === 2 && !game.state.hasKey && game.state.revision === revision + 1);
});
test('Состояния: 20 переходов и 20 повторов не дублируют результат', () => {
  const game = createGame(); game.dispatch('start');
  for (let i = 0; i < 20; i++) {
    game.resolveFrame({ key: true, exit: true }); game.dispatch('next'); game.dispatch('next');
  }
  assert(game.state.floor === 21);
  for (let i = 0; i < 20; i++) {
    game.resolveFrame({ caught: true }); game.dispatch('restart');
    assert(game.state.phase === 'playing' && !game.state.hasKey && game.state.floor === 21);
  }
  game.dispatch('pause'); game.dispatch('newRun');
  assert(game.state.floor === 1 && !game.state.hasKey && game.state.phase === 'playing');
});

export function runTests() {
  const lines = [];
  let failed = 0;
  for (const { name, run } of tests) {
    try { run(); lines.push(`PASS ${name}`); }
    catch (error) { failed++; lines.push(`FAIL ${name}: ${error.message}`); }
  }
  const summary = `${tests.length - failed}/${tests.length} passed`;
  const output = [...lines, '', summary].join('\n');
  if (typeof document !== 'undefined') {
    document.querySelector('#results').textContent = output;
    document.title = `${failed ? 'FAIL' : 'PASS'} — Beam in the Dark tests`;
  }
  console.log(output);
  if (failed) throw new Error(summary);
  return { passed: tests.length, failed };
}
runTests();
