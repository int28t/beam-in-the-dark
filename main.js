import * as THREE from 'three';
import nipplejs from 'nipplejs';
import { createPlayer, PLAYER_RADIUS, PLAYER_SPEED } from './entities.js';
import { createInput } from './input.js';
import { parseMap, FLOOR_TEMPLATE } from './map.js';
import { createMapView } from './map-view.js';
import { moveCircle } from './collision.js';
import { createGame } from './game.js';
import { createUI } from './ui.js';

export function start() {
  const container = document.querySelector('#scene');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.domElement.setAttribute('aria-label', 'Герой с фонарём в каменном замке');
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x10191e);
  scene.fog = new THREE.FogExp2(0x10191e, 0.045);
  scene.add(new THREE.HemisphereLight(0x9aafb6, 0x1b2222, 1.3));
  const moon = new THREE.DirectionalLight(0x8aa8bb, 1.6);
  moon.position.set(-5, 10, -2);
  scene.add(moon);
  const player = createPlayer();
  scene.add(player.root);
  const map = parseMap(FLOOR_TEMPLATE);
  const exitWall = { minX: map.spawns.exit.x - 0.5, maxX: map.spawns.exit.x + 0.5,
    minZ: map.spawns.exit.z + 0.28, maxZ: map.spawns.exit.z + 0.42 };
  const lockedWalls = [...map.walls, exitWall];
  let mapView;

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  // tan(55°) ≈ 12/8.4; horizontal field of view remains usable on narrow phones.
  const cameraOffset = new THREE.Vector3(0, 12, 8.4);
  const cameraFocus = new THREE.Vector3();
  const cameraDestination = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const aimPoint = new THREE.Vector3();
  const displacement = { x: 0, z: 0 };
  const frameEvents = { key: false, exit: false };
  const frameUI = { nearLockedExit: false };
  const game = createGame();
  const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const ui = createUI(action => act(action), { touch });
  const input = createInput(container, { joystickZone: document.querySelector('#joystick'), nipplejs,
    onPause() {
      if (game.state.phase === 'playing') act('pause');
      else if (game.state.phase === 'paused') act('resume');
    } });
  const events = new AbortController();
  let previous = null;
  let time = 0;
  let animation;
  let activePhase;
  let activeRevision = -1;
  let disposed = false;

  function resetWorld() {
    mapView?.dispose();
    mapView = createMapView(map);
    scene.add(mapView.root);
    player.root.position.set(map.spawns.player.x, 0, map.spawns.player.z);
    player.update(0, false, 0, -1);
    cameraFocus.copy(player.root.position);
    camera.position.copy(cameraFocus).add(cameraOffset);
    camera.lookAt(cameraFocus);
    time = 0;
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
      activePhase = game.state.phase;
    }
    mapView.update(time, game.state.hasKey);
  }
  function act(action) { game.dispatch(action); sync(); }
  function pause() { if (game.state.phase === 'playing') act('pause'); else input.reset(); }
  function resize() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.fov = width < height ? 52 : 42;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize, { signal: events.signal });
  window.addEventListener('blur', pause, { signal: events.signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); }, { signal: events.signal });
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault(); pause();
    document.querySelector('#error-message').textContent = 'Графический контекст потерян. Обновите страницу, чтобы вернуться в замок.';
    document.querySelector('#fatal-error').hidden = false;
  }, { signal: events.signal });
  resize(); sync();

  function animate(now) {
    animation = requestAnimationFrame(animate);
    const dt = previous === null ? 0 : Math.min((now - previous) / 1000, 0.05);
    previous = now;
    if (game.state.phase === 'playing') {
      time += dt;
      const controls = input.sample();
      displacement.x = controls.moveX * PLAYER_SPEED * dt;
      displacement.z = controls.moveZ * PLAYER_SPEED * dt;
      moveCircle(player.root.position, displacement, PLAYER_RADIUS, game.state.hasKey ? map.walls : lockedWalls);
      if (controls.mouseAim) {
        mouse.set(controls.pointerX, controls.pointerY);
        raycaster.setFromCamera(mouse, camera);
        if (raycaster.ray.intersectPlane(ground, aimPoint)) {
          controls.aimX = aimPoint.x - player.root.position.x;
          controls.aimZ = aimPoint.z - player.root.position.z;
        }
      }
      player.update(time, Boolean(controls.moveX || controls.moveZ), controls.aimX, controls.aimZ);
      const position = player.root.position;
      const exitDistance = Math.hypot(position.x - map.spawns.exit.x, position.z - map.spawns.exit.z);
      frameEvents.key = !game.state.hasKey && Math.hypot(position.x - map.spawns.key.x, position.z - map.spawns.key.z) < 0.65;
      frameEvents.exit = exitDistance < 0.7;
      game.resolveFrame(frameEvents);
      if (activePhase !== game.state.phase) sync();
      frameUI.nearLockedExit = exitDistance < 1.25;
      ui.render(game.state, frameUI);
      mapView.update(time, game.state.hasKey);
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
    events.abort(); input.dispose(); ui.dispose(); player.dispose(); mapView.dispose(); renderer.dispose();
    renderer.domElement.remove();
  }
  window.addEventListener('pagehide', event => { pause(); if (!event.persisted) dispose(); }, { signal: events.signal });
  return { dispose };
}
