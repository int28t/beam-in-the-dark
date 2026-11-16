import * as THREE from 'three';
import { CELL_SIZE } from './map.js';
import { getBiome } from './biomes.js';
import { createBiomeDecor } from './biome-view.js';

export function createMapView(map) {
  const biome = getBiome(map.biome);
  const root = new THREE.Group();
  const geometries = [];
  const materials = [];
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  function instances(geometry, material, count) {
    geometries.push(geometry);
    materials.push(material);
    const result = new THREE.InstancedMesh(geometry, material, count);
    result.receiveShadow = true;
    root.add(result);
    return result;
  }
  const floor = instances(
    new THREE.BoxGeometry(CELL_SIZE - 0.035, 0.12, CELL_SIZE - 0.035),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: biome.id === 'flooded' ? 0.58 : 0.96,
    }),
    map.width * map.height,
  );
  let index = 0;
  for (let z = 0; z < map.height; z++)
    for (let x = 0; x < map.width; x++) {
      matrix.makeTranslation(x * CELL_SIZE, -0.06, z * CELL_SIZE);
      floor.setMatrixAt(index, matrix);
      const shade = 0.88 + ((x * 17 + z * 31) % 7) * 0.025;
      color.setHex(biome.floor).multiplyScalar(shade);
      floor.setColorAt(index++, color);
    }
  const walls = instances(
    new THREE.BoxGeometry(CELL_SIZE, 1.42, CELL_SIZE),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 }),
    map.walls.length,
  );
  const caps = instances(
    new THREE.BoxGeometry(CELL_SIZE + 0.045, 0.12, CELL_SIZE + 0.045),
    new THREE.MeshStandardMaterial({ color: biome.cap, roughness: 0.87 }),
    map.walls.length,
  );
  walls.castShadow = true;
  for (let i = 0; i < map.walls.length; i++) {
    const wall = map.walls[i];
    const x = (wall.minX + wall.maxX) / 2;
    const z = (wall.minZ + wall.maxZ) / 2;
    matrix.makeTranslation(x, 0.71, z);
    walls.setMatrixAt(i, matrix);
    const shade = 0.9 + (i % 5) * 0.03;
    color.setHex(biome.wall).multiplyScalar(shade);
    walls.setColorAt(i, color);
    matrix.makeTranslation(x, 1.45, z);
    caps.setMatrixAt(i, matrix);
  }
  const itemMaterial = new THREE.MeshStandardMaterial({
    color: 0xe9be62,
    metalness: 0.7,
    roughness: 0.3,
    emissive: 0x9f5d13,
    emissiveIntensity: 0.5,
  });
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x748b89,
    metalness: 0.25,
    roughness: 0.65,
  });
  const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x204b4e, roughness: 0.8 });
  const exitMaterial = new THREE.MeshStandardMaterial({
    color: 0x68c6bd,
    emissive: 0x4bb8ae,
    emissiveIntensity: 1.5,
  });
  materials.push(itemMaterial, frameMaterial, doorMaterial, exitMaterial);
  function mesh(geometry, material, parent, x, y, z) {
    geometries.push(geometry);
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = true;
    parent.add(object);
    return object;
  }
  const key = new THREE.Group();
  key.position.set(map.spawns.key.x, 0.75, map.spawns.key.z);
  root.add(key);
  mesh(new THREE.TorusGeometry(0.15, 0.045, 6, 12), itemMaterial, key, 0, 0.14, 0);
  mesh(new THREE.BoxGeometry(0.065, 0.36, 0.065), itemMaterial, key, 0, -0.1, 0);
  mesh(new THREE.BoxGeometry(0.13, 0.055, 0.065), itemMaterial, key, 0.05, -0.21, 0);
  const keyLight = new THREE.PointLight(0xffce76, 4, 4, 2);
  keyLight.position.y = 0.5;
  key.add(keyLight);
  // The exit is set back from its cell centre so the trigger is reached before the door.
  const exit = new THREE.Group();
  exit.position.set(map.spawns.exit.x, 0, map.spawns.exit.z + 0.35);
  root.add(exit);
  mesh(new THREE.BoxGeometry(0.16, 1.7, 0.25), frameMaterial, exit, -0.58, 0.85, 0);
  mesh(new THREE.BoxGeometry(0.16, 1.7, 0.25), frameMaterial, exit, 0.58, 0.85, 0);
  mesh(new THREE.BoxGeometry(1.32, 0.18, 0.25), frameMaterial, exit, 0, 1.7, 0);
  const door = mesh(new THREE.BoxGeometry(0.98, 1.55, 0.14), doorMaterial, exit, 0, 0.775, 0);
  mesh(new THREE.BoxGeometry(0.065, 0.7, 0.04), exitMaterial, door, 0, 0.1, -0.08);
  mesh(new THREE.BoxGeometry(0.35, 0.065, 0.04), exitMaterial, door, 0, 0.1, -0.08);
  mesh(new THREE.BoxGeometry(0.92, 0.025, 0.7), exitMaterial, exit, 0, 0.02, -0.3);
  const exitLight = new THREE.PointLight(0x5fc6bd, 5, 5, 2);
  exitLight.position.set(0, 1.4, -0.4);
  exit.add(exitLight);
  const biomeDecor = createBiomeDecor(map, biome);
  root.add(biomeDecor.root);
  const batteryViews = (map.batteries ?? []).map((battery) => {
    const group = new THREE.Group();
    group.position.set(battery.x, 0.4, battery.z);
    root.add(group);
    mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.32, 8), frameMaterial, group, 0, 0, 0);
    mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.07, 8), exitMaterial, group, 0, 0.08, 0);
    return { group, id: battery.id };
  });
  const emptyCollected = new Set();
  return {
    root,
    setQuality(visible) {
      biomeDecor.setQuality(visible);
    },
    update(time, hasKey, collected = emptyCollected) {
      for (const battery of batteryViews) battery.group.visible = !collected.has(battery.id);
      key.visible = !hasKey;
      key.position.y = 0.75 + Math.sin(time * 2.3) * 0.08;
      key.rotation.y = time * 0.8;
      door.visible = !hasKey;
      exitLight.intensity = hasKey ? 8 : 5;
    },
    dispose() {
      biomeDecor.dispose();
      root.removeFromParent();
      root.traverse((object) => {
        if (object.isInstancedMesh || object.isLight) object.dispose();
      });
      geometries.forEach((value) => value.dispose());
      materials.forEach((value) => value.dispose());
    },
  };
}
