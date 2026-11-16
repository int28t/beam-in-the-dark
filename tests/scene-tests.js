// CPU checks against the real Three.js geometry; no renderer or GPU is exercised.
import * as THREE from 'three';
import { test, assert, runTests } from './harness.js';
import { generateFloor } from '../generator.js';
import { parseMap } from '../map.js';
import { getBiome } from '../biomes.js';
import { createLevelArt } from '../level-art.js';
import { createLevelArchitecture } from '../level-architecture.js';
import { createMapView } from '../map-view.js';

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
await runTests();
