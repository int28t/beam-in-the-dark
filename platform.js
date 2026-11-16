const positive = (value) => (Number.isFinite(value) && value > 0 ? value : 0);

export function createPlatform({
  host = globalThis.window,
  onLayout = () => {},
  onInactive = () => {},
} = {}) {
  let app = null,
    initialized = false,
    disposed = false,
    playing = false,
    swipesChanged = false,
    originalSwipes = true;
  let lastHaptic = -Infinity,
    fullscreenError = '';
  const listeners = [],
    sdkListeners = [];
  function supports(version) {
    if (!app) return false;
    try {
      if (typeof app.isVersionAtLeast === 'function') return app.isVersionAtLeast(version);
      const current = String(app.version ?? '0')
          .split('.')
          .map(Number),
        required = version.split('.').map(Number);
      for (let i = 0; i < Math.max(current.length, required.length); i++) {
        const a = current[i] ?? 0,
          b = required[i] ?? 0;
        if (!Number.isFinite(a)) return false;
        if (a !== b) return a > b;
      }
      return true;
    } catch {
      return false;
    }
  }
  function call(target, name, ...args) {
    try {
      if (typeof target?.[name] !== 'function') return false;
      target[name](...args);
      return true;
    } catch {
      return false;
    }
  }
  function listen(target, name, handler) {
    if (typeof target?.addEventListener !== 'function') return;
    target.addEventListener(name, handler);
    listeners.push([target, name, handler]);
  }
  function sdkListen(name, handler, minVersion = '6.0') {
    if (!supports(minVersion)) return;
    if (call(app, 'onEvent', name, handler)) sdkListeners.push([name, handler]);
  }
  function emitLayout() {
    if (disposed) return;
    const heights = [
      positive(host?.innerHeight),
      positive(host?.visualViewport?.height),
      positive(app?.viewportStableHeight),
    ].filter(Boolean);
    const style = host?.document?.documentElement?.style;
    style?.setProperty('--app-height', `${heights.length ? Math.min(...heights) : 1}px`);
    for (const side of ['top', 'right', 'bottom', 'left']) {
      const inset =
        positive(app?.safeAreaInset?.[side]) + positive(app?.contentSafeAreaInset?.[side]);
      style?.setProperty(`--app-safe-${side}`, `${inset}px`);
    }
    onLayout({
      isTelegram: Boolean(app),
      fullscreenAvailable: platform.fullscreenAvailable,
      isFullscreen: Boolean(app?.isFullscreen),
      fullscreenError,
    });
  }
  function updateSwipes() {
    if (!supports('7.7')) return;
    if (playing && originalSwipes && !swipesChanged) {
      swipesChanged = call(app, 'disableVerticalSwipes');
    } else if (!playing && swipesChanged) {
      call(app, 'enableVerticalSwipes');
      swipesChanged = false;
    }
  }
  function connect() {
    if (disposed || app) return;
    const candidate = host?.Telegram?.WebApp;
    if (
      !candidate ||
      !(candidate.initData || (candidate.platform && candidate.platform !== 'unknown'))
    )
      return;
    app = candidate;
    originalSwipes = app.isVerticalSwipesEnabled !== false;
    call(app, 'ready');
    call(app, 'expand');
    if (supports('6.1')) {
      call(app, 'setHeaderColor', '#10171a');
      call(app, 'setBackgroundColor', '#10171a');
    }
    sdkListen('viewportChanged', emitLayout);
    for (const event of [
      'safeAreaChanged',
      'contentSafeAreaChanged',
      'fullscreenChanged',
      'activated',
    ])
      sdkListen(event, emitLayout, '8.0');
    sdkListen(
      'deactivated',
      () => {
        onInactive();
      },
      '8.0',
    );
    sdkListen(
      'fullscreenFailed',
      () => {
        fullscreenError = 'Полный экран недоступен. Игра продолжит работать в обычном окне.';
        emitLayout();
      },
      '8.0',
    );
    updateSwipes();
    if (app.isActive === false) onInactive();
  }
  const platform = {
    get isTelegram() {
      return Boolean(app);
    },
    get fullscreenAvailable() {
      return !disposed && supports('8.0') && typeof app?.requestFullscreen === 'function';
    },
    get fullscreenError() {
      return fullscreenError;
    },
    ready() {
      if (initialized || disposed) return;
      initialized = true;
      listen(host, 'resize', emitLayout);
      listen(host?.visualViewport, 'resize', emitLayout);
      listen(host?.document?.querySelector?.('#telegram-sdk'), 'load', () => {
        connect();
        emitLayout();
      });
      connect();
      emitLayout();
    },
    expand() {
      if (!disposed) call(app, 'expand');
    },
    setPlaying(value) {
      if (disposed) return;
      playing = Boolean(value);
      updateSwipes();
    },
    toggleFullscreen() {
      if (!platform.fullscreenAvailable) return false;
      fullscreenError = '';
      const accepted = call(app, app.isFullscreen ? 'exitFullscreen' : 'requestFullscreen');
      if (!accepted) fullscreenError = 'Не удалось включить полный экран. Можно играть без него.';
      emitLayout();
      return accepted;
    },
    haptic(event) {
      if (disposed || !supports('6.1')) return false;
      const now = host?.performance?.now?.() ?? Date.now();
      if (now - lastHaptic < 700) return false;
      let sent = false;
      if (event === 'key' || event === 'complete')
        sent = call(app.HapticFeedback, 'notificationOccurred', 'success');
      else if (event === 'caught') sent = call(app.HapticFeedback, 'notificationOccurred', 'error');
      else if (event === 'danger') sent = call(app.HapticFeedback, 'impactOccurred', 'medium');
      if (sent) lastHaptic = now;
      return sent;
    },
    dispose() {
      if (disposed) return;
      playing = false;
      updateSwipes();
      disposed = true;
      for (const [target, name, handler] of listeners) target.removeEventListener(name, handler);
      for (const [name, handler] of sdkListeners) call(app, 'offEvent', name, handler);
      listeners.length = 0;
      sdkListeners.length = 0;
    },
  };
  return platform;
}
