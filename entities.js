import * as THREE from 'three';
import { getSkin } from './skins.js?v=0.13.0';

export function createPlayer() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const geometries = [];
  const materials = [];
  const material = (color, options = {}) => {
    const value = new THREE.MeshStandardMaterial({ color, roughness: 0.88, ...options });
    materials.push(value);
    return value;
  };
  const cloak = material(0x344b52);
  const hood = material(0x415a60);
  const face = material(0x111d21);
  const brass = material(0xc3a36a, { metalness: 0.6, roughness: 0.4 });
  const glow = material(0xffe3a0, { emissive: 0xffc86b, emissiveIntensity: 2 });
  function mesh(geometry, mat, x, y, z) {
    geometries.push(geometry);
    const value = new THREE.Mesh(geometry, mat);
    value.position.set(x, y, z);
    value.castShadow = true;
    body.add(value);
    return value;
  }
  mesh(new THREE.ConeGeometry(0.34, 0.78, 8), cloak, 0, 0.52, 0).rotation.z = 0.04;
  mesh(new THREE.SphereGeometry(0.25, 10, 8), hood, 0, 1.02, 0);
  mesh(new THREE.SphereGeometry(0.17, 8, 6), face, 0, 1.01, -0.17).scale.set(1, 0.95, 0.38);
  mesh(new THREE.BoxGeometry(0.15, 0.19, 0.23), face, -0.13, 0.13, 0);
  mesh(new THREE.BoxGeometry(0.15, 0.19, 0.23), face, 0.13, 0.13, 0);
  mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.25, 8), brass, 0.31, 0.68, -0.28).rotation.x =
    Math.PI / 2;
  mesh(new THREE.CircleGeometry(0.071, 12), glow, 0.31, 0.68, -0.409).rotation.y = Math.PI;
  const light = new THREE.SpotLight(0xffe8bd, 160, 12, Math.PI / 6.5, 0.6, 1.5);
  light.position.set(0.31, 0.76, -0.4);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.bias = -0.0004;
  light.shadow.normalBias = 0.035;
  light.shadow.camera.near = 0.1;
  light.shadow.camera.far = 14;
  const lightTarget = new THREE.Object3D();
  lightTarget.position.set(0.1, 0, -7);
  body.add(light, lightTarget);
  light.target = lightTarget;
  const halo = new THREE.PointLight(0xa1c4c8, 1.2, 2.2, 2);
  halo.position.y = 1.7;
  root.add(halo);
  return {
    root,
    light,
    lightTarget,
    setSkin(id) {
      const skin = getSkin(id);
      cloak.color.setHex(skin.cloak);
      hood.color.setHex(skin.hood);
    },
    update(time, moving, aimX, aimZ) {
      if (aimX || aimZ) body.rotation.y = Math.atan2(-aimX, -aimZ);
      body.position.y = moving ? Math.sin(time * 11) * 0.035 : Math.sin(time * 2) * 0.012;
      body.rotation.z = moving ? Math.sin(time * 5.5) * 0.045 : 0;
    },
    dispose() {
      geometries.forEach((value) => value.dispose());
      materials.forEach((value) => value.dispose());
      light.dispose();
      halo.dispose();
      root.removeFromParent();
    },
  };
}
