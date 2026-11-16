// CPU checks against the real Three.js geometry; no renderer or GPU is exercised.
import * as THREE from 'three';
import { test, assert, runTests } from './harness.js';
import { generateFloor } from '../generator.js';
import { parseMap } from '../map.js';
import { getBiome } from '../biomes.js';
import { createLevelArt } from '../level-art.js';
import { createLevelArchitecture } from '../level-architecture.js';
import { createMapView } from '../map-view.js';
import { createPlayer } from '../entities.js';
import { createEnemyView } from '../enemy-view.js';
import { createEnemy } from '../enemy.js';
import { MONSTER_TYPES } from '../monster-types.js';
import { hasLineOfSight } from '../navigation.js';

test('Кладка видима перед непрозрачной основой стены', () => {
  const map = parseMap(['#####', '#P..#', '#...#', '#...#', '#####']);
  const view = createLevelArchitecture(map, getBiome('fortress'), createLevelArt(map));
  try {
    view.root.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(
      new THREE.Vector3(2.65, 0.38, 1.5),
      new THREE.Vector3(0, 0, -1),
    );
    assert(ray.intersectObject(view.root, true)[0].object.name === 'dressed-stone-courses');
  } finally {
    view.dispose();
  }
});
test('Порталы: каменные опоры видны перед основой стены', () => {
  for (let seed = 0; seed < 20; seed++) {
    const map = generateFloor({ seed }),
      art = createLevelArt(map);
    const view = createLevelArchitecture(map, getBiome(map.biome), art);
    try {
      view.root.updateMatrixWorld(true);
      for (const p of art.portals) {
        const ray = new THREE.Raycaster(
          new THREE.Vector3(p.x * 1.5, 0.85, p.z * 1.5),
          new THREE.Vector3(p.tx, 0, p.tz),
        );
        const hits = ray.intersectObjects(
          ['wall-cores', 'dressed-stone-courses', 'portal-piers'].map((name) =>
            view.root.getObjectByName(name),
          ),
        );
        assert(hits[0]?.object.name === 'portal-piers');
      }
    } finally {
      view.dispose();
    }
  }
});
test('Напольные поля лежат над плитами, а не скрыты под ними', () => {
  const map = generateFloor({ seed: 29 }),
    art = createLevelArt(map);
  const view = createLevelArchitecture(map, getBiome(map.biome), art);
  try {
    view.root.updateMatrixWorld(true);
    const room = art.rooms[0];
    const ray = new THREE.Raycaster(
      new THREE.Vector3(room.x * 1.5 + 0.2, 3, room.z * 1.5 + 0.2),
      new THREE.Vector3(0, -1, 0),
    );
    const hits = ray.intersectObjects(
      ['room-floor-fields', 'split-flagstones', 'walkable-foundation'].map((name) =>
        view.root.getObjectByName(name),
      ),
    );
    assert(hits[0]?.object.name === 'room-floor-fields');
  } finally {
    view.dispose();
  }
});
test('Три биома: конечная геометрия, качество и точное освобождение ресурсов', () => {
  for (const floor of [1, 4, 7]) {
    const view = createMapView(generateFloor({ seed: 29, floor }));
    const geometries = new Set(),
      materials = new Set();
    let disposed = 0;
    view.root.traverse((object) => {
      if (object.geometry) {
        geometries.add(object.geometry);
        assert([...object.geometry.attributes.position.array].every(Number.isFinite));
      }
      if (object.material) materials.add(object.material);
      if (object.isInstancedMesh) assert([...object.instanceMatrix.array].every(Number.isFinite));
    });
    for (const resource of [...geometries, ...materials])
      resource.addEventListener('dispose', () => disposed++);
    for (const quality of [false, true, false, true]) view.setQuality(quality);
    view.update(2, false);
    view.dispose();
    assert(disposed === geometries.size + materials.size);
  }
});
test('Фонарь: сильный направленный свет и слабый ореол без дополнительных ламп', () => {
  const player = createPlayer();
  try {
    assert(player.light.intensity >= 136 && player.light.castShadow);
    const lights = [];
    player.root.traverse((node) => {
      if (node.isLight) lights.push(node);
    });
    assert(lights.length === 2 && lights.find((node) => node.isPointLight).intensity <= 1.2);
  } finally {
    player.dispose();
  }
});
test('Шесть монстров: модели, динамический красный сектор и освобождение огней', () => {
  const map = generateFloor({ seed: 29, floor: 12 });
  for (const type of Object.keys(MONSTER_TYPES)) {
    const enemy = createEnemy({ ...map.enemies[0], type }, map),
      view = createEnemyView(type, map);
    const resources = new Set();
    let disposed = 0;
    view.root.traverse((node) => {
      if (node.geometry) resources.add(node.geometry);
      if (node.material) resources.add(node.material);
      if (node.isLight) resources.add(node);
    });
    for (const resource of resources) resource.addEventListener('dispose', () => disposed++);
    for (const phase of ['patrol', 'chase', 'frozen', 'repelled', 'windup', 'dash']) {
      view.update({ ...enemy, phase, signal: 0.6 }, 2);
      view.root.updateMatrixWorld(true);
      view.root.traverse((node) => {
        assert(node.matrixWorld.elements.every(Number.isFinite));
        if (node.geometry)
          assert([...node.geometry.attributes.position.array].every(Number.isFinite));
      });
    }
    if (type === 'warden') assert(view.root.getObjectByName('warden-vision-sector'));
    view.dispose();
    view.dispose();
    assert(disposed === resources.size);
  }
});
test('Красный сектор не рисуется за стенами между соседними лучами', () => {
  for (let seed = 0; seed < 20; seed++) {
    const map = generateFloor({ seed, floor: 12 });
    const enemy = createEnemy({ ...map.enemies[0], type: 'warden' }, map),
      view = createEnemyView('warden', map);
    try {
      for (let direction = 0; direction < 8; direction++) {
        enemy.aim.x = Math.sin((direction * Math.PI) / 4);
        enemy.aim.z = Math.cos((direction * Math.PI) / 4);
        view.update(enemy, 0);
        const p =
          view.root.getObjectByName('warden-vision-sector').geometry.attributes.position.array;
        for (let i = 0; i < p.length; i += 9)
          for (const t of [0.25, 0.5, 0.75]) {
            const target = {
              x: enemy.position.x + (p[i + 3] * (1 - t) + p[i + 6] * t) * 0.95,
              z: enemy.position.z + (p[i + 5] * (1 - t) + p[i + 8] * t) * 0.95,
            };
            assert(hasLineOfSight(enemy.position, target, map));
          }
      }
    } finally {
      view.dispose();
    }
  }
});
await runTests();
