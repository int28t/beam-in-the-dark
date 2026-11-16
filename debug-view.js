export function createDebugView(onAction, { page = globalThis.document } = {}) {
  const button = page.querySelector('#dev-open'),
    panel = page.querySelector('#dev-panel'),
    confirm = page.querySelector('#dev-reset-confirm'),
    message = page.querySelector('#dev-message');
  const events = new AbortController();
  let permitted = false;
  function close() {
    panel.hidden = true;
    confirm.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  }
  button.addEventListener(
    'click',
    () => {
      if (!permitted) return;
      panel.hidden = !panel.hidden;
      button.setAttribute('aria-expanded', String(!panel.hidden));
      confirm.hidden = true;
    },
    { signal: events.signal },
  );
  panel.addEventListener(
    'change',
    (event) => {
      const action = event.target.dataset.debug;
      if (permitted && ['invincible', 'infiniteLight'].includes(action))
        onAction(action, event.target.checked);
    },
    { signal: events.signal },
  );
  panel.addEventListener(
    'click',
    (event) => {
      const target = event.target.closest('button[data-debug]');
      if (!permitted || !target) return;
      const action = target.dataset.debug;
      if (action === 'requestReset') {
        confirm.hidden = false;
        return;
      }
      if (action === 'cancelReset') {
        confirm.hidden = true;
        return;
      }
      if (action === 'reset' && confirm.hidden) return;
      const value = action === 'floor' ? page.querySelector('#dev-floor').value : undefined;
      const accepted = onAction(action, value);
      message.textContent = accepted ? 'Готово.' : 'Проверьте номер этажа или доступ к DEV.';
      if (action === 'reset') confirm.hidden = true;
    },
    { signal: events.signal },
  );
  return {
    render(state, available) {
      permitted = available && state.phase === 'paused';
      button.hidden = !permitted;
      if (!permitted) close();
      for (const key of ['invincible', 'infiniteLight'])
        panel.querySelector(`[data-debug="${key}"]`).checked = state.cheats[key];
    },
    dispose() {
      events.abort();
    },
  };
}
