export const CELL_SIZE = 1.5;

export const FLOOR_TEMPLATE = [
  '###################',
  '#P....#...........#',
  '#.....#....#..K...#',
  '#.....#....#......#',
  '#....B.....#......#',
  '###.####.###..#####',
  '#.....#...........#',
  '#.....#.....E.....#',
  '#........###.###..#',
  '#####.####.....#..#',
  '#.......B......#..#',
  '#....#.........#..#',
  '#....#..####.###..#',
  '#D...#............#',
  '###################',
];

export function parseMap(rows) {
  if (
    !Array.isArray(rows) ||
    rows.length < 3 ||
    typeof rows[0] !== 'string' ||
    rows[0].length < 3
  ) {
    throw new Error('Карта должна содержать хотя бы 3×3 клетки');
  }
  const width = rows[0].length;
  const height = rows.length;
  const walls = [];
  const walkable = new Uint8Array(width * height);
  const spawns = {};
  const batteries = [],
    enemies = [];
  const symbols = { P: 'player', K: 'key', D: 'exit' };
  for (let z = 0; z < height; z++) {
    if (typeof rows[z] !== 'string' || rows[z].length !== width)
      throw new Error('Строки карты должны иметь одинаковую длину');
    for (let x = 0; x < width; x++) {
      const symbol = rows[z][x];
      if (!'#.PKDBE'.includes(symbol)) throw new Error(`Неизвестный символ: ${symbol}`);
      if ((x === 0 || z === 0 || x === width - 1 || z === height - 1) && symbol !== '#') {
        throw new Error('Граница карты должна быть закрыта стенами');
      }
      const worldX = x * CELL_SIZE;
      const worldZ = z * CELL_SIZE;
      if (symbol === '#') {
        walls.push({
          minX: worldX - CELL_SIZE / 2,
          maxX: worldX + CELL_SIZE / 2,
          minZ: worldZ - CELL_SIZE / 2,
          maxZ: worldZ + CELL_SIZE / 2,
        });
      } else {
        walkable[z * width + x] = 1;
        if (symbol === 'B') batteries.push({ id: batteries.length, x: worldX, z: worldZ });
        if (symbol === 'E') enemies.push({ x: worldX, z: worldZ });
        if (symbols[symbol]) {
          const name = symbols[symbol];
          if (spawns[name]) throw new Error(`Повторная точка: ${symbol}`);
          spawns[name] = { x: worldX, z: worldZ };
        }
      }
    }
  }
  if (!spawns.player) throw new Error('Не указан старт игрока');
  return { width, height, walls, walkable, spawns, batteries, enemies };
}
