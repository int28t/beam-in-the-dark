import { createFrameMeter } from '../frame-meter.js';
import { test, assert, near } from './harness.js';
import { createInputState, createInput, bindActionButton } from '../input.js';
import { createPlatform } from '../platform.js';
import { getQualityProfile, applyQuality } from '../quality.js';
import { loadProgress, saveProgress } from '../storage.js';

function hostFixture(app) {
  const host = new EventTarget(),
    viewport = new EventTarget(),
    values = new Map();
  host.innerHeight = 800;
  viewport.height = 740;
  host.visualViewport = viewport;
  host.document = {
    documentElement: { style: { setProperty: (key, value) => values.set(key, value) } },
    querySelector: () => null,
  };
  if (app) host.Telegram = { WebApp: app };
  return { host, values, viewport };
}
function telegramFixture(version = '8.0') {
  const handlers = new Map(),
    calls = [];
  const app = {
    initData: 'fixture',
    platform: 'android',
    version,
    isFullscreen: false,
    isVerticalSwipesEnabled: true,
    viewportStableHeight: 700,
    safeAreaInset: { top: 24, bottom: 16 },
    contentSafeAreaInset: { top: 40, bottom: 0 },
    ready() {
      calls.push('ready');
    },
    expand() {
      calls.push('expand');
    },
    disableVerticalSwipes() {
      calls.push('disableSwipes');
    },
    enableVerticalSwipes() {
      calls.push('enableSwipes');
    },
    requestFullscreen() {
      calls.push('fullscreen');
    },
    exitFullscreen() {
      calls.push('exitFullscreen');
    },
    onEvent(name, fn) {
      handlers.set(name, fn);
    },
    offEvent(name, fn) {
      if (handlers.get(name) === fn) handlers.delete(name);
    },
    HapticFeedback: {
      notificationOccurred: (type) => calls.push(`haptic:${type}`),
      impactOccurred: (type) => calls.push(`impact:${type}`),
    },
  };
  return { app, handlers, calls };
}
test('Мобильный ввод: правый стик удерживает свет при отходе назад', () => {
  const input = createInputState();
  input.setEnabled(true);
  input.setAimMode('dual');
  input.setAimStick(1, 0);
  input.setStick(0, 1);
  const state = input.sample();
  near(state.aimX, 1);
  near(state.aimZ, 0);
  near(state.moveZ, 1);
  input.setAimStick(0, 0);
  input.sample();
  near(state.aimX, 1);
  input.setEnabled(false);
  input.setEnabled(true);
  input.sample();
  near(state.moveZ, 0);
  near(state.aimX, 1);
});
test('Мобильный ввод: режим по движению сохраняется и смена режима очищает движение', () => {
  const input = createInputState();
  input.setEnabled(true);
  input.setAimMode('dual');
  input.setAimStick(1, 0);
  input.setStick(0, 1);
  input.setAimMode('movement');
  const state = input.sample();
  near(state.moveZ, 0);
  input.setStick(0, -1);
  input.sample();
  near(state.aimZ, -1);
  input.setAimStick(1, 0);
  input.sample();
  near(state.aimZ, -1);
  input.reset({ aim: true });
  input.sample();
  near(state.aimX, 0);
  near(state.moveZ, 0);
});
test('Платформа: обычный браузер без SDK обновляет viewport и безопасно отключается', () => {
  const { host, values, viewport } = hostFixture();
  let layouts = 0;
  const platform = createPlatform({ host, onLayout: () => layouts++ });
  platform.ready();
  assert(!platform.isTelegram && !platform.fullscreenAvailable && !platform.toggleFullscreen());
  assert(values.get('--app-height') === '740px');
  viewport.height = 600;
  viewport.dispatchEvent(new Event('resize'));
  assert(values.get('--app-height') === '600px' && layouts === 2);
  platform.haptic('key');
  platform.dispose();
  viewport.dispatchEvent(new Event('resize'));
  assert(layouts === 2);
});
test('Telegram: ready/expand, safe area, deactivation и удаление подписок', () => {
  const { app, handlers, calls } = telegramFixture();
  const { host, values } = hostFixture(app);
  let paused = 0;
  const platform = createPlatform({ host, onInactive: () => paused++ });
  platform.ready();
  platform.ready();
  assert(calls.filter((x) => x === 'ready').length === 1 && calls.includes('expand'));
  assert(values.get('--app-safe-top') === '64px' && values.get('--app-height') === '700px');
  handlers.get('deactivated')();
  assert(paused === 1);
  platform.setPlaying(true);
  platform.setPlaying(false);
  assert(calls.includes('disableSwipes') && calls.includes('enableSwipes'));
  assert(platform.toggleFullscreen() && calls.includes('fullscreen'));
  platform.haptic('key');
  platform.haptic('danger');
  assert(calls.filter((x) => x.startsWith('haptic:') || x.startsWith('impact:')).length === 1);
  platform.dispose();
  assert(handlers.size === 0);
  assert(!platform.toggleFullscreen());
});
test('Telegram: старый SDK и бросающие методы не блокируют игру', () => {
  const { app, calls } = telegramFixture('6.0');
  app.ready = () => {
    throw new Error('unsupported');
  };
  const { host } = hostFixture(app);
  const platform = createPlatform({ host });
  platform.ready();
  platform.setPlaying(true);
  platform.haptic('key');
  assert(!platform.fullscreenAvailable && !platform.toggleFullscreen());
  assert(!calls.includes('disableSwipes') && !calls.some((x) => x.startsWith('haptic:')));
  platform.dispose();
});
test('Telegram: SDK, загрузившийся после игры, подключается по load и fullscreenFailed остаётся безопасным', () => {
  const { host } = hostFixture();
  const script = new EventTarget();
  host.document.querySelector = () => script;
  const { app, handlers, calls } = telegramFixture();
  const platform = createPlatform({ host });
  platform.ready();
  host.Telegram = { WebApp: app };
  script.dispatchEvent(new Event('load'));
  assert(platform.isTelegram && calls.includes('ready'));
  handlers.get('fullscreenFailed')({ error: 'UNSUPPORTED' });
  assert(platform.fullscreenError);
  platform.dispose();
});
test('Качество: авто на телефоне экономное, смена разрешения теней освобождает старую карту', () => {
  assert(
    getQualityProfile('auto', true).name === 'low' &&
      getQualityProfile('auto', false).name === 'normal',
  );
  let disposed = 0,
    pixelRatio = 0,
    decor = true;
  const renderer = {
    setPixelRatio: (value) => (pixelRatio = value),
    shadowMap: { enabled: false },
  };
  const light = {
    shadow: {
      mapSize: {
        x: 1024,
        y: 1024,
        set(x, y) {
          this.x = x;
          this.y = y;
        },
      },
      map: { dispose: () => disposed++ },
    },
  };
  const view = { setQuality: (value) => (decor = value) };
  applyQuality({ renderer, light, mapView: view, mode: 'low', touch: true, devicePixelRatio: 3 });
  assert(
    pixelRatio === 1 &&
      light.shadow.mapSize.x === 512 &&
      light.shadow.map === null &&
      disposed === 1 &&
      !decor,
  );
  applyQuality({
    renderer,
    light,
    mapView: view,
    mode: 'normal',
    touch: true,
    devicePixelRatio: 3,
  });
  assert(pixelRatio === 1.5 && light.shadow.mapSize.x === 1024 && decor);
});
test('Сохранение: мобильные настройки совместимы со старым форматом', () => {
  const old = loadProgress({ getItem: () => '{"version":1,"best":5,"muted":true}' });
  assert(old.best === 5 && old.quality === 'auto' && old.touchAim === 'movement');
  let json;
  const storage = { setItem: (_key, value) => (json = value), getItem: () => json };
  saveProgress(storage, { ...old, quality: 'low', touchAim: 'dual' });
  const loaded = loadProgress(storage);
  assert(loaded.quality === 'low' && loaded.touchAim === 'dual');
  assert(
    loadProgress({ getItem: () => '{"version":1,"quality":"ultra","touchAim":"bad"}' }).quality ===
      'auto',
  );
});

test('Адаптер касаний: два стика работают вместе, отпускание и cancel не оставляют движение', () => {
  const host = new EventTarget(),
    page = new EventTarget(),
    scene = new EventTarget(),
    move = new EventTarget(),
    aim = new EventTarget();
  page.defaultView = host;
  scene.ownerDocument = page;
  const collections = [];
  const nipplejs = {
    create() {
      const handlers = new Map();
      const manager = {
        on: (name, fn) => handlers.set(name, fn),
        reposition() {},
        destroy() {
          handlers.clear();
        },
        handlers,
      };
      collections.push(manager);
      return manager;
    },
  };
  const input = createInput(scene, {
    joystickZone: move,
    aimZone: aim,
    nipplejs,
    touch: true,
    aimMode: 'dual',
    onPause() {},
  });
  input.setEnabled(true);
  collections[1].handlers.get('move')({ data: { vector: { x: 1, y: 0 } } });
  collections[0].handlers.get('move')({ data: { vector: { x: 0, y: -1 } } });
  let state = input.sample();
  near(state.moveZ, 1);
  near(state.aimX, 1);
  collections[1].handlers.get('end')();
  state = input.sample();
  near(state.moveZ, 1);
  near(state.aimX, 1);
  move.dispatchEvent(new Event('pointercancel'));
  state = input.sample();
  near(state.moveZ, 0);
  collections[0].handlers.get('move')({ data: { vector: { x: 0, y: -1 } } });
  input.dispose();
  state = input.sample();
  near(state.moveZ, 0);
  assert(collections.every((manager) => manager.handlers.size === 0));
});

test('FPS: измеряется реальный интервал кадров, время паузы не входит в замер', () => {
  const meter = createFrameMeter();
  assert(meter.sample(0) === null);
  let fps = null;
  for (let i = 1; i <= 30; i++) fps = meter.sample((i * 1000) / 30);
  assert(fps === 30);
  meter.reset();
  assert(meter.sample(100000) === null);
  assert(meter.sample(100100) === null);
});

test('Кнопка фонаря: касание срабатывает сразу, совместимый click не переключает дважды', () => {
  const button = new EventTarget();
  button.disabled = false;
  const abort = new AbortController();
  let presses = 0;
  bindActionButton(button, () => presses++, { signal: abort.signal });
  function fire(type, time, detail = 0, pointerType = 'touch') {
    const event = new Event(type, { cancelable: true });
    Object.defineProperties(event, {
      timeStamp: { value: time },
      detail: { value: detail },
      pointerType: { value: pointerType },
    });
    button.dispatchEvent(event);
  }
  fire('pointerdown', 1000);
  assert(presses === 1);
  fire('click', 1050, 1);
  assert(presses === 1);
  fire('click', 1100, 0, '');
  assert(presses === 2);
  fire('pointerdown', 2000);
  assert(presses === 3);
  fire('pointerup', 5000);
  fire('click', 5050, 1);
  assert(presses === 3);
  button.disabled = true;
  fire('pointerdown', 5200);
  assert(presses === 3);
  abort.abort();
  button.disabled = false;
  fire('click', 7000, 1, 'mouse');
  assert(presses === 3);
});
