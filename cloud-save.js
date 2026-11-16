import {
  STORAGE_KEY,
  getStorage,
  readSave,
  loadProgress,
  saveProgress,
  normalizeSave,
  mergeFields,
  mergeSaves,
  isFutureSave,
} from './storage.js?v=0.13.0';
const CLOUD_KEY = 'beam_in_the_dark_save';
// Local-first adapter. Cloud requests are serialized and scoped to a connection generation.
export function createSaveStore({
  storage,
  now = Date.now,
  onChange = () => {},
  onStatus = () => {},
  timeoutMs = 4000,
  debounceMs = 300,
} = {}) {
  const target = getStorage(storage),
    value = loadProgress(target),
    pendingCalls = new Set();
  let key = STORAGE_KEY,
    account = null,
    cloud = null,
    generation = 0,
    revision = 0,
    timer = null,
    flight = null,
    disposed = false,
    readonly = isFutureSave(readSave(target));
  let status = readonly ? 'readonly' : 'local',
    localSaved = !!target,
    legacyOwner;
  try {
    legacyOwner = target?.getItem(`${STORAGE_KEY}:legacy-owner`) ?? null;
  } catch {}
  function notify(next) {
    status = next;
    onStatus({ status, localSaved });
  }
  function assign(next) {
    for (const field of Object.keys(value)) delete value[field];
    Object.assign(value, next);
    localSaved = !readonly && saveProgress(target, value, key);
    onChange(value);
  }
  function schedule() {
    if (disposed || !cloud || readonly) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void api.flush();
    }, debounceMs);
  }
  function request(apiTarget, method, ...args) {
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = (error, result) => {
        if (done) return;
        done = true;
        clearTimeout(timeout);
        pendingCalls.delete(finish);
        if (error) reject(new Error(String(error)));
        else resolve(result);
      };
      const timeout = setTimeout(() => finish('Cloud timeout'), timeoutMs);
      pendingCalls.add(finish);
      try {
        apiTarget[method](...args, finish);
      } catch (error) {
        finish(error);
      }
    });
  }
  const api = {
    value,
    get info() {
      return { status, localSaved };
    },
    get status() {
      return status;
    },
    update(patch) {
      if (disposed || readonly) return false;
      const next = normalizeSave(mergeFields(value, patch));
      next.updatedAt = Math.max(now(), value.updatedAt + 1, value.resetAt);
      revision++;
      assign(next);
      notify(readonly ? 'readonly' : cloud ? 'syncing' : 'local');
      schedule();
      return localSaved;
    },
    reset() {
      if (disposed || readonly) return false;
      const epoch = Math.max(now(), value.updatedAt + 1, value.resetAt + 1);
      revision++;
      assign(normalizeSave({ version: 2, updatedAt: epoch, resetAt: epoch, resetPending: true }));
      notify(readonly ? 'readonly' : cloud ? 'syncing' : 'local');
      schedule();
    },
    connect(app) {
      if (disposed) return false;
      const id = app?.initDataUnsafe?.user?.id;
      if (!app?.initData || !Number.isSafeInteger(id) || id <= 0) return false;
      let supported = false;
      try {
        const [major, minor] = String(app.version ?? '0')
          .split('.')
          .map(Number);
        supported =
          typeof app.isVersionAtLeast === 'function'
            ? app.isVersionAtLeast('6.9')
            : major > 6 || (major === 6 && minor >= 9);
      } catch {}
      const candidate =
        supported &&
        typeof app.CloudStorage?.getItem === 'function' &&
        typeof app.CloudStorage?.setItem === 'function'
          ? app.CloudStorage
          : null;
      if (id === account && candidate === cloud) return !!cloud;
      const changed = id !== account;
      generation++;
      clearTimeout(timer);
      timer = null;
      flight = null;
      readonly = !changed && readonly;
      account = id;
      cloud = candidate;
      key = `${STORAGE_KEY}:tg:${id}`;
      readonly = readonly || isFutureSave(readSave(target, key));
      if (changed) {
        const saved = readSave(target, key);
        const legacy = legacyOwner === null || legacyOwner === String(id);
        const initial = saved ?? (legacy ? readSave(target, STORAGE_KEY) : null);
        if (legacyOwner === null) {
          legacyOwner = String(id);
          try {
            target?.setItem(`${STORAGE_KEY}:legacy-owner`, legacyOwner);
          } catch {}
        }
        readonly = isFutureSave(initial);
        const migrated = normalizeSave(initial);
        // Anonymous resets must never delete progress belonging to a Telegram account.
        if (saved === null) {
          migrated.resetAt = 0;
          migrated.resetPending = false;
        }
        assign(migrated);
      }
      notify(readonly ? 'readonly' : cloud ? 'syncing' : 'local');
      if (cloud) schedule();
      return !!cloud;
    },
    flush() {
      clearTimeout(timer);
      timer = null;
      if (disposed || !cloud || readonly) return Promise.resolve(false);
      if (flight) return flight;
      const token = generation,
        apiTarget = cloud;
      const active = () => !disposed && token === generation;
      const task = (async () => {
        try {
          const raw = await request(apiTarget, 'getItem', CLOUD_KEY);
          if (!active()) return false;
          let remote = null;
          if (raw) {
            if (typeof raw !== 'string' || raw.length > 4096) throw new Error('Invalid cloud save');
            remote = JSON.parse(raw);
            if (isFutureSave(remote)) {
              readonly = true;
              notify('readonly');
              return false;
            }

            if (!remote || ![1, 2].includes(remote.version))
              throw new Error('Invalid cloud schema');
            remote = normalizeSave(remote);
            remote.resetPending = false;
          }
          if (value.resetPending) {
            const epoch = Math.max(
              now(),
              value.resetAt,
              (remote?.resetAt ?? 0) + 1,
              (remote?.updatedAt ?? 0) + 1,
            );
            assign(
              normalizeSave({
                ...value,
                resetAt: epoch,
                updatedAt: Math.max(value.updatedAt, epoch),
              }),
            );
          }
          assign(mergeSaves(value, remote));
          const payload = JSON.stringify({ ...value, resetPending: false }),
            snapshot = revision,
            sentReset = value.resetAt;
          if (payload.length > 4096) throw new Error('Cloud save too large');
          if (payload !== raw) {
            const stored = await request(apiTarget, 'setItem', CLOUD_KEY, payload);
            if (!stored) throw new Error('Cloud write rejected');
          }
          if (!active()) return false;
          if (value.resetAt === sentReset && value.resetPending)
            assign(normalizeSave({ ...value, resetPending: false }));
          notify(snapshot === revision ? 'synced' : 'syncing');
          if (snapshot !== revision) schedule();
          return true;
        } catch {
          if (active()) notify('offline');
          return false;
        } finally {
          if (flight === task) flight = null;
        }
      })();
      flight = task;
      return task;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      generation++;
      clearTimeout(timer);
      for (const finish of [...pendingCalls]) finish('Disposed');
    },
  };
  return api;
}
