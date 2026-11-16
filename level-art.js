// Architectural placement follows collision cells; it never changes gameplay geometry.
const DIRECTIONS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
const MOTIFS = {
  Зал: 'compass',
  Караульная: 'runner',
  Архив: 'tiles',
  Галерея: 'runner',
  Крипта: 'tomb',
  Склеп: 'tomb',
  Часовня: 'ritual',
  Колодец: 'well',
};
export function createLevelArt(map) {
  const floors = [],
    surfaces = [],
    walls = [],
    portals = [],
    rooms = [];
  const free = (x, z) =>
    x >= 0 && z >= 0 && x < map.width && z < map.height && !!map.walkable[z * map.width + x];
  for (let z = 0; z < map.height; z++)
    for (let x = 0; x < map.width; x++) {
      if (free(x, z)) {
        floors.push({ x, z });
        continue;
      }
      let exposed = false;
      for (const [nx, nz] of DIRECTIONS)
        if (free(x + nx, z + nz)) {
          exposed = true;
          surfaces.push({ x, z, nx, nz });
        }
      if (exposed) walls.push({ x, z });
    }
  for (const room of map.rooms ?? []) {
    const x = room.originX + 3,
      z = room.originZ + 3;
    if (!free(x, z)) continue;
    rooms.push({
      x,
      z,
      motif: room.id === 0 ? 'compass' : (MOTIFS[room.template] ?? 'compass'),
      variant: ((room.id ?? 0) + (map.seed ?? 0)) >>> 0,
    });
    for (const [nx, nz] of DIRECTIONS) {
      const px = x + nx * 3,
        pz = z + nz * 3,
        tx = -nz,
        tz = nx;
      if (
        free(px, pz) &&
        free(px + nx, pz + nz) &&
        !free(px + tx, pz + tz) &&
        !free(px - tx, pz - tz)
      )
        portals.push({ x: px, z: pz, nx, nz, tx, tz });
    }
  }
  return { floors, surfaces, walls, portals, rooms };
}
