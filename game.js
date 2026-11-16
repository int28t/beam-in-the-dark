import { FLASHLIGHT } from './config.js?v=0.13.0';

export function createGame() {
  const state = {
    phase: 'menu',
    floor: 1,
    hasKey: false,
    revision: 0,
    battery: FLASHLIGHT.capacity,
    lightOn: true,
    streak: 0,
    practice: false,
    cheats: { invincible: false, infiniteLight: false },
  };
  function resetFloor({ floor = state.floor } = {}) {
    state.floor = floor;
    state.hasKey = false;
    state.battery = FLASHLIGHT.capacity;
    state.lightOn = true;
    state.phase = 'playing';
    state.revision++;
  }
  function dispatch(action) {
    switch (action) {
      case 'toggleLight':
        if (state.phase === 'playing' && state.battery > 0) state.lightOn = !state.lightOn;
        break;
      case 'start':
        if (state.phase === 'menu') {
          clearDebug();
          state.streak = 0;
          resetFloor({ floor: 1 });
        }
        break;
      case 'pause':
        if (state.phase === 'playing') state.phase = 'paused';
        break;
      case 'resume':
        if (state.phase === 'paused') state.phase = 'playing';
        break;
      case 'next':
        if (state.phase === 'floorComplete') resetFloor({ floor: state.floor + 1 });
        break;
      case 'restart':
        if (['paused', 'floorComplete', 'gameOver'].includes(state.phase)) {
          state.streak = 0;
          resetFloor();
        }
        break;
      case 'newRun':
        if (state.phase !== 'playing') {
          clearDebug();
          state.streak = 0;
          resetFloor({ floor: 1 });
        }
        break;
      default:
        break;
    }
    return state;
  }
  function resolveFrame({ caught = false, key = false, exit = false, battery = 0 } = {}) {
    if (state.phase !== 'playing') return state;
    // One outcome per frame. Defeat wins even if the player reaches the exit.
    if (caught && !state.cheats.invincible) {
      state.phase = 'gameOver';
      state.streak = 0;
      return state;
    }
    if (key) state.hasKey = true;
    if (battery > 0)
      state.battery = Math.min(FLASHLIGHT.capacity, state.battery + battery * FLASHLIGHT.refill);
    if (exit && state.hasKey) {
      state.phase = 'floorComplete';
      state.streak++;
    }
    return state;
  }
  function drainBattery(amount) {
    if (
      state.phase !== 'playing' ||
      state.cheats.infiniteLight ||
      !Number.isFinite(amount) ||
      amount <= 0
    )
      return;
    state.battery = Math.max(0, state.battery - amount);
    if (state.battery === 0) state.lightOn = false;
  }
  function drainLight(dt, exposed) {
    if (state.phase !== 'playing' || !state.lightOn || state.cheats.infiniteLight) return;
    state.battery = Math.max(
      0,
      state.battery -
        Math.max(0, dt) * (FLASHLIGHT.drain + (exposed ? FLASHLIGHT.exposedDrain : 0)),
    );
    if (state.battery === 0) state.lightOn = false;
  }
  function clearDebug() {
    state.practice = false;
    state.cheats.invincible = state.cheats.infiniteLight = false;
  }
  function setDebug(patch) {
    for (const key of ['invincible', 'infiniteLight'])
      if (typeof patch[key] === 'boolean') {
        state.cheats[key] = patch[key];
        state.practice = true;
      }
    if (state.cheats.infiniteLight) {
      state.battery = FLASHLIGHT.capacity;
      state.lightOn = true;
    }
  }
  function teleport(floor) {
    if (state.phase !== 'paused' || !Number.isSafeInteger(floor) || floor < 1 || floor > 9999)
      return false;
    state.practice = true;
    state.streak = 0;
    resetFloor({ floor });
    state.phase = 'paused';
    return true;
  }
  return {
    state,
    dispatch,
    resetFloor,
    resolveFrame,
    drainLight,
    drainBattery,
    setDebug,
    teleport,
    clearDebug,
  };
}
