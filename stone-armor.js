import * as THREE from 'three';
// Shared silhouette for the live mimic and harmless statues on solid wall supports.
// The caller owns the returned geometries and may instance repeated parts.
export function createArmorParts() {
  const block = new THREE.BoxGeometry(1, 1, 1),
    head = new THREE.SphereGeometry(0.18, 5, 4);
  return [
    {
      geometry: new THREE.CylinderGeometry(0.28, 0.33, 0.13, 6),
      x: 0,
      y: 0.065,
      z: 0,
      sx: 1,
      sy: 1,
      sz: 1,
    },
    { geometry: new THREE.ConeGeometry(0.31, 0.65, 4), x: 0, y: 0.73, z: 0, sx: 1, sy: 1, sz: 0.8 },
    { geometry: head, x: 0, y: 1.18, z: 0, sx: 1, sy: 1.25, sz: 0.8 },
    ...[-1, 1].flatMap((side) => [
      { geometry: block, x: side * 0.13, y: 0.29, z: 0, sx: 0.15, sy: 0.38, sz: 0.18 },
      { geometry: block, x: side * 0.31, y: 0.79, z: 0, sx: 0.17, sy: 0.45, sz: 0.21 },
    ]),
  ];
}
