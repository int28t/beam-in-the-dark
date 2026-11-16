export const ADMIN_TG_ID = 7479182915;
export function canUseDebug({
  hostname = globalThis.location?.hostname ?? '',
  app = globalThis.window?.Telegram?.WebApp,
} = {}) {
  if (['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname)) return true;
  return (
    !!app?.initData &&
    Number.isSafeInteger(app.initDataUnsafe?.user?.id) &&
    app.initDataUnsafe.user.id === ADMIN_TG_ID
  );
}
export function createDebug({
  game,
  allowed = canUseDebug,
  onChange = () => {},
  onTeleport = () => {},
  onUnlock = () => {},
  onReset = () => {},
}) {
  return {
    get available() {
      return !!allowed();
    },
    execute(action, value) {
      if (!allowed() || game.state.phase !== 'paused') return false;
      if (action === 'invincible' || action === 'infiniteLight')
        game.setDebug({ [action]: !!value });
      else if (action === 'key') {
        game.state.hasKey = true;
        game.state.practice = true;
      } else if (action === 'floor') {
        const floor = Number(value);
        if (!Number.isSafeInteger(floor) || floor < 1 || floor > 9999) return false;
        game.teleport(floor);
        onTeleport();
      } else if (action === 'skins') onUnlock();
      else if (action === 'reset') {
        if (onReset() === false) return false;
      } else return false;
      onChange();
      return true;
    },
  };
}
