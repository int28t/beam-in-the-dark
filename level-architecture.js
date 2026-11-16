import * as THREE from 'three';
import { CELL_SIZE as CELL } from './map.js';

// One bevelled block is reused for slabs, masonry and architectural mouldings.
function stoneBlock() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.475, -0.475);
  shape.lineTo(0.475, -0.475);
  shape.lineTo(0.475, 0.475);
  shape.lineTo(-0.475, 0.475);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.95,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: 0.025,
    bevelThickness: 0.025,
    curveSegments: 1,
  });
  geometry.translate(0, 0, -0.475);
  return geometry;
}
export function createLevelArchitecture(map, biome, art) {
  const root = new THREE.Group(),
    detail = new THREE.Group();
  root.add(detail);
  root.name = 'level-architecture';
  detail.name = 'fine-masonry';
  const geometries = new Set(),
    materials = new Set(),
    meshes = [];
  const dummy = new THREE.Object3D(),
    color = new THREE.Color();
  const block = stoneBlock();
  geometries.add(block);
  function mat(options) {
    const value = new THREE.MeshStandardMaterial(options);
    materials.add(value);
    return value;
  }
  const floorMat = mat({ color: 0xffffff, roughness: biome.id === 'flooded' ? 0.64 : 0.94 });
  const coreMat = mat({ color: new THREE.Color(biome.wall).multiplyScalar(0.43), roughness: 1 });
  const stoneMat = mat({ color: 0xffffff, roughness: 0.94 });
  const trimMat = mat({ color: biome.cap, roughness: 0.85 });
  const ironMat = mat({ color: 0x242a2b, roughness: 0.7, metalness: 0.55 });
  const inlayMat = mat({ color: biome.accent, roughness: 0.75, metalness: 0.2 });
  function batch(name, material, count, optional = false, geometry = block) {
    geometries.add(geometry);
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.name = name;
    mesh.receiveShadow = true;
    (optional ? detail : root).add(mesh);
    meshes.push(mesh);
    return mesh;
  }
  function put(mesh, i, x, y, z, sx, sy, sz, ry = 0, shade) {
    dummy.position.set(x, y, z);
    dummy.scale.set(sx, sy, sz);
    dummy.rotation.set(0, ry, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    if (shade !== undefined) {
      color
        .setHex(mesh === tiles || mesh === slabs ? biome.floor : biome.wall)
        .multiplyScalar(shade);
      mesh.setColorAt(i, color);
    }
  }
  const slabs = batch('walkable-foundation', floorMat, art.floors.length);
  const tiles = batch('split-flagstones', floorMat, art.floors.length * 2, true);
  art.floors.forEach((p, i) => {
    const x = p.x * CELL,
      z = p.z * CELL,
      shade = 0.88 + ((p.x * 13 + p.z * 7) % 9) * 0.025;
    put(slabs, i, x, -0.13, z, CELL - 0.012, 0.26, CELL - 0.012, 0, shade * 0.85);
    for (let t = 0; t < 2; t++)
      put(
        tiles,
        i * 2 + t,
        x + (t ? 0.372 : -0.372),
        -0.0285,
        z,
        0.724,
        0.065,
        CELL - 0.04,
        0,
        shade + (t ? 0.035 : 0),
      );
  });
  const cores = batch('wall-cores', coreMat, art.walls.length);
  cores.castShadow = true;
  const caps = batch('wall-cornices', trimMat, art.walls.length);
  const bases = batch('wall-plinths', trimMat, art.walls.length);
  const wallFaces = new Map();
  for (const face of art.surfaces) {
    const key = face.z * map.width + face.x;
    if (!wallFaces.has(key)) wallFaces.set(key, []);
    wallFaces.get(key).push(face);
  }
  art.walls.forEach((p, i) => {
    let minX = -CELL / 2,
      maxX = CELL / 2,
      minZ = -CELL / 2,
      maxZ = CELL / 2;
    for (const face of wallFaces.get(p.z * map.width + p.x)) {
      if (face.nx === -1) minX += 0.1;
      if (face.nx === 1) maxX -= 0.1;
      if (face.nz === -1) minZ += 0.1;
      if (face.nz === 1) maxZ -= 0.1;
    }
    put(
      cores,
      i,
      p.x * CELL + (minX + maxX) / 2,
      0.71,
      p.z * CELL + (minZ + maxZ) / 2,
      maxX - minX,
      1.42,
      maxZ - minZ,
    );
    put(caps, i, p.x * CELL, 1.47, p.z * CELL, CELL + 0.025, 0.16, CELL + 0.025);
    put(bases, i, p.x * CELL, 0.1, p.z * CELL, CELL, 0.2, CELL);
  });
  const bricks = batch('dressed-stone-courses', stoneMat, art.surfaces.length * 7, true);
  bricks.castShadow = true;
  bases.castShadow = caps.castShadow = true;
  const portalCells = new Set(art.portals.map((p) => p.z * map.width + p.x));
  const borders = batch('floor-edge-borders', inlayMat, art.surfaces.length);
  let brickIndex = 0;
  art.surfaces.forEach((face, i) => {
    const tx = -face.nz,
      tz = face.nx,
      angle = Math.atan2(face.nx, face.nz);
    const x = face.x * CELL + face.nx * (CELL / 2 - 0.075),
      z = face.z * CELL + face.nz * (CELL / 2 - 0.075);
    // Jambs replace masonry on the door-facing wall. Their backing is recessed.
    const jamb = portalCells.has((face.z + face.nz) * map.width + face.x + face.nx);
    for (let row = 0; !jamb && row < 3; row++) {
      const offsets = row === 1 ? [-0.5625, 0, 0.5625] : [-0.375, 0.375];
      for (const along of offsets) {
        const width = row === 1 && along !== 0 ? 0.34 : 0.715;
        put(
          bricks,
          brickIndex++,
          x + tx * along,
          0.38 + row * 0.405,
          z + tz * along,
          width,
          0.38,
          0.15,
          angle,
          0.82 + ((i * 7 + row * 3 + Math.round((along + 1) * 8)) % 8) * 0.035,
        );
      }
    }
    put(
      borders,
      i,
      face.x * CELL + face.nx * (CELL / 2 + 0.1),
      0.017,
      face.z * CELL + face.nz * (CELL / 2 + 0.1),
      CELL - 0.06,
      0.026,
      0.065,
      angle,
    );
  });
  bricks.count = brickIndex;
  // Door piers sit entirely inside existing wall cells. Broken crown keeps the opening readable from above.
  const piers = batch('portal-piers', trimMat, art.portals.length * 2);
  const crowns = batch('portal-crown-stones', trimMat, art.portals.length * 4);
  const thresholds = batch('door-thresholds', ironMat, art.portals.length);
  art.portals.forEach((p, i) => {
    const angle = Math.atan2(p.nx, p.nz),
      x = p.x * CELL,
      z = p.z * CELL;
    for (const side of [-1, 1]) {
      const id = i * 2 + (side === 1 ? 1 : 0),
        along = side * (CELL / 2 + 0.14);
      put(piers, id, x + p.tx * along, 0.76, z + p.tz * along, 0.26, 1.52, 0.56, angle);
      for (let k = 0; k < 2; k++)
        put(
          crowns,
          id * 2 + k,
          x + p.tx * (along - side * k * 0.13),
          1.56 + k * 0.12,
          z + p.tz * (along - side * k * 0.13),
          0.27,
          0.15,
          0.54,
          angle,
        );
    }
    put(thresholds, i, x, 0.022, z, CELL - 0.05, 0.035, 0.25, angle);
  });
  // Room-sized floor designs replace isolated identical centre rings.
  const panels = batch(
    'room-floor-fields',
    mat({
      color: biome.id === 'fortress' ? 0x382b36 : biome.id === 'ash' ? 0x302628 : 0x263f3d,
      roughness: 0.98,
    }),
    art.rooms.length,
  );
  const lines = batch('room-inlay', inlayMat, art.rooms.length * 4);
  const medallions = batch(
    'room-medallions',
    inlayMat,
    art.rooms.length,
    false,
    new THREE.RingGeometry(0.94, 1.02, biome.id === 'ash' ? 6 : 16),
  );
  const centreDummy = new THREE.Object3D();
  art.rooms.forEach((room, i) => {
    const x = room.x * CELL,
      z = room.z * CELL,
      runner = room.motif === 'runner',
      ritual = room.motif === 'ritual';
    // Central cross is walkable in every room template; designs stay within it.
    put(panels, i, x, 0.008, z, runner ? 1.12 : 2.4, 0.012, runner ? 6.8 : 1.12);
    const half = runner ? 0.49 : 1.08,
      length = runner ? 6.4 : 2.16;
    for (let side = 0; side < 2; side++)
      put(
        lines,
        i * 4 + side,
        x + (side ? half : -half),
        0.019,
        z,
        0.025,
        0.012,
        runner ? length : 0.94,
      );
    for (let side = 0; side < 2; side++)
      put(
        lines,
        i * 4 + 2 + side,
        x,
        0.019,
        z + (side ? (runner ? 3.2 : 0.47) : -(runner ? 3.2 : 0.47)),
        runner ? 0.98 : length,
        0.012,
        0.025,
      );
    centreDummy.position.set(x, 0.028, z);
    centreDummy.scale.setScalar(ritual ? 1.1 : room.motif === 'well' ? 0.83 : 0.65);
    centreDummy.rotation.set(-Math.PI / 2, 0, ((room.variant % 4) * Math.PI) / 4);
    centreDummy.updateMatrix();
    medallions.setMatrixAt(i, centreDummy.matrix);
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
      for (const mesh of meshes) mesh.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}
