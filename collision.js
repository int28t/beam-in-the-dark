// Axis-separated circle movement, subdivided so thin walls cannot be skipped.
// Mutates position; no temporary objects are created in the frame loop.
const CONTACT_EPSILON = 1e-9;

export function moveCircle(position, displacement, radius, walls) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(displacement.x), Math.abs(displacement.z)) / (radius * 0.5)));
  const dx = displacement.x / steps;
  const dz = displacement.z / steps;
  for (let step = 0; step < steps; step++) {
    let nextX = position.x + dx;
    for (const wall of walls) {
      const distanceZ = Math.max(wall.minZ - position.z, 0, position.z - wall.maxZ);
      if (distanceZ >= radius) continue;
      const reach = Math.sqrt(radius * radius - distanceZ * distanceZ);
      if (dx > 0 && position.x <= wall.minX - reach + CONTACT_EPSILON && nextX > wall.minX - reach) nextX = wall.minX - reach;
      if (dx < 0 && position.x >= wall.maxX + reach - CONTACT_EPSILON && nextX < wall.maxX + reach) nextX = wall.maxX + reach;
    }
    position.x = nextX;
    let nextZ = position.z + dz;
    for (const wall of walls) {
      const distanceX = Math.max(wall.minX - position.x, 0, position.x - wall.maxX);
      if (distanceX >= radius) continue;
      const reach = Math.sqrt(radius * radius - distanceX * distanceX);
      if (dz > 0 && position.z <= wall.minZ - reach + CONTACT_EPSILON && nextZ > wall.minZ - reach) nextZ = wall.minZ - reach;
      if (dz < 0 && position.z >= wall.maxZ + reach - CONTACT_EPSILON && nextZ < wall.maxZ + reach) nextZ = wall.maxZ + reach;
    }
    position.z = nextZ;
  }
  return position;
}
