import { FLASHLIGHT } from './config.js';

export function createGame() {
  const state = { phase: 'menu', floor: 1, hasKey: false, revision: 0, battery: FLASHLIGHT.capacity, lightOn: true };
  function resetFloor({ floor = state.floor } = {}) {
    state.floor = floor;
    state.hasKey = false;
    state.battery = FLASHLIGHT.capacity; state.lightOn = true;
    state.phase = 'playing';
    state.revision++;
  }
  function dispatch(action) {
    switch (action) {
      case 'toggleLight': if(state.phase==='playing'&&state.battery>0) state.lightOn=!state.lightOn; break;
      case 'start': if (state.phase === 'menu') resetFloor({ floor: 1 }); break;
      case 'pause': if (state.phase === 'playing') state.phase = 'paused'; break;
      case 'resume': if (state.phase === 'paused') state.phase = 'playing'; break;
      case 'next': if (state.phase === 'floorComplete') resetFloor({ floor: state.floor + 1 }); break;
      case 'restart': if (['paused', 'floorComplete', 'gameOver'].includes(state.phase)) resetFloor(); break;
      case 'newRun': if (state.phase !== 'playing') resetFloor({ floor: 1 }); break;
      default: break;
    }
    return state;
  }
  function resolveFrame({ caught = false, key = false, exit = false, battery = 0 } = {}) {
    if (state.phase !== 'playing') return state;
    // One outcome per frame. Defeat wins even if the player reaches the exit.
    if (caught) { state.phase = 'gameOver'; return state; }
    if (key) state.hasKey = true;
    if(battery>0) state.battery=Math.min(FLASHLIGHT.capacity,state.battery+battery*FLASHLIGHT.refill);
    if (exit && state.hasKey) state.phase = 'floorComplete';
    return state;
  }
  function drainLight(dt,exposed) {
    if(state.phase!=='playing'||!state.lightOn) return;
    state.battery=Math.max(0,state.battery-Math.max(0,dt)*(FLASHLIGHT.drain+(exposed?FLASHLIGHT.exposedDrain:0)));
    if(state.battery===0) state.lightOn=false;
  }
  return { state, dispatch, resetFloor, resolveFrame, drainLight };
}
