export function normalizeMovement(x, z, out) {
  const scale = Math.max(1, Math.hypot(x, z));
  out.x = x / scale;
  out.z = z / scale;
  return out;
}

export function createInput(element, { joystickZone, nipplejs, onPause }) {
  const controller = new AbortController();
  const { signal } = controller;
  const keys = new Set();
  const vector = { x: 0, z: 0 };
  const state = { moveX: 0, moveZ: 0, aimX: 0, aimZ: -1, pointerX: 0, pointerY: 0, mouseAim: false };
  let stickX = 0;
  let stickZ = 0;
  let enabled = false;
  const movementCodes = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);
  function reset() {
    keys.clear(); stickX = 0; stickZ = 0;
    state.moveX = 0; state.moveZ = 0; state.mouseAim = false;
  }
  window.addEventListener('keydown', event => {
    if (event.code === 'Escape' && !event.repeat) onPause();
    if (!enabled || !movementCodes.has(event.code) || event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault(); keys.add(event.code);
    state.mouseAim = false;
  }, { signal });
  window.addEventListener('keyup', event => { keys.delete(event.code); }, { signal });
  window.addEventListener('blur', reset, { signal });
  document.addEventListener('visibilitychange', reset, { signal });
  element.addEventListener('pointermove', event => {
    if (!enabled || event.pointerType !== 'mouse') return;
    const rect = element.getBoundingClientRect();
    state.pointerX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    state.pointerY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    state.mouseAim = true;
  }, { signal });
  element.addEventListener('pointercancel', reset, { signal });
  const manager = nipplejs.create({ zone: joystickZone, mode: 'static', position: { left: '50%', top: '50%' },
    color: '#d8b976', size: 100, restOpacity: 0.65 });
  manager.on('move', event => {
    if (!enabled) return;
    const data = event.data;
    stickX = data.vector.x;
    stickZ = -data.vector.y;
    state.mouseAim = false;
  });
  manager.on('end', () => { stickX = 0; stickZ = 0; });
  joystickZone.addEventListener('pointercancel', reset, { signal });
  return {
    sample() {
      const x = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')) + stickX;
      const z = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp')) + stickZ;
      normalizeMovement(enabled ? x : 0, enabled ? z : 0, vector);
      state.moveX = vector.x; state.moveZ = vector.z;
      if (!state.mouseAim && Math.hypot(vector.x, vector.z) > 0.06) {
        const length = Math.hypot(vector.x, vector.z);
        state.aimX = vector.x / length; state.aimZ = vector.z / length;
      }
      return state;
    },
    reset,
    setEnabled(value) { enabled = value; reset(); if (value) manager.reposition(); },
    dispose() { reset(); controller.abort(); manager.destroy(); },
  };
}
