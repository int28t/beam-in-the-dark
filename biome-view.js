import * as THREE from 'three';
import { CELL_SIZE } from './map.js';
import { createLevelArt } from './level-art.js';

export function createBiomeDecor(map, biome, art = createLevelArt(map)) {
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
  }
  // Wall-mounted furniture: visible identity, with no false floor obstacles.
  const faces = art.surfaces.filter(
    (face) => (face.x * 7 + face.z * 11 + face.nx * 2 + face.nz * 3 + 100) % 5 === 0,
  );
  const iron = material({ color: 0x222a2c, roughness: 0.75, metalness: 0.5 });
  const pale = material({ color: biome.accent, roughness: 0.85 });
  const dark = material({ color: biome.id === 'flooded' ? 0x142826 : 0x201c23, roughness: 1 });
  const frames = batch(new THREE.BoxGeometry(0.74, 0.92, 0.06), iron, faces.length);
  const recesses = batch(new THREE.BoxGeometry(0.61, 0.77, 0.035), dark, faces.length);
  const marks = batch(new THREE.BoxGeometry(0.045, 0.43, 0.02), pale, faces.length * 2);
  let banners, rods, plaques;
  if (biome.id === 'fortress') {
    const cloth = material({ color: 0x663748, roughness: 1, side: THREE.DoubleSide });
    const shape = new THREE.Shape();
    shape.moveTo(-0.26, 0.42);
    shape.lineTo(0.26, 0.42);
    shape.lineTo(0.26, -0.28);
    shape.lineTo(0.12, -0.22);
    shape.lineTo(0.02, -0.44);
    shape.lineTo(-0.1, -0.29);
    shape.lineTo(-0.26, -0.35);
    shape.closePath();
    banners = batch(new THREE.ShapeGeometry(shape), cloth, faces.length);
    rods = batch(new THREE.BoxGeometry(0.68, 0.045, 0.045), pale, faces.length);
    plaques = batch(new THREE.RingGeometry(0.09, 0.13, 4), pale, faces.length);
  } else if (biome.id === 'flooded') {
    plaques = batch(new THREE.CircleGeometry(0.16, 7), pale, faces.length);
  } else {
    plaques = batch(
      new THREE.RingGeometry(0.15, 0.18, 3),
      material({ color: 0xc48b54, emissive: 0x65321b, emissiveIntensity: 0.35, roughness: 1 }),
      faces.length,
    );
  }
  faces.forEach((face, i) => {
    const angle = Math.atan2(face.nx, face.nz),
      tx = face.nz,
      tz = -face.nx;
    const x = face.x * CELL_SIZE + face.nx * (CELL_SIZE / 2),
      z = face.z * CELL_SIZE + face.nz * (CELL_SIZE / 2);
    put(frames, i, x + face.nx * 0.035, 0.89, z + face.nz * 0.035, 1, 1, 1, 0, angle);
    put(recesses, i, x + face.nx * 0.075, 0.89, z + face.nz * 0.075, 1, 1, 1, 0, angle);
    for (let side = 0; side < 2; side++) {
      const offset = side ? 0.19 : -0.19;
      put(
        marks,
        i * 2 + side,
        x + tx * offset + face.nx * 0.105,
        0.87,
        z + tz * offset + face.nz * 0.105,
        1,
        biome.id === 'flooded' ? 0.7 : 1,
        1,
        0,
        angle,
      );
    }
    put(
      plaques,
      i,
      x + face.nx * 0.12,
      biome.id === 'fortress' ? 0.96 : 0.97,
      z + face.nz * 0.12,
      1,
      1,
      1,
      0,
      angle,
    );
    if (banners) {
      put(banners, i, x + face.nx * 0.1, 0.94, z + face.nz * 0.1, 1, 1, 1, 0, angle);
      put(rods, i, x + face.nx * 0.12, 1.39, z + face.nz * 0.12, 1, 1, 1, 0, angle);
    }
  });
  // Room motifs occupy only the guaranteed walkable central cross.
  const inlay = material({
    color: biome.id === 'fortress' ? 0xa08968 : biome.accent,
    roughness: 0.8,
    metalness: 0.15,
  });
  const motifs = batch(new THREE.PlaneGeometry(1, 1), inlay, art.rooms.length * 4);
  const compassRooms = art.rooms.filter((room) => room.motif === 'compass');
  const needle = new THREE.Shape();
  needle.moveTo(0, 0);
  needle.lineTo(0.15, 0.62);
  needle.lineTo(0, 1.72);
  needle.lineTo(-0.15, 0.62);
  needle.closePath();
  const compass = batch(new THREE.ShapeGeometry(needle), inlay, compassRooms.length * 4);
  compassRooms.forEach((room, i) => {
    for (let arm = 0; arm < 4; arm++)
      put(
        compass,
        i * 4 + arm,
        room.x * CELL_SIZE,
        0.034,
        room.z * CELL_SIZE,
        1,
        1,
        1,
        -Math.PI / 2,
        0,
        (arm * Math.PI) / 2,
      );
  });

  art.rooms.forEach((room, i) => {
    const x = room.x * CELL_SIZE,
      z = room.z * CELL_SIZE;
    for (let part = 0; part < 4; part++) {
      const a = (part * Math.PI) / 2;
      if (room.motif === 'tomb') {
        put(
          motifs,
          i * 4 + part,
          x + Math.cos(a) * 1.35,
          0.032,
          z + Math.sin(a) * 1.35,
          part % 2 ? 0.45 : 0.78,
          part % 2 ? 0.78 : 0.45,
          1,
          -Math.PI / 2,
          0,
          0,
        );
      } else if (room.motif === 'tiles') {
        put(
          motifs,
          i * 4 + part,
          x + (part - 1.5) * 0.5,
          0.032,
          z,
          0.22,
          0.22,
          1,
          -Math.PI / 2,
          0,
          Math.PI / 4,
        );
      } else if (room.motif === 'ritual' || biome.id === 'ash') {
        put(
          motifs,
          i * 4 + part,
          x + Math.cos(a) * 0.67,
          0.032,
          z + Math.sin(a) * 0.67,
          0.64,
          0.026,
          1,
          -Math.PI / 2,
          0,
          a + Math.PI / 4,
        );
      } else {
        put(
          motifs,
          i * 4 + part,
          x + Math.cos(a) * 0.65,
          0.032,
          z + Math.sin(a) * 0.65,
          0.42,
          0.033,
          1,
          -Math.PI / 2,
          0,
          a,
        );
      }
    }
  });
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
