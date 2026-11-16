const MOVEMENT_CODES = new Set([
  'ShiftLeft',
  'ShiftRight',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowLeft',
  'ArrowDown',
  'ArrowRight',
]);

export function normalizeMovement(x, z, out) {
  const scale = Math.max(1, Math.hypot(x, z));
  out.x = x / scale;
  out.z = z / scale;
  return out;
}

// Input state has no DOM or joystick dependency. Adapters only deliver intent.
export function createInputState() {
  const keys = new Set();
  const vector = { x: 0, z: 0 };
  const state = {
    moveX: 0,
    moveZ: 0,
    aimX: 0,
    aimZ: -1,
    pointerX: 0,
    pointerY: 0,
    mouseAim: false,
    sneaking: false,
  };
  let touchSneak = false;
  let stickX = 0;
  let stickZ = 0;
  let enabled = false;
  let aimMode = 'movement',
    manualAim = false;
  function reset({ aim = false } = {}) {
    keys.clear();
    touchSneak = false;
    state.sneaking = false;
    stickX = 0;
    stickZ = 0;
    state.moveX = 0;
    state.moveZ = 0;
    if (aim) {
      manualAim = false;
      state.aimX = 0;
      state.aimZ = -1;
      state.mouseAim = false;
    }
  }
  return {
    get enabled() {
      return enabled;
    },
    toggleSneak() {
      if (enabled) touchSneak = !touchSneak;
    },
    keyDown(code) {
      if (enabled && MOVEMENT_CODES.has(code)) keys.add(code);
    },
    keyUp(code) {
      keys.delete(code);
    },
    pointAt(x, y) {
      if (!enabled) return;
      state.pointerX = x;
      state.pointerY = y;
      state.mouseAim = true;
    },
    setStick(x, z) {
      if (!enabled) return;
      stickX = x;
      stickZ = z;
      if (x || z) state.mouseAim = false;
    },
    setAimMode(mode) {
      aimMode = mode === 'dual' ? 'dual' : 'movement';
      manualAim = false;
      reset();
    },
    setAimStick(x, z) {
      if (!enabled || aimMode !== 'dual') return;
      const length = Math.hypot(x, z);
      if (length < 0.12) return;
      state.aimX = x / length;
      state.aimZ = z / length;
      state.mouseAim = false;
      manualAim = true;
    },
    sample() {
      const x =
        Number(keys.has('KeyD') || keys.has('ArrowRight')) -
        Number(keys.has('KeyA') || keys.has('ArrowLeft')) +
        stickX;
      const z =
        Number(keys.has('KeyS') || keys.has('ArrowDown')) -
        Number(keys.has('KeyW') || keys.has('ArrowUp')) +
        stickZ;
      normalizeMovement(enabled ? x : 0, enabled ? z : 0, vector);
      state.sneaking = enabled && (touchSneak || keys.has('ShiftLeft') || keys.has('ShiftRight'));
      state.moveX = vector.x;
      state.moveZ = vector.z;
      const length = Math.hypot(vector.x, vector.z);
      if (!state.mouseAim && (!manualAim || aimMode === 'movement') && length > 0.06) {
        state.aimX = vector.x / length;
        state.aimZ = vector.z / length;
      }
      return state;
    },
    reset,
    setEnabled(value) {
      enabled = value;
      reset();
    },
  };
}

export function createInput(
  element,
  {
    joystickZone,
    aimZone,
    nipplejs,
    touch = true,
    aimMode = 'movement',
    onPause,
    onToggle = () => {},
    onMute = () => {},
  },
) {
  const page = element.ownerDocument ?? globalThis.document;
  const host = page.defaultView ?? globalThis.window;
  const controller = new AbortController();
  const { signal } = controller;
  const model = createInputState();
  model.setAimMode(aimMode);
  host.addEventListener(
    'keydown',
    (event) => {
      if (
        event.code === 'KeyM' &&
        !event.repeat &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        onMute();
      }
      if (
        model.enabled &&
        event.code === 'KeyF' &&
        !event.repeat &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        onToggle();
      }
      if (event.code === 'Escape' && !event.repeat) onPause();
      if (
        !model.enabled ||
        !MOVEMENT_CODES.has(event.code) ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      event.preventDefault();
      model.keyDown(event.code);
    },
    { signal },
  );
  host.addEventListener(
    'keyup',
    (event) => {
      model.keyUp(event.code);
    },
    { signal },
  );
  host.addEventListener('blur', model.reset, { signal });
  page.addEventListener('visibilitychange', model.reset, { signal });
  element.addEventListener(
    'pointermove',
    (event) => {
      if (!model.enabled || event.pointerType !== 'mouse') return;
      const rect = element.getBoundingClientRect();
      model.pointAt(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
    },
    { signal },
  );
  element.addEventListener('pointercancel', model.reset, { signal });
  const managers = [];
  function createStick(zone, onMove, onEnd) {
    if (!touch || !zone) return;
    const manager = nipplejs.create({
      zone,
      mode: 'static',
      position: { left: '50%', top: '50%' },
      color: '#d8b976',
      size: 96,
      restOpacity: 0.65,
    });
    manager.on('move', (event) => onMove(event.data.vector.x, -event.data.vector.y));
    manager.on('end', onEnd);
    zone.addEventListener('pointercancel', model.reset, { signal });
    managers.push(manager);
  }
  createStick(joystickZone, model.setStick, () => model.setStick(0, 0));
  createStick(aimZone, model.setAimStick, () => model.setAimStick(0, 0));
  function reposition() {
    for (const manager of managers) manager.reposition();
  }
  return {
    sample: model.sample,
    toggleSneak: model.toggleSneak,
    reposition,
    setAimMode(mode) {
      model.setAimMode(mode);
      reposition();
    },
    reset: model.reset,
    setEnabled(value) {
      model.setEnabled(value);
      if (value) reposition();
    },
    dispose() {
      model.reset();
      controller.abort();
      for (const manager of managers) manager.destroy();
    },
  };
}

export function bindActionButton(button, action, { signal } = {}) {
  let lastTouch = -Infinity;
  button.addEventListener(
    'pointerdown',
    (event) => {
      if (button.disabled || !['touch', 'pen'].includes(event.pointerType)) return;
      lastTouch = event.timeStamp;
      event.preventDefault();
      action();
    },
    { signal },
  );
  button.addEventListener(
    'pointerup',
    (event) => {
      if (['touch', 'pen'].includes(event.pointerType)) {
        lastTouch = event.timeStamp;
        event.preventDefault();
      }
    },
    { signal },
  );
  button.addEventListener(
    'click',
    (event) => {
      if (button.disabled) return;
      if (event.detail > 0 && event.timeStamp >= lastTouch && event.timeStamp - lastTouch < 800)
        return;
      action();
    },
    { signal },
  );
}
