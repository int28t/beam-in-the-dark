import * as THREE from 'three';
import { CELL_SIZE } from './map.js';

export function createMapView(map) {
  const root = new THREE.Group();
  const geometries = [];
  const materials = [];
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  function instances(geometry, material, count) {
    geometries.push(geometry); materials.push(material);
    const result = new THREE.InstancedMesh(geometry, material, count);
    result.receiveShadow = true;
    root.add(result);
    return result;
  }
  const floor = instances(new THREE.BoxGeometry(CELL_SIZE - 0.035, 0.12, CELL_SIZE - 0.035),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96 }), map.width * map.height);
  let index = 0;
  for (let z = 0; z < map.height; z++) for (let x = 0; x < map.width; x++) {
    matrix.makeTranslation(x * CELL_SIZE, -0.06, z * CELL_SIZE);
    floor.setMatrixAt(index, matrix);
    const shade = 0.19 + ((x * 17 + z * 31) % 7) * 0.009;
    color.setRGB(shade * 0.82, shade, shade * 1.05);
    floor.setColorAt(index++, color);
  }
  const walls = instances(new THREE.BoxGeometry(CELL_SIZE, 1.42, CELL_SIZE),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 }), map.walls.length);
  const caps = instances(new THREE.BoxGeometry(CELL_SIZE + 0.045, 0.12, CELL_SIZE + 0.045),
    new THREE.MeshStandardMaterial({ color: 0x506166, roughness: 0.87 }), map.walls.length);
  walls.castShadow = true;
  for (let i = 0; i < map.walls.length; i++) {
    const wall = map.walls[i];
    const x = (wall.minX + wall.maxX) / 2;
    const z = (wall.minZ + wall.maxZ) / 2;
    matrix.makeTranslation(x, 0.71, z);
    walls.setMatrixAt(i, matrix);
    const shade = 0.13 + (i % 5) * 0.008;
    color.setRGB(shade * 0.87, shade, shade * 1.08);
    walls.setColorAt(i, color);
    matrix.makeTranslation(x, 1.45, z);
    caps.setMatrixAt(i, matrix);
  }
  return {
    root,
    dispose() {
      root.removeFromParent();
      root.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
      geometries.forEach(value => value.dispose());
      materials.forEach(value => value.dispose());
    },
  };
}
