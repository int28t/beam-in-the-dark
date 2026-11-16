import * as THREE from 'three';
import { getMonsterType } from './monster-types.js?v=0.13.0';
import { createGuardLantern } from './guard-lantern.js?v=0.13.0';
import { createArmorParts } from './stone-armor.js?v=0.13.0';

export function createEnemyView(type, map) {
  const profile = getMonsterType(type);
  const root = new THREE.Group(),
    body = new THREE.Group();
  root.add(body);
  const geometries = new Set();
  const shadow = new THREE.MeshStandardMaterial({ color: profile.color, roughness: 1 });
  const marks = new THREE.MeshBasicMaterial({ color: profile.accent });
  function geometry(shape) {
    geometries.add(shape);
    return shape;
  }
  function part(shape, material, x, y, z) {
    const mesh = new THREE.Mesh(shape, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = material === shadow;
    body.add(mesh);
    return mesh;
  }
  const arms = [];
  let lantern = null,
    wave = null;
  if (profile.id === 'warden') lantern = createGuardLantern(root, map);
  if (profile.id === 'mimic') {
    for (const item of createArmorParts())
      part(geometry(item.geometry), shadow, item.x, item.y, item.z).scale.set(
        item.sx,
        item.sy,
        item.sz,
      );
  } else if (profile.id === 'parasite') {
    const cloud = part(geometry(new THREE.IcosahedronGeometry(0.29, 0)), shadow, 0, 0.65, 0);
    cloud.scale.set(1.15, 0.8, 1);
    part(geometry(new THREE.OctahedronGeometry(0.14)), marks, 0, 0.67, 0);
    const orbit = geometry(new THREE.SphereGeometry(0.035, 5, 4));
    for (let i = 0; i < 5; i++)
      part(
        orbit,
        marks,
        Math.cos(i * 1.26) * 0.33,
        0.67 + Math.sin(i * 2) * 0.12,
        Math.sin(i * 1.26) * 0.33,
      );
  } else if (profile.id === 'listener') {
    // Low, eyeless silhouette. Oversized ears identify the sound hunter.
    const torso = geometry(new THREE.SphereGeometry(0.4, 7, 5));
    const limb = geometry(new THREE.CylinderGeometry(0.075, 0.12, 0.75, 5));
    const leg = geometry(new THREE.CylinderGeometry(0.1, 0.13, 0.4, 5));
    part(geometry(new THREE.SphereGeometry(0.24, 7, 5)), shadow, 0, 1.26, -0.2);
    const ear = geometry(new THREE.ConeGeometry(0.19, 0.65, 3));
    const inner = geometry(new THREE.ConeGeometry(0.09, 0.38, 3));
    const trunk = part(torso, shadow, 0, 0.8, 0);
    trunk.scale.set(1.2, 1.4, 1);
    for (const side of [-1, 1]) {
      part(limb, shadow, side * 0.4, 0.56, -0.1).rotation.z = side * 0.2;
      part(leg, shadow, side * 0.18, 0.22, 0.15);
      part(ear, shadow, side * 0.29, 1.42, -0.15).rotation.z = -side * 0.4;
      part(inner, marks, side * 0.3, 1.45, -0.25).rotation.z = -side * 0.4;
    }
    wave = part(geometry(new THREE.RingGeometry(0.85, 1, 32)), marks, 0, 0.04, 0);
    wave.rotation.x = -Math.PI / 2;
  } else {
    const cloak = geometry(
      new THREE.ConeGeometry(
        profile.id === 'charger' ? 0.43 : 0.3,
        profile.id === 'shadow' ? 1.45 : 1.15,
        profile.id === 'charger' ? 4 : 7,
      ),
    );
    if (profile.id === 'shadow') {
      const points = cloak.attributes.position;
      for (let i = 0; i < points.count; i++)
        if (points.getY(i) < -0.6)
          points.setY(
            i,
            points.getY(i) +
              0.1 * (0.5 + 0.5 * Math.sin(Math.atan2(points.getZ(i), points.getX(i)) * 3)),
          );
      cloak.computeVertexNormals();
    }
    const head = geometry(new THREE.SphereGeometry(0.23, 8, 6));
    const eye = geometry(new THREE.SphereGeometry(0.044, 6, 4));
    part(cloak, shadow, 0, profile.id === 'shadow' ? 0.76 : 0.6, 0);
    part(head, shadow, 0, profile.id === 'shadow' ? 1.38 : 1.1, 0);
    for (const x of [-0.08, 0.08])
      part(eye, marks, x, profile.id === 'shadow' ? 1.4 : 1.12, -0.215);
    if (profile.id === 'shadow') {
      const arm = geometry(new THREE.BoxGeometry(0.09, 0.48, 0.1));
      for (const side of [-1, 1])
        arms.push({ side, mesh: part(arm, shadow, side * 0.24, 0.9, -0.05) });
    }
    if (profile.id === 'warden') {
      part(geometry(new THREE.ConeGeometry(0.37, 0.22, 3)), shadow, 0, 1.36, 0);
      part(geometry(new THREE.BoxGeometry(0.19, 0.24, 0.17)), marks, 0.31, 0.75, -0.34);
      part(geometry(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 6)), shadow, 0.31, 0.89, -0.34);
      part(geometry(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 6)), shadow, 0.31, 0.61, -0.34);
    }
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
      lantern?.update(enemy);
      for (const arm of arms) {
        arm.mesh.position.set(
          arm.side * 0.22,
          enemy.phase === 'repelled' ? 1.28 : 0.9,
          enemy.phase === 'repelled' ? -0.22 : -0.05,
        );
        arm.mesh.rotation.z = enemy.phase === 'repelled' ? arm.side * 1.15 : arm.side * 0.1;
      }
      if (wave) {
        wave.visible = enemy.signal > 0;
        wave.scale.setScalar(1 + (1 - enemy.signal) * 3);
      }
      body.scale.y = enemy.phase === 'repelled' ? 0.9 : 1;
      body.rotation.z = profile.id === 'parasite' ? Math.sin(time * 7) * 0.12 : 0;
      root.position.set(
        enemy.position.x,
        profile.id === 'mimic' ? 0 : Math.sin(time * 3) * 0.025,
        enemy.position.z,
      );
      body.rotation.y = Math.atan2(-enemy.aim.x, -enemy.aim.z);
      body.rotation.x = enemy.phase === 'dash' ? -0.3 : enemy.phase === 'windup' ? -0.12 : 0;
      const winding = enemy.phase === 'windup';
      const pulse = winding
        ? 0.7 + 0.3 * Math.sin(time * 24)
        : enemy.phase === 'recover'
          ? 0.35
          : 1;
      marks.color
        .setHex(winding ? 0xffbe55 : enemy.lightAffected ? 0xffdbad : profile.accent)
        .multiplyScalar(pulse);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      lantern?.dispose();
      root.removeFromParent();
      geometries.forEach((g) => g.dispose());
      shadow.dispose();
      marks.dispose();
    },
  };
}
