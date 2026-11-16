import * as THREE from 'three';
import nipplejs from 'nipplejs';
import { createPlayer, PLAYER_RADIUS, PLAYER_SPEED } from './entities.js';
import { createInput } from './input.js';
import { parseMap, FLOOR_TEMPLATE } from './map.js';
import { createMapView } from './map-view.js';
import { moveCircle } from './collision.js';

export function start() {
  const container = document.querySelector('#scene');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
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
  const mapView = createMapView(map);
  scene.add(mapView.root);
  player.root.position.set(map.spawns.player.x, 0, map.spawns.player.z);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  const cameraOffset = new THREE.Vector3(0, 12, 8.4);
  const cameraFocus = player.root.position.clone();
  const cameraDestination = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const aimPoint = new THREE.Vector3();
  const displacement = { x: 0, z: 0 };
  let active = true;
  const input = createInput(container, { joystickZone: document.querySelector('#joystick'), nipplejs,
    onPause() { active = !active; input.setEnabled(active); } });
  input.setEnabled(true);
  const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  document.querySelector('#touch-controls').hidden = !touch;
  document.querySelector('#overlay').hidden = true;
  document.querySelector('#version').textContent = 'Версия 0.2.0';
  document.querySelector('#objective').textContent = 'Исследуйте заброшенный замок';
  document.querySelector('#controls-hint').textContent = touch ? 'Свет следует за направлением движения' : 'WASD / стрелки — движение · Мышь — свет · Esc — пауза';
  camera.position.copy(cameraFocus).add(cameraOffset);
  camera.lookAt(cameraFocus);
  const events = new AbortController();
  function resize() {
    renderer.setSize(container.clientWidth, container.clientHeight);
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize, { signal: events.signal });
  window.addEventListener('blur', () => { active = false; input.setEnabled(false); }, { signal: events.signal });
  resize();
  let animation;
  let previous = null;
  let time = 0;
  function animate(now) {
    animation = requestAnimationFrame(animate);
    const dt = previous === null ? 0 : Math.min((now - previous) / 1000, 0.05);
    previous = now;
    if (active) {
      time += dt;
      const controls = input.sample();
      displacement.x = controls.moveX * PLAYER_SPEED * dt;
      displacement.z = controls.moveZ * PLAYER_SPEED * dt;
      moveCircle(player.root.position, displacement, PLAYER_RADIUS, map.walls);
      if (controls.mouseAim) {
        mouse.set(controls.pointerX, controls.pointerY);
        raycaster.setFromCamera(mouse, camera);
        if (raycaster.ray.intersectPlane(ground, aimPoint)) {
          controls.aimX = aimPoint.x - player.root.position.x;
          controls.aimZ = aimPoint.z - player.root.position.z;
        }
      }
      player.update(time, Boolean(controls.moveX || controls.moveZ), controls.aimX, controls.aimZ);
      cameraFocus.lerp(player.root.position, 1 - Math.exp(-7 * dt));
      cameraDestination.copy(cameraFocus).add(cameraOffset);
      camera.position.copy(cameraDestination);
      camera.lookAt(cameraFocus);
    }
    renderer.render(scene, camera);
  }
  animation = requestAnimationFrame(animate);
  window.addEventListener('pagehide', event => {
    active = false;
    if (event.persisted) return;
    cancelAnimationFrame(animation);
    events.abort(); input.dispose(); player.dispose(); mapView.dispose(); renderer.dispose();
  }, { signal: events.signal });
}
