import * as THREE from 'three';
import { getMonsterType } from './monster-types.js';

export function createEnemyView(type) {
  const profile = getMonsterType(type);
  const root = new THREE.Group(),
    body = new THREE.Group();
  root.add(body);
  const geometries = [];
  const shadow = new THREE.MeshStandardMaterial({ color: profile.color, roughness: 1 });
  const marks = new THREE.MeshBasicMaterial({ color: profile.accent });
  function geometry(shape) {
    geometries.push(shape);
    return shape;
  }
  function part(shape, material, x, y, z) {
    const mesh = new THREE.Mesh(shape, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = material === shadow;
    body.add(mesh);
    return mesh;
  }
  if (profile.id === 'listener') {
    // Low, eyeless silhouette. Oversized ears identify the sound hunter.
    const torso = geometry(new THREE.SphereGeometry(0.35, 7, 5));
    const limb = geometry(new THREE.CylinderGeometry(0.055, 0.09, 0.4, 5));
    const ear = geometry(new THREE.ConeGeometry(0.19, 0.65, 3));
    const inner = geometry(new THREE.ConeGeometry(0.09, 0.38, 3));
    const trunk = part(torso, shadow, 0, 0.42, 0);
    trunk.scale.set(1, 0.85, 1.4);
    for (const side of [-1, 1]) {
      for (const z of [-0.24, 0.24])
        part(limb, shadow, side * 0.27, 0.21, z).rotation.z = side * 0.3;
      part(ear, shadow, side * 0.29, 0.83, -0.15).rotation.z = -side * 0.4;
      part(inner, marks, side * 0.3, 0.86, -0.25).rotation.z = -side * 0.4;
    }
  } else {
    const cloak = geometry(
      new THREE.ConeGeometry(
        profile.id === 'charger' ? 0.43 : 0.36,
        1.15,
        profile.id === 'charger' ? 4 : 7,
      ),
    );
    const head = geometry(new THREE.SphereGeometry(0.23, 8, 6));
    const eye = geometry(new THREE.SphereGeometry(0.044, 6, 4));
    part(cloak, shadow, 0, 0.6, 0);
    part(head, shadow, 0, 1.1, 0);
    for (const x of [-0.08, 0.08]) part(eye, marks, x, 1.12, -0.215);
    if (profile.id === 'charger') {
      const horn = geometry(new THREE.ConeGeometry(0.09, 0.47, 4));
      for (const side of [-1, 1])
        part(horn, shadow, side * 0.22, 1.34, 0).rotation.z = -side * 0.55;
      const crest = geometry(new THREE.BoxGeometry(0.12, 0.58, 0.035));
      part(crest, marks, 0, 0.67, -0.28);
    }
  }
  let disposed = false;
  return {
    root,
    update(enemy, time) {
      root.position.set(enemy.position.x, Math.sin(time * 3) * 0.025, enemy.position.z);
      body.rotation.y = Math.atan2(-enemy.aim.x, -enemy.aim.z);
      body.rotation.x = enemy.phase === 'dash' ? -0.3 : enemy.phase === 'windup' ? -0.12 : 0;
      const winding = enemy.phase === 'windup';
      const pulse = winding
        ? 0.7 + 0.3 * Math.sin(time * 24)
        : enemy.phase === 'recover'
          ? 0.35
          : 1;
      marks.color
        .setHex(winding ? 0xffbe55 : enemy.illuminated ? 0xffdbad : profile.accent)
        .multiplyScalar(pulse);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      geometries.forEach((g) => g.dispose());
      shadow.dispose();
      marks.dispose();
    },
  };
}
