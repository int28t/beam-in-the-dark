import { test, assert } from './harness.js?v=0.13.0';
import {
  DEFAULT_SAVE,
  normalizeSave,
  mergeSaves,
  loadProgress,
  saveProgress,
} from '../storage.js?v=0.13.0';
import { canUseDebug, ADMIN_TG_ID } from '../debug.js?v=0.13.0';
test('DEV: точные локальные имена или числовой ID в Telegram, не URL/подстрока', () => {
  assert(ADMIN_TG_ID === 7479182915);
  assert(
    canUseDebug({ hostname: 'localhost' }) &&
      canUseDebug({ hostname: '127.0.0.1' }) &&
      canUseDebug({ hostname: '[::1]' }),
  );
  assert(!canUseDebug({ hostname: 'localhost.evil.test' }));
  assert(
    !canUseDebug({ hostname: 'game.test', app: { initDataUnsafe: { user: { id: ADMIN_TG_ID } } } }),
  );
  assert(
    canUseDebug({
      hostname: 'game.test',
      app: { initData: 'signed', initDataUnsafe: { user: { id: ADMIN_TG_ID } } },
    }),
  );
  assert(
    !canUseDebug({
      hostname: 'game.test',
      app: { initData: 'signed', initDataUnsafe: { user: { id: String(ADMIN_TG_ID) } } },
    }),
  );
});
test('Save: v1 мигрирует, defaults вложенные независимы, будущие поля v2 остаются', () => {
  const a = normalizeSave({ version: 1, best: 7, quality: 'low' }),
    b = normalizeSave({
      version: 2,
      skins: { unlocked: ['wine'], future: 'x' },
      extra: { chapter: 4 },
    });
  assert(a.version === 2 && a.best === 7 && a.quality === 'low');
  assert(a.skins.unlocked.includes('classic'));
  assert(b.extra.chapter === 4 && b.skins.future === 'x' && b.skins.unlocked.includes('wine'));
  a.skins.unlocked.push('bone');
  assert(!normalizeSave(null).skins.unlocked.includes('bone'));
  assert(DEFAULT_SAVE.best === 0);
});
test('Save: merge не снижает рекорд/открытия, новая эпоха сброса отменяет старые достижения', () => {
  const a = normalizeSave({
    version: 2,
    best: 9,
    updatedAt: 10,
    skins: { unlocked: ['wine'], selected: 'wine' },
  });
  const b = normalizeSave({
    version: 2,
    best: 3,
    updatedAt: 20,
    muted: true,
    skins: { unlocked: ['bone'], selected: 'bone' },
  });
  const merged = mergeSaves(a, b);
  assert(
    merged.best === 9 &&
      merged.muted &&
      merged.skins.unlocked.includes('wine') &&
      merged.skins.selected === 'bone',
  );
  const reset = normalizeSave({ version: 2, resetAt: 30, updatedAt: 30 });
  assert(mergeSaves(a, reset).best === 0 && !mergeSaves(a, reset).skins.unlocked.includes('wine'));
});
test('Save: неизвестную новую схему нельзя перезаписать старым клиентом', () => {
  let raw = '{"version":99,"best":999}';
  const storage = { getItem: () => raw, setItem: (key, value) => (raw = value) };
  assert(loadProgress(storage).best === 0);
  assert(!saveProgress(storage, { best: 1 }));
  assert(JSON.parse(raw).version === 99);
});

test('DEV: команды только в паузе, тренировочный забег, телепорт и полный новый старт', async () => {
  const { createGame } = await import('../game.js?v=0.13.0');
  const { createDebug } = await import('../debug.js?v=0.13.0');
  const game = createGame();
  let unlocked = 0,
    reset = 0;
  const debug = createDebug({
    game,
    allowed: () => true,
    onUnlock: () => unlocked++,
    onReset: () => reset++,
  });
  game.dispatch('start');
  assert(!debug.execute('key'));
  game.dispatch('pause');
  assert(debug.execute('invincible', true) && game.state.practice);
  assert(debug.execute('infiniteLight', true));
  assert(debug.execute('key') && game.state.hasKey);
  assert(!debug.execute('floor', 0));
  assert(debug.execute('floor', 7) && game.state.floor === 7 && game.state.phase === 'paused');
  debug.execute('skins');
  debug.execute('reset');
  assert(unlocked === 1 && reset === 1);
  game.dispatch('resume');
  game.resolveFrame({ caught: true });
  assert(game.state.phase === 'playing');
  game.drainBattery(100);
  game.drainLight(1000, true);
  assert(game.state.battery === 100);
  game.dispatch('pause');
  game.dispatch('newRun');
  assert(!game.state.practice && !game.state.cheats.invincible && !game.state.cheats.infiniteLight);
  const denied = createDebug({ game, allowed: () => false });
  game.dispatch('pause');
  assert(!denied.execute('key') && !game.state.hasKey);
});

test('DEV UI: сброс требует отдельного подтверждения, отзыв доступа закрывает панель', async () => {
  const { createDebugView } = await import('../debug-view.js?v=0.13.0');
  const element = () =>
    Object.assign(new EventTarget(), { hidden: true, checked: false, setAttribute() {} });
  const button = element(),
    panel = element(),
    confirm = element(),
    message = element(),
    floor = { value: '7' },
    checks = { invincible: element(), infiniteLight: element() };
  panel.querySelector = (selector) =>
    checks[selector.includes('infiniteLight') ? 'infiniteLight' : 'invincible'];
  const page = {
    querySelector: (selector) =>
      ({
        '#dev-open': button,
        '#dev-panel': panel,
        '#dev-reset-confirm': confirm,
        '#dev-message': message,
        '#dev-floor': floor,
      })[selector],
  };
  const calls = [],
    view = createDebugView(
      (action, value) => {
        calls.push([action, value]);
        return true;
      },
      { page },
    );
  const click = (action) => {
    const event = new Event('click');
    Object.defineProperty(event, 'target', {
      value: { closest: () => ({ dataset: { debug: action } }) },
    });
    panel.dispatchEvent(event);
  };
  const state = { phase: 'paused', cheats: { invincible: false, infiniteLight: false } };
  view.render(state, true);
  button.dispatchEvent(new Event('click'));
  assert(!panel.hidden);
  click('reset');
  assert(calls.length === 0);
  click('requestReset');
  assert(!confirm.hidden);
  click('reset');
  assert(calls[0][0] === 'reset' && confirm.hidden);
  view.render(state, false);
  assert(button.hidden && panel.hidden);
  click('skins');
  assert(calls.length === 1);
  view.dispose();
});

test('DEV: бессмертие работает в реальном шаге мира без ложного события поражения', async () => {
  const { createGame } = await import('../game.js?v=0.13.0');
  const { createWorld } = await import('../world.js?v=0.13.0');
  const { parseMap } = await import('../map.js?v=0.13.0');
  const map = parseMap(['#######', '#P.K.D#', '#.....#', '#######']);
  map.enemies = [{ type: 'shadow', x: 1.55, z: 1.5 }];
  const world = createWorld(map),
    game = createGame();
  game.dispatch('start');
  game.dispatch('pause');
  game.setDebug({ invincible: true });
  game.dispatch('resume');
  world.step(0.05, { moveX: 0, moveZ: 0, aimX: 1, aimZ: 0 }, game);
  assert(game.state.phase === 'playing' && !world.feedback.caught);
});
