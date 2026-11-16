import * as THREE from 'three';
import { CELL_SIZE } from './map.js';

export function createBiomeDecor(map, biome) {
  const root = new THREE.Group(),
    detail = new THREE.Group();
  root.add(detail);
  const geometries = new Set(),
    materials = new Set(),
    dummy = new THREE.Object3D();
  const rooms = map.rooms ?? [];
  const corners = [];
  for (const room of rooms)
    for (const [dx, dz] of [
      [0, 0],
      [6, 0],
      [0, 6],
      [6, 6],
    ])
      corners.push({ x: (room.originX + dx) * CELL_SIZE, z: (room.originZ + dz) * CELL_SIZE });
  function material(options) {
    const value = new THREE.MeshStandardMaterial(options);
    materials.add(value);
    return value;
  }
  function batch(geometry, mat, count, optional = false) {
    geometries.add(geometry);
    const mesh = new THREE.InstancedMesh(geometry, mat, count);
    mesh.receiveShadow = true;
    (optional ? detail : root).add(mesh);
    return mesh;
  }
  function put(mesh, index, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
    dummy.position.set(x, y, z);
    dummy.scale.set(sx, sy, sz);
    dummy.rotation.set(rx, ry, rz);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  }
  if (corners.length) {
    const stone = material({ color: biome.cap, roughness: 0.9 });
    const accent = material({ color: biome.accent, roughness: 0.7, metalness: 0.15 });
    if (biome.id === 'fortress') {
      const columns = batch(new THREE.BoxGeometry(0.52, 1.7, 0.52), stone, corners.length);
      columns.castShadow = true;
      const crowns = batch(new THREE.BoxGeometry(0.72, 0.16, 0.72), accent, corners.length, true);
      const merlons = batch(
        new THREE.BoxGeometry(0.17, 0.22, 0.62),
        stone,
        corners.length * 2,
        true,
      );
      corners.forEach((point, i) => {
        put(columns, i, point.x, 0.85, point.z);
        put(crowns, i, point.x, 1.74, point.z);
        put(merlons, i * 2, point.x - 0.23, 1.91, point.z);
        put(merlons, i * 2 + 1, point.x + 0.23, 1.91, point.z);
      });
    } else if (biome.id === 'flooded') {
      const columns = batch(new THREE.CylinderGeometry(0.2, 0.34, 1.65, 7), stone, corners.length);
      columns.castShadow = true;
      const moss = batch(new THREE.SphereGeometry(0.22, 7, 4), accent, corners.length * 2, true);
      corners.forEach((point, i) => {
        put(columns, i, point.x, 0.825, point.z, 1, 1, 1, 0, i * 0.7, i % 2 ? 0.09 : -0.09);
        put(moss, i * 2, point.x - 0.16, 1.55, point.z, 1.4, 0.25, 1.3);
        put(moss, i * 2 + 1, point.x + 0.14, 1.59, point.z + 0.14, 1, 0.3, 1.2);
      });
      const pools = [];
      for (let z = 1; z < map.height - 1; z++)
        for (let x = 1; x < map.width - 1; x++)
          if (map.walkable[z * map.width + x] && (x * 17 + z * 13) % 4 === 0)
            pools.push({ x: x * CELL_SIZE, z: z * CELL_SIZE });
      const water = material({
        color: biome.water,
        roughness: 0.22,
        metalness: 0.18,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      });
      const puddles = batch(new THREE.CircleGeometry(0.61, 10), water, pools.length, true);
      pools.forEach((point, i) =>
        put(puddles, i, point.x, 0.014, point.z, 1, 0.7, 1, -Math.PI / 2, 0, i * 0.7),
      );
    } else {
      const spires = batch(new THREE.ConeGeometry(0.35, 1.95, 4), stone, corners.length);
      spires.castShadow = true;
      corners.forEach((point, i) =>
        put(spires, i, point.x, 0.975, point.z, 1, 1, 1, 0, Math.PI / 4),
      );
      const ember = material({
        color: biome.accent,
        emissive: 0x9b3a13,
        emissiveIntensity: 0.65,
        roughness: 1,
      });
      const seams = batch(new THREE.PlaneGeometry(0.54, 0.027), ember, corners.length * 2, true);
      corners.forEach((point, i) => {
        put(seams, i * 2, point.x, 1.52, point.z, 1, 1, 1, -Math.PI / 2, 0, 0.3);
        put(
          seams,
          i * 2 + 1,
          point.x + 0.1,
          1.525,
          point.z - 0.1,
          0.6,
          1,
          1,
          -Math.PI / 2,
          0,
          -0.8,
        );
      });
    }
    const seal = batch(
      new THREE.RingGeometry(0.32, 0.49, biome.id === 'ash' ? 3 : biome.id === 'flooded' ? 12 : 8),
      accent,
      rooms.length,
      true,
    );
    rooms.forEach((room, i) =>
      put(
        seal,
        i,
        (room.originX + 3) * CELL_SIZE,
        0.009,
        (room.originZ + 3) * CELL_SIZE,
        1,
        1,
        1,
        -Math.PI / 2,
      ),
    );
  }
  let disposed = false;
  return {
    root,
    setQuality(visible) {
      detail.visible = visible;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      root.traverse((object) => {
        if (object.isInstancedMesh) object.dispose();
      });
      for (const geometry of geometries) geometry.dispose();
      for (const mat of materials) mat.dispose();
    },
  };
}
