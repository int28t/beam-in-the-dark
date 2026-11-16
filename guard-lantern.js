import * as THREE from 'three';
import { rayWallDistance } from './navigation.js';

export function createGuardLantern(root, map) {
  const range = 7,
    halfAngle = Math.PI / 5,
    segments = 16;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(segments * 9);
  const attribute = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', attribute);
  const material = new THREE.MeshBasicMaterial({
    color: 0xd83228,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const fan = new THREE.Mesh(geometry, material);
  fan.frustumCulled = false;
  fan.name = 'warden-vision-sector';
  root.add(fan);
  const light = new THREE.SpotLight(0xff3828, 9, range, halfAngle, 0.7, 2);
  light.position.set(0, 1.05, 0);
  light.castShadow = false;
  const target = new THREE.Object3D();
  root.add(light, target);
  light.target = target;
  function end(enemy, angle, out) {
    const dx = Math.sin(angle),
      dz = -Math.cos(angle);
    const distance = map
      ? Math.max(0, rayWallDistance(enemy.position.x, enemy.position.z, dx, dz, range, map) - 0.015)
      : range;
    out.x = dx * distance;
    out.z = dz * distance;
    out.distance = distance;
  }
  const left = { x: 0, z: 0, distance: 0 },
    right = { x: 0, z: 0, distance: 0 };
  return {
    update(enemy) {
      const heading = Math.atan2(enemy.aim.x, -enemy.aim.z);
      let nearest = range;
      for (let i = 0; i < segments; i++) {
        end(enemy, heading - halfAngle + (2 * halfAngle * i) / segments, left);
        end(enemy, heading - halfAngle + (2 * halfAngle * (i + 1)) / segments, right);
        const distance = Math.min(left.distance, right.distance);
        const leftScale = left.distance > 0 ? distance / left.distance : 0,
          rightScale = right.distance > 0 ? distance / right.distance : 0;
        const at = i * 9;
        positions[at] = 0;
        positions[at + 1] = 0.08;
        positions[at + 2] = 0;
        positions[at + 3] = left.x * leftScale;
        positions[at + 4] = 0.08;
        positions[at + 5] = left.z * leftScale;
        positions[at + 6] = right.x * rightScale;
        positions[at + 7] = 0.08;
        positions[at + 8] = right.z * rightScale;
        nearest = Math.min(nearest, left.distance, right.distance);
      }
      attribute.needsUpdate = true;
      target.position.set(enemy.aim.x * range, 0, enemy.aim.z * range);
      // Conservative range keeps the decorative light from shining past nearby walls.
      light.distance = Math.max(0.05, nearest - 0.1);
      light.intensity = enemy.isThreat ? 14 : 9;
    },
    dispose() {
      fan.removeFromParent();
      light.removeFromParent();
      target.removeFromParent();
      geometry.dispose();
      material.dispose();
      light.dispose();
    },
  };
}
