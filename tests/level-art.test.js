import { test, assert } from './harness.js?v=0.13.0';
import { parseMap, CELL_SIZE } from '../map.js?v=0.13.0';
import { generateFloor } from '../generator.js?v=0.13.0';
import { createLevelArt } from '../level-art.js?v=0.13.0';
test('Оформление уровней: полы и грани точно следуют проходимой сетке', () => {
  const map = parseMap(['#####', '#P..#', '#.#.#', '#...#', '#####']);
  const art = createLevelArt(map);
  assert(art.floors.length === 8);
  for (const face of art.surfaces) {
    assert(!map.walkable[face.z * map.width + face.x]);
    assert(map.walkable[(face.z + face.nz) * map.width + face.x + face.nx]);
  }
  assert(art.surfaces.length === 16 && art.portals.length === 0);
});
test('Оформление уровней: детерминированно, не мутирует карту, опоры проёмов внутри стен', () => {
  for (let seed = 0; seed < 100; seed++) {
    const map = generateFloor({ seed, floor: 1 + (seed % 9) });
    const before = JSON.stringify(map),
      art = createLevelArt(map);
    assert(JSON.stringify(map) === before);
    assert(JSON.stringify(art) === JSON.stringify(createLevelArt(map)));
    assert(art.portals.length >= 2 * (map.rooms.length - 1));
    for (const portal of art.portals) {
      assert(map.walkable[portal.z * map.width + portal.x]);
      for (const side of [-1, 1]) {
        const x = portal.x + portal.tx * side,
          z = portal.z + portal.tz * side;
        assert(!map.walkable[z * map.width + x]);
      }
    }
    assert(art.rooms.every((room) => room.motif && room.x * CELL_SIZE >= 0));
  }
});
test('Оформление уровней: fallback без комнат и закрытые порты не дают ложных дверей', () => {
  const map = generateFloor({ seed: 14, roomTemplates: [] });
  assert(createLevelArt(map).portals.length === 0);
  const closed = parseMap(['#####', '#P..#', '#...#', '#####']);
  closed.rooms = [{ originX: 0, originZ: 0, template: 'Зал' }];
  assert(createLevelArt(closed).portals.length === 0);
});
