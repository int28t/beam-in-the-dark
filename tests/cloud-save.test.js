import { test, assert } from './harness.js?v=0.13.0';
import { createSaveStore } from '../cloud-save.js?v=0.13.0';
const storage = () => {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};
function app(id, initial = '') {
  let raw = initial,
    writes = 0;
  return {
    initData: 'fixture',
    version: '8.0',
    initDataUnsafe: { user: { id } },
    CloudStorage: {
      getItem(key, cb) {
        cb(null, raw);
      },
      setItem(key, value, cb) {
        raw = value;
        writes++;
        cb(null, true);
      },
    },
    get raw() {
      return raw;
    },
    get writes() {
      return writes;
    },
  };
}
test('Облако: прочитанный рекорд и скины сливаются без потери, потом переносятся на другое устройство', async () => {
  const cloud = app(
    1,
    JSON.stringify({
      version: 2,
      best: 9,
      skins: { unlocked: ['wine'], selected: 'wine' },
      updatedAt: 10,
    }),
  );
  const a = createSaveStore({ storage: storage(), debounceMs: 10000 });
  a.update({ best: 4 });
  a.connect(cloud);
  await a.flush();
  assert(a.value.best === 9 && a.value.skins.unlocked.includes('wine'));
  a.update({ muted: true });
  await a.flush();
  const b = createSaveStore({ storage: storage(), debounceMs: 10000 });
  b.connect(cloud);
  await b.flush();
  assert(b.value.best === 9 && b.value.muted);
  a.dispose();
  b.dispose();
});
test('Облако: изменения во время первого чтения не теряются и defaults не записываются раньше чтения', async () => {
  let callback,
    writes = 0,
    raw;
  const cloud = app(2);
  cloud.CloudStorage.getItem = (key, cb) => {
    callback = cb;
  };
  cloud.CloudStorage.setItem = (key, value, cb) => {
    writes++;
    raw = value;
    cb(null, true);
  };
  const a = createSaveStore({ storage: storage(), debounceMs: 10000 });
  a.connect(cloud);
  const task = a.flush();
  a.update({ best: 7 });
  assert(writes === 0);
  callback(null, JSON.stringify({ version: 2, best: 10, skins: { unlocked: ['bone'] } }));
  await task;
  assert(JSON.parse(raw).best === 10 && a.value.best === 10);
  a.dispose();
});
test('Облако: ошибка/timeout оставляет локальный прогресс и не затирает сервер', async () => {
  const cloud = app(3);
  cloud.CloudStorage.getItem = () => {};
  const a = createSaveStore({ storage: storage(), timeoutMs: 5, debounceMs: 10000 });
  a.connect(cloud);
  a.update({ best: 6 });
  assert(!(await a.flush()));
  assert(a.value.best === 6 && cloud.writes === 0);
  a.dispose();
});
test('Облако: поздний ответ после смены аккаунта не переносит чужие данные', async () => {
  const local = storage(),
    one = app(1),
    two = app(2);
  let oldCallback;
  one.CloudStorage.getItem = (key, cb) => {
    oldCallback = cb;
  };
  const a = createSaveStore({ storage: local, debounceMs: 10000 });
  a.connect(one);
  const old = a.flush();
  a.connect(two);
  await a.flush();
  oldCallback(null, JSON.stringify({ version: 2, best: 999 }));
  await old;
  assert(a.value.best === 0);
  a.dispose();
});
test('Облако: локальные сохранения разных Telegram аккаунтов разделены', async () => {
  const a = createSaveStore({ storage: storage(), debounceMs: 10000 }),
    one = app(1),
    two = app(2);
  a.update({ best: 5 });
  a.connect(one);
  await a.flush();
  assert(a.value.best === 5);
  a.connect(two);
  await a.flush();
  assert(a.value.best === 0);
  a.connect(one);
  await a.flush();
  assert(a.value.best === 5);
  a.dispose();
});
test('Облако: сброс не воскресает от старого рекорда, новая схема сервера не перезаписывается', async () => {
  const cloud = app(1, JSON.stringify({ version: 2, best: 99 }));
  const a = createSaveStore({ storage: storage(), debounceMs: 10000 });
  a.connect(cloud);
  await a.flush();
  a.reset();
  await a.flush();
  assert(JSON.parse(cloud.raw).best === 0);
  a.dispose();
  const future = app(2, '{"version":99,"best":888}'),
    b = createSaveStore({ storage: storage(), debounceMs: 10000 });
  b.connect(future);
  b.update({ best: 1 });
  assert(!(await b.flush()));
  assert(future.writes === 0);
  b.dispose();
});

test('Облако: правки во время записи доходят следующей последовательной записью', async () => {
  const cloud = app(1);
  let release;
  const original = cloud.CloudStorage.setItem;
  let first = true;
  cloud.CloudStorage.setItem = (key, value, callback) => {
    if (first) {
      first = false;
      release = () => original(key, value, callback);
    } else original(key, value, callback);
  };
  const a = createSaveStore({ storage: storage(), debounceMs: 10000 });
  a.connect(cloud);
  a.update({ best: 3 });
  const task = a.flush();
  await Promise.resolve();
  assert(typeof release === 'function');
  a.update({ best: 12 });
  release();
  await task;
  await a.flush();
  assert(JSON.parse(cloud.raw).best === 12);
  a.dispose();
});
test('Облако: dispose игнорирует поздний callback и не пишет сервер', async () => {
  const cloud = app(1);
  let callback;
  cloud.CloudStorage.getItem = (key, cb) => (callback = cb);
  const a = createSaveStore({ storage: storage(), debounceMs: 10000 });
  a.connect(cloud);
  a.update({ best: 5 });
  const task = a.flush();
  a.dispose();
  callback(null, '{"version":2,"best":999}');
  await task;
  assert(a.value.best === 5 && cloud.writes === 0);
});
test('Облако: новая локальная схема не загружается поверх старой облачной', async () => {
  const local = storage();
  local.setItem('beam-in-the-dark:progress', '{"version":99,"best":999}');
  const cloud = app(1),
    a = createSaveStore({ storage: local, debounceMs: 10000 });
  a.connect(cloud);
  a.update({ best: 1 });
  assert(!(await a.flush()));
  assert(cloud.writes === 0);
  a.dispose();
});
test('Облако: неподдерживаемый SDK и отказ записи не мешают локальной игре', async () => {
  const cloud = app(1);
  cloud.version = '6.8';
  const a = createSaveStore({ storage: storage(), debounceMs: 10000 });
  assert(!a.connect(cloud));
  a.update({ best: 4 });
  assert(a.value.best === 4 && !(await a.flush()));
  a.dispose();
  const bad = app(2);
  bad.CloudStorage.setItem = (key, value, cb) => cb('failed');
  const b = createSaveStore({ storage: storage(), debounceMs: 10000 });
  b.connect(bad);
  b.update({ best: 8 });
  assert(!(await b.flush()) && b.value.best === 8 && b.status === 'offline');
  b.dispose();
});

test('Облако: future schema остаётся read-only после повторного открытия Telegram', async () => {
  const local = storage();
  local.setItem('beam-in-the-dark:progress', '{"version":99,"best":999}');
  const cloud = app(1);
  for (let i = 0; i < 2; i++) {
    const a = createSaveStore({ storage: local, debounceMs: 10000 });
    a.connect(cloud);
    assert(!(await a.flush()) && a.status === 'readonly');
    a.dispose();
  }
  assert(cloud.writes === 0);
});
test('Облако: запрос сброса во время чтения новее уже существующей облачной эпохи', async () => {
  const cloud = app(1);
  let callback;
  cloud.CloudStorage.getItem = (key, cb) => (callback = cb);
  const a = createSaveStore({ storage: storage(), now: () => 100, debounceMs: 10000 });
  a.connect(cloud);
  const task = a.flush();
  a.reset();
  callback(null, '{"version":2,"best":99,"resetAt":1000,"updatedAt":1001}');
  await task;
  assert(a.value.best === 0 && JSON.parse(cloud.raw).resetAt > 1000);
  a.dispose();
});

test('Облако: сброс обычного сайта не удаляет существующий прогресс Telegram при первом входе', async () => {
  const a = createSaveStore({ storage: storage(), debounceMs: 10000 });
  a.update({ best: 3 });
  a.reset();
  const cloud = app(1, '{"version":2,"best":9}');
  a.connect(cloud);
  await a.flush();
  assert(a.value.best === 9);
  a.dispose();
});

test('Облако: поздняя поддержка SDK не снимает защиту future-schema', async () => {
  const local = storage();
  local.setItem('beam-in-the-dark:progress', '{"version":99,"best":999}');
  const cloud = app(1);
  cloud.version = '6.8';
  const a = createSaveStore({ storage: local, debounceMs: 10000 });
  a.connect(cloud);
  cloud.version = '8.0';
  a.connect(cloud);
  assert(!(await a.flush()) && cloud.writes === 0);
  a.dispose();
});
