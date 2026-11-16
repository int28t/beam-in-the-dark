const MOVEMENT_CODES = new Set([
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
  };
  let stickX = 0;
  let stickZ = 0;
  let enabled = false;
  function reset({ aim = false } = {}) {
    keys.clear();
    stickX = 0;
    stickZ = 0;
    state.moveX = 0;
    state.moveZ = 0;
    if (aim) {
      state.aimX = 0;
      state.aimZ = -1;
      state.mouseAim = false;
    }
  }
  return {
    get enabled() {
      return enabled;
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
      state.moveX = vector.x;
      state.moveZ = vector.z;
      const length = Math.hypot(vector.x, vector.z);
      if (!state.mouseAim && length > 0.06) {
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
  { joystickZone, nipplejs, onPause, onToggle = () => {}, onMute = () => {} },
) {
  const controller = new AbortController();
  const { signal } = controller;
  const model = createInputState();
  window.addEventListener(
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
  window.addEventListener(
    'keyup',
    (event) => {
      model.keyUp(event.code);
    },
    { signal },
  );
  window.addEventListener('blur', model.reset, { signal });
  document.addEventListener('visibilitychange', model.reset, { signal });
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
  const manager = nipplejs.create({
    zone: joystickZone,
    mode: 'static',
    position: { left: '50%', top: '50%' },
    color: '#d8b976',
    size: 100,
    restOpacity: 0.65,
  });
  manager.on('move', (event) => {
    model.setStick(event.data.vector.x, -event.data.vector.y);
  });
  manager.on('end', () => {
    model.setStick(0, 0);
  });
  joystickZone.addEventListener('pointercancel', model.reset, { signal });
  return {
    sample: model.sample,
    reset: model.reset,
    setEnabled(value) {
      model.setEnabled(value);
      if (value) manager.reposition();
    },
    dispose() {
      model.reset();
      controller.abort();
      manager.destroy();
    },
  };
}
