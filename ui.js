import { bindActionButton } from './input.js?v=0.13.0';
import { VERSION } from './config.js?v=0.13.0';
import { SKINS } from './skins.js?v=0.13.0';
import { createDebugView } from './debug-view.js?v=0.13.0';
const PANELS = {
  menu: {
    caption: 'За порогом света',
    title: 'Beam in the Dark',
    description:
      'В заброшенном замке ещё горит один фонарь. Найдите золотой ключ и доберитесь до двери с бирюзовым светом.',
    actions: [['start', 'Войти в замок']],
    note: 'Свет замедляет тень. Стены скрывают вас от её взгляда.',
  },
  paused: {
    caption: 'Свет подождёт',
    title: 'Пауза',
    description:
      'Замок замер. Продолжайте с того места, где остановились, или начните этот этаж заново.',
    actions: [
      ['resume', 'Продолжить'],
      ['restart', 'Повторить этаж'],
      ['newRun', 'С первого этажа'],
    ],
    note: 'Ключ и позиция сохраняются до продолжения.',
  },
  floorComplete: {
    caption: 'Ещё одна дверь открыта',
    title: 'Выход найден',
    description: 'Золотой ключ подошёл к замку. За дверью — следующий этаж.',
    actions: [
      ['next', 'Следующий этаж'],
      ['restart', 'Повторить этаж'],
    ],
    note: 'На следующем этаже вас снова ждёт темнота.',
  },
  gameOver: {
    caption: 'Луч погас',
    title: 'Вас поймали',
    description: 'Попробуйте пройти этот этаж ещё раз. Повтор начнёт новую серию на этом же этаже.',
    actions: [
      ['restart', 'Повторить этаж'],
      ['newRun', 'С первого этажа'],
    ],
    note: '',
  },
};

export function createUI(onAction, { touch, tutorialSeen = false, debug }) {
  const app = document.querySelector('#app');
  app.classList.toggle('is-touch', touch);
  const overlay = document.querySelector('#overlay');
  const panel = overlay.querySelector('.panel');
  const actions = document.querySelector('#panel-actions');
  const pause = document.querySelector('#pause');
  const objective = document.querySelector('#objective');
  const touchControls = document.querySelector('#touch-controls');
  const announcement = document.querySelector('#announcement');
  const flashlight = document.querySelector('#flashlight');
  const sneak = document.querySelector('#sneak');
  const batteryMeter = document.querySelector('#battery-meter');
  const batteryFill = document.querySelector('#battery-fill');
  const batteryValue = document.querySelector('#battery-value');
  const danger = document.querySelector('#danger');
  const quality = document.querySelector('#quality');
  const touchAim = document.querySelector('#touch-aim');
  const aimControl = document.querySelector('#aim-control');
  const fullscreen = document.querySelector('#fullscreen');
  const fullscreenNote = document.querySelector('#fullscreen-note');
  document.querySelector('#aim-label').hidden = !touch;
  touchAim.hidden = !touch;
  const instructions = document.querySelector('#instructions');
  instructions.open = !tutorialSeen;
  const mute = document.querySelector('#mute');
  const streak = document.querySelector('#streak');
  const best = document.querySelector('#best');
  let lastStreak = -1;
  let lastBattery = -1,
    lastLight;
  const events = new AbortController();
  const dev = createDebugView((action, value) => onAction('debug', { action, value }));
  const skin = document.querySelector('#skin');
  skin.addEventListener('change', () => onAction('setSkin', skin.value), { signal: events.signal });
  quality.addEventListener('change', () => onAction('setQuality', quality.value), {
    signal: events.signal,
  });
  touchAim.addEventListener('change', () => onAction('setTouchAim', touchAim.value), {
    signal: events.signal,
  });
  fullscreen.addEventListener('click', () => onAction('toggleFullscreen'), {
    signal: events.signal,
  });
  mute.addEventListener('click', () => onAction('toggleMute'), { signal: events.signal });
  bindActionButton(sneak, () => onAction('toggleSneak'), { signal: events.signal });
  bindActionButton(flashlight, () => onAction('toggleLight'), { signal: events.signal });
  let lastPhase;
  let lastKey;
  let lastFloor;
  let lastMessage;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-describedby', 'panel-description');
  pause.addEventListener('click', () => onAction('pause'), { signal: events.signal });
  actions.addEventListener(
    'click',
    (event) => {
      const button = event.target.closest('button[data-action]');
      if (button) onAction(button.dataset.action);
    },
    { signal: events.signal },
  );
  overlay.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Tab') return;
      const buttons = [
        ...panel.querySelectorAll('button:not(:disabled),summary,select,input'),
      ].filter((element) => element.getClientRects().length > 0);
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        last.focus();
        event.preventDefault();
      } else if (!event.shiftKey && document.activeElement === last) {
        first.focus();
        event.preventDefault();
      }
    },
    { signal: events.signal },
  );
  document.querySelector('#version').textContent = `Версия ${VERSION}`;
  document.querySelector('#controls-hint').innerHTML = touch
    ? 'Джойстик — движение и направление света'
    : '<kbd>W A S D</kbd> / стрелки — движение　 Мышь — свет　 <kbd>F</kbd> — фонарь　 <kbd>Esc</kbd> — пауза';
  return {
    setProgress(progress) {
      best.textContent = String(progress.best);
      skin.replaceChildren(
        ...Object.entries(SKINS).map(([id, item]) => {
          const option = document.createElement('option');
          option.value = id;
          option.disabled = !progress.skins.unlocked.includes(id);
          option.textContent = item.name + (option.disabled ? ` · серия ${item.requiredBest}` : '');
          return option;
        }),
      );
      skin.value = progress.skins.selected;
      mute.setAttribute('aria-pressed', String(progress.muted));
      mute.textContent =
        (progress.muted ? 'Звук выключен' : 'Звук включён') + (touch ? '' : ' · M');
      quality.value = progress.quality;
      touchAim.value = progress.touchAim;
      app.dataset.aimMode = progress.touchAim;
      aimControl.hidden = !touch || progress.touchAim !== 'dual';
      if (touch) {
        const text =
          progress.touchAim === 'dual'
            ? 'Левый джойстик — движение, правый — свет. Направление света сохраняется после отпускания.'
            : 'Левый джойстик — движение и направление света. После остановки направление сохраняется.';
        document.querySelector('#control-instructions').textContent =
          text + ' Круглая кнопка — фонарь. «Тихий шаг» уменьшает скорость и шум. Пауза — вверху.';
        document.querySelector('#controls-hint').textContent = text;
      }
    },
    setSaveStatus({ status, localSaved = true }) {
      document.querySelector('#save-status').textContent =
        status === 'readonly'
          ? 'Сохранение создано более новой версией — обновите игру.'
          : status === 'synced'
            ? 'Синхронизировано с Telegram'
            : status === 'syncing'
              ? 'Синхронизация с Telegram…'
              : status === 'offline'
                ? localSaved
                  ? 'Облако недоступно. Прогресс сохранён на устройстве.'
                  : 'Сохранение временно недоступно. Не закрывайте игру.'
                : localSaved
                  ? 'Сохранено на устройстве'
                  : 'Сохранение на устройстве недоступно в этом окне.';
    },
    setFrameRate(fps) {
      document.querySelector('#performance-note').textContent = `Последний замер: ${fps} кадров/с`;
    },
    setPlatform(info) {
      fullscreen.hidden = !info.fullscreenAvailable;
      fullscreen.textContent = info.isFullscreen ? 'Выйти из полного экрана' : 'На весь экран';
      fullscreenNote.textContent = info.fullscreenError;
      fullscreenNote.hidden = !info.fullscreenError;
    },
    setFloorCode(seed, floor, biome) {
      if (biome) {
        document.querySelector('#biome-name').textContent = biome.name;
        document.querySelector('#biome-name').style.color =
          `#${biome.accent.toString(16).padStart(6, '0')}`;
      }
      document.querySelector('#floor-code').textContent = `Код этажа: ${seed}:${floor}`;
    },
    render(
      state,
      {
        nearLockedExit = false,
        threat = false,
        lightHit = false,
        warning = false,
        sneaking = false,
        parasiteWarning = false,
        noiseAlarm = false,
      } = {},
    ) {
      const playing = state.phase === 'playing';
      dev.render(state, debug?.available ?? false);
      document.querySelector('#practice-note').hidden = !state.practice;
      if (state.streak !== lastStreak) {
        streak.textContent = String(state.streak);
        lastStreak = state.streak;
      }
      pause.hidden = !playing;
      sneak.hidden = !playing;
      sneak.setAttribute('aria-pressed', String(sneaking));
      flashlight.disabled = !playing || state.battery <= 0;
      const charge = Math.ceil(state.battery);
      if (charge !== lastBattery) {
        batteryMeter.setAttribute('aria-valuenow', String(charge));
        batteryFill.style.width = `${charge}%`;
        batteryValue.textContent = `${charge}%`;
        batteryMeter.classList.toggle('low', charge <= 20);
        lastBattery = charge;
      }
      if (state.lightOn !== lastLight) {
        flashlight.setAttribute('aria-pressed', String(state.lightOn));
        lastLight = state.lightOn;
      }
      danger.hidden = !playing || !(threat || parasiteWarning || noiseAlarm);
      danger.textContent = parasiteWarning
        ? 'Паразит высасывает заряд — выключите фонарь'
        : noiseAlarm
          ? 'Громила услышал шаги — смените позицию'
          : warning
            ? 'Ловчий готовит рывок — уйди в сторону'
            : lightHit
              ? 'Свет сдерживает преследователя'
              : 'Вас преследуют';
      touchControls.hidden = !touch || !playing;
      document.querySelector('#scene').setAttribute('aria-hidden', String(!playing));
      const message =
        nearLockedExit && !state.hasKey
          ? 'Дверь заперта. Найдите золотой ключ.'
          : state.hasKey
            ? 'Ключ найден. Ищите бирюзовую дверь.'
            : 'Найдите золотой ключ';
      if (message !== lastMessage) {
        objective.textContent = message;
        lastMessage = message;
      }
      if (state.hasKey !== lastKey) {
        objective.classList.toggle('has-key', state.hasKey);
        if (state.hasKey)
          announcement.textContent = 'Золотой ключ найден. Теперь можно открыть выход.';
        lastKey = state.hasKey;
      }
      if (state.floor !== lastFloor) {
        document.querySelector('#floor-number').textContent = String(state.floor).padStart(2, '0');
        lastFloor = state.floor;
      }
      if (state.phase === lastPhase) return;
      overlay.hidden = playing;
      instructions.hidden = !['menu', 'paused'].includes(state.phase);
      if (state.phase === 'paused') instructions.open = false;
      if (!playing) {
        const content = PANELS[state.phase];
        document.querySelector('#panel-caption').textContent = content.caption;
        document.querySelector('#panel-title').textContent = content.title;
        document.querySelector('#panel-description').textContent = content.description;
        document.querySelector('#panel-note').textContent = content.note;
        actions.replaceChildren(
          ...content.actions.map(([action, label], index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.action = action;
            button.textContent = label;
            if (!index) button.className = 'primary';
            return button;
          }),
        );
        actions.querySelector('button').focus({ preventScroll: true });
      } else {
        pause.focus({ preventScroll: true });
        announcement.textContent = state.hasKey
          ? 'Ищите выход.'
          : `Этаж ${state.floor}. Найдите ключ.`;
      }
      lastPhase = state.phase;
    },
    dispose() {
      dev.dispose();
      events.abort();
    },
  };
}
