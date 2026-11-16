import * as THREE from 'three';
import nipplejs from 'nipplejs';
import { createPlayer } from './entities.js?v=0.13.0';
import { createInput } from './input.js?v=0.13.0';
import { getDifficulty } from './difficulty.js?v=0.13.0';
import { generateFloor } from './generator.js?v=0.13.0';
import { createMapView } from './map-view.js?v=0.13.0';
import { VERSION } from './config.js?v=0.13.0';
import { getBiome } from './biomes.js?v=0.13.0';
import { createWorld } from './world.js?v=0.13.0';
import { createEnemyView } from './enemy-view.js?v=0.13.0';
import { createGame } from './game.js?v=0.13.0';
import { createUI } from './ui.js?v=0.13.0';
import { createSaveStore } from './cloud-save.js?v=0.13.0';
import { createDebug } from './debug.js?v=0.13.0';
import { SKINS, earnedSkins } from './skins.js?v=0.13.0';
import { createAudio } from './audio.js?v=0.13.0';
import { createPlatform } from './platform.js?v=0.13.0';
import { applyQuality } from './quality.js?v=0.13.0';
import { createFrameMeter } from './frame-meter.js?v=0.13.0';

export function start() {
  const container = document.querySelector('#scene');
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.setAttribute('aria-label', 'Герой с фонарём в каменном замке');
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03070b);
  scene.fog = new THREE.FogExp2(0x03070b, 0.075);
  const ambient = new THREE.HemisphereLight(0x9aafb6, 0x080b0d, 0.12);
  scene.add(ambient);
  const moon = new THREE.DirectionalLight(0x8aa8bb, 0.08);
  moon.position.set(-5, 10, -2);
  scene.add(moon);
  const player = createPlayer();
  scene.add(player.root);
  let map, world, mapView;
  let enemyViews = [];

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  // tan(55°) ≈ 12/8.4; horizontal field of view remains usable on narrow phones.
  const cameraOffset = new THREE.Vector3(0, 12, 8.4);
  const cameraFocus = new THREE.Vector3();
  const cameraDestination = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const aimPoint = new THREE.Vector3();
  const requestedSeed = new URLSearchParams(location.search).get('seed');
  const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
  let runSeed =
    requestedSeed !== null && /^\d{1,10}$/.test(requestedSeed)
      ? Number(requestedSeed) >>> 0
      : randomSeed();
  const game = createGame();
  const saves = createSaveStore({
    onChange: () => applyProgress(),
    onStatus: (info) => ui.setSaveStatus(info),
  });
  const progress = saves.value;
  let appliedAimMode = progress.touchAim;
  const debug = createDebug({
    game,
    onChange: () => sync(),
    onTeleport: () => sync(),
    onUnlock: () =>
      saves.update({
        skins: { unlocked: [...new Set([...progress.skins.unlocked, ...Object.keys(SKINS)])] },
      }),
    onReset: () => {
      if (saves.reset() === false) return false;
      runSeed = randomSeed();
      game.dispatch('newRun');
      game.dispatch('pause');
      sync();
    },
  });
  const frameMeter = createFrameMeter();
  const audio = createAudio();
  audio.setMuted(progress.muted);
  const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const ui = createUI((action, value) => act(action, value), {
    touch,
    tutorialSeen: progress.tutorialSeen,
    debug,
  });
  ui.setProgress(progress);
  ui.setSaveStatus(saves.info);
  player.setSkin(progress.skins.selected);
  const input = createInput(container, {
    joystickZone: document.querySelector('#joystick'),
    aimZone: document.querySelector('#aim-joystick'),
    touch,
    aimMode: progress.touchAim,
    nipplejs,
    onToggle() {
      act('toggleLight');
    },
    onMute() {
      act('toggleMute');
    },
    onPause() {
      if (game.state.phase === 'playing') act('pause');
      else if (game.state.phase === 'paused') act('resume');
    },
  });
  const platform = createPlatform({
    onInactive: () => pause(),
    onLayout: (info) => {
      saves.connect(window.Telegram?.WebApp);
      ui.setPlatform(info);
      ui.render(game.state);
      updateGraphics();
    },
  });
  const events = new AbortController();
  let previous = null;
  let time = 0;
  let animation;
  let activePhase;
  let activeRevision = -1;
  let disposed = false;
  let wasThreat = false;

  function applyProgress() {
    audio.setMuted(progress.muted);
    ui.setProgress(progress);
    player.setSkin(progress.skins.selected);
    if (appliedAimMode !== progress.touchAim) {
      appliedAimMode = progress.touchAim;
      input.setAimMode(appliedAimMode);
    }
    updateGraphics();
  }
  function resetWorld() {
    mapView?.dispose();
    enemyViews.forEach((view) => view.dispose());
    map = generateFloor({
      seed: runSeed,
      floor: game.state.floor,
      difficulty: getDifficulty(game.state.floor),
    });
    const biome = getBiome(map.biome);
    scene.background.setHex(biome.fog);
    scene.fog.color.setHex(biome.fog);
    scene.fog.density = biome.fogDensity;
    ambient.color.setHex(biome.sky);
    ambient.groundColor.setHex(biome.ground);
    ambient.intensity = biome.ambient;
    moon.color.setHex(biome.sky);
    moon.intensity = biome.moon;
    ui.setFloorCode(map.seed, map.floor, biome);
    world = createWorld(map);
    mapView = createMapView(map);
    scene.add(mapView.root);
    enemyViews = world.enemies.map((enemy) => {
      const view = createEnemyView(enemy.type, map);
      scene.add(view.root);
      return view;
    });
    player.root.position.set(world.position.x, 0, world.position.z);
    player.update(0, false, 0, -1);
    cameraFocus.copy(player.root.position);
    camera.position.copy(cameraFocus).add(cameraOffset);
    camera.lookAt(cameraFocus);
    time = 0;
    wasThreat = false;
    updateGraphics();
    world.enemies.forEach((enemy, i) => enemyViews[i].update(enemy, 0));
  }
  function sync() {
    if (activeRevision !== game.state.revision) {
      resetWorld();
      input.reset({ aim: true });
      activeRevision = game.state.revision;
    }
    const phaseChanged = activePhase !== game.state.phase;
    ui.render(game.state);
    if (phaseChanged) {
      input.setEnabled(game.state.phase === 'playing');
      previous = null;
      frameMeter.reset();
      activePhase = game.state.phase;
      platform.setPlaying(activePhase === 'playing');
      if (activePhase !== 'playing') audio.pause();
    }
    mapView.update(time, game.state.hasKey, world.collected);
    player.light.visible = game.state.lightOn;
  }
  function updateGraphics() {
    const profile = applyQuality({
      renderer,
      light: player.light,
      mapView,
      mode: progress.quality,
      touch,
      devicePixelRatio: window.devicePixelRatio,
    });
    document.querySelector('#app').classList.toggle('quality-low', profile.name === 'low');
    resize();
  }
  function act(action, value) {
    if (action === 'debug') return debug.execute(value.action, value.value);
    if (action === 'setSkin') {
      if (Object.hasOwn(SKINS, value) && progress.skins.unlocked.includes(value))
        saves.update({ skins: { selected: value } });
      return;
    }
    if (['start', 'resume'].includes(action)) void saves.flush();
    if (action === 'toggleSneak') {
      input.toggleSneak();
      return;
    }
    if (action === 'toggleFullscreen') {
      platform.toggleFullscreen();
      return;
    }
    if (action === 'setQuality' && ['auto', 'low', 'normal'].includes(value)) {
      saves.update({ quality: value });
      return;
    }
    if (action === 'setTouchAim' && ['movement', 'dual'].includes(value)) {
      saves.update({ touchAim: value });
      return;
    }
    if (action === 'toggleMute') {
      saves.update({ muted: !progress.muted });
      if (!progress.muted) void audio.unlock();
      return;
    }
    if (['start', 'resume', 'restart', 'next', 'newRun', 'toggleLight'].includes(action))
      void audio.unlock();
    if (action === 'newRun' && game.state.phase !== 'playing') runSeed = randomSeed();
    if (action === 'start' && !progress.tutorialSeen) {
      saves.update({ tutorialSeen: true });
    }
    const lightWasOn = game.state.lightOn;
    game.dispatch(action);
    sync();
    if (lightWasOn !== game.state.lightOn && action === 'toggleLight') audio.play('click');
  }
  function pause() {
    audio.pause();
    if (game.state.phase === 'playing') act('pause');
    else input.reset();
  }
  function resize() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.fov = width < height ? 52 : 42;
    camera.updateProjectionMatrix();
    input.reposition();
  }

  window.addEventListener('blur', pause, { signal: events.signal });
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) pause();
    },
    { signal: events.signal },
  );
  renderer.domElement.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault();
      pause();
      document.querySelector('#error-message').textContent =
        'Графический контекст потерян. Обновите страницу, чтобы вернуться в замок.';
      document.querySelector('#fatal-error').hidden = false;
    },
    { signal: events.signal },
  );
  resize();
  sync();
  platform.ready();
  document.querySelector('#version').textContent = `Версия ${VERSION}`;

  function animate(now) {
    animation = requestAnimationFrame(animate);
    const dt = previous === null ? 0 : Math.min((now - previous) / 1000, 0.05);
    previous = now;
    if (game.state.phase === 'playing') {
      const fps = frameMeter.sample(now);
      if (fps !== null) ui.setFrameRate(fps);
      time += dt;
      const controls = input.sample();
      if (controls.mouseAim) {
        mouse.set(controls.pointerX, controls.pointerY);
        raycaster.setFromCamera(mouse, camera);
        if (raycaster.ray.intersectPlane(ground, aimPoint)) {
          controls.aimX = aimPoint.x - player.root.position.x;
          controls.aimZ = aimPoint.z - player.root.position.z;
        }
      }
      if (!debug.available && (game.state.cheats.invincible || game.state.cheats.infiniteLight))
        game.setDebug({ invincible: false, infiniteLight: false });
      const feedback = world.step(dt, controls, game);
      player.root.position.set(world.position.x, 0, world.position.z);
      player.update(time, feedback.walking, world.aim.x, world.aim.z);
      for (let i = 0; i < world.enemies.length; i++) enemyViews[i].update(world.enemies[i], time);
      if (activePhase !== game.state.phase) sync();
      if (game.state.phase === 'playing') audio.update(dt, feedback);
      if (feedback.keyPicked) {
        audio.play('key');
        platform.haptic('key');
      }
      if (feedback.threat && !wasThreat) platform.haptic('danger');
      wasThreat = feedback.threat;
      if (feedback.roar) audio.play('roar');
      if (feedback.parasiteHit) audio.play('parasite');
      if (feedback.batteriesPicked) audio.play('battery');
      if (feedback.caught) {
        audio.play('caught');
        platform.haptic('caught');
      }
      if (feedback.completed) {
        audio.play('complete');
        if (!game.state.practice && game.state.streak > progress.best) {
          saves.update({
            best: game.state.streak,
            skins: {
              unlocked: [
                ...new Set([...progress.skins.unlocked, ...earnedSkins(game.state.streak)]),
              ],
            },
          });
        }
      }
      ui.render(game.state, feedback);
      mapView.update(time, game.state.hasKey, world.collected);
      player.light.visible = game.state.lightOn;
      const position = player.root.position;
      cameraFocus.lerp(position, 1 - Math.exp(-7 * dt));
      cameraDestination.copy(cameraFocus).add(cameraOffset);
      camera.position.copy(cameraDestination);
      camera.lookAt(cameraFocus);
    }
    if (!document.hidden) renderer.render(scene, camera);
  }
  animation = requestAnimationFrame(animate);

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(animation);
    events.abort();
    saves.dispose();
    platform.dispose();
    audio.dispose();
    input.dispose();
    ui.dispose();
    player.dispose();
    enemyViews.forEach((view) => view.dispose());
    mapView.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  }
  window.addEventListener(
    'pagehide',
    (event) => {
      pause();
      if (!event.persisted) dispose();
    },
    { signal: events.signal },
  );
  return { dispose };
}
