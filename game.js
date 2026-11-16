export function createGame() {
  const state = { phase: 'menu', floor: 1, hasKey: false, revision: 0 };
  function resetFloor({ floor = state.floor } = {}) {
    state.floor = floor;
    state.hasKey = false;
    state.phase = 'playing';
    state.revision++;
  }
  function dispatch(action) {
    switch (action) {
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
  function resolveFrame({ caught = false, key = false, exit = false } = {}) {
    if (state.phase !== 'playing') return state;
    // One outcome per frame. Defeat wins even if the player reaches the exit.
    if (caught) { state.phase = 'gameOver'; return state; }
    if (key) state.hasKey = true;
    if (exit && state.hasKey) state.phase = 'floorComplete';
    return state;
  }
  return { state, dispatch, resetFloor, resolveFrame };
}
