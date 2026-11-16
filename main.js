import * as THREE from 'three';
import { createPlayer } from './entities.js';

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
  scene.fog = new THREE.FogExp2(0x10191e, 0.055);
  scene.add(new THREE.HemisphereLight(0x9aafb6, 0x1b2222, 1.3));
  const moon = new THREE.DirectionalLight(0x8aa8bb, 1.6);
  moon.position.set(-5, 10, -2);
  scene.add(moon);
  const player = createPlayer();
  scene.add(player.root);
  const geometry = new THREE.BoxGeometry(1.46, 0.12, 1.46);
  const material = new THREE.MeshStandardMaterial({ color: 0x39474a, roughness: 0.96 });
  const floor = new THREE.InstancedMesh(geometry, material, 225);
  const matrix = new THREE.Matrix4();
  let i = 0;
  for (let z = -7; z <= 7; z++) for (let x = -7; x <= 7; x++) {
    matrix.makeTranslation(x * 1.5, -0.06, z * 1.5);
    floor.setMatrixAt(i++, matrix);
  }
  floor.receiveShadow = true;
  scene.add(floor);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  camera.position.set(0, 12, 8.4);
  camera.lookAt(0, 0, 0);
  function resize() {
    renderer.setSize(container.clientWidth, container.clientHeight);
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();
  document.querySelector('#overlay').hidden = true;
  document.querySelector('#objective').textContent = 'Первый свет в заброшенном замке';
  let animation;
  function animate(now) {
    animation = requestAnimationFrame(animate);
    player.update(now / 1000, false, 0, -1);
    renderer.render(scene, camera);
  }
  animation = requestAnimationFrame(animate);
  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(animation);
    window.removeEventListener('resize', resize);
    player.dispose(); geometry.dispose(); material.dispose(); renderer.dispose();
  }, { once: true });
}
