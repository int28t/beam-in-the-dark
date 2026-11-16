import { ENEMY } from './config.js';
import { findPath, inCone, hasLineOfSight, cellIndex } from './navigation.js';
import { moveCircle } from './collision.js';

export function createEnemy(spawn, map, options = {}) {
  const config = { ...ENEMY, ...options };
  const position = { x: spawn.x, z: spawn.z },
    aim = { x: spawn.aimX ?? 0, z: spawn.aimZ ?? -1 };
  const lastKnown = { x: spawn.x, z: spawn.z },
    delta = { x: 0, z: 0 };
  const patrol = spawn.patrol?.length ? spawn.patrol : [{ x: spawn.x, z: spawn.z }];
  let phase = 'patrol',
    illuminated = false,
    search = 0,
    patrolIndex = 0,
    path = [],
    pathIndex = 0,
    repath = 0,
    targetCell = -1;
  const enemy = {
    position,
    aim,
    lastKnown,
    get phase() {
      return phase;
    },
    get illuminated() {
      return illuminated;
    },
    reset() {
      position.x = spawn.x;
      position.z = spawn.z;
      aim.x = spawn.aimX ?? 0;
      aim.z = spawn.aimZ ?? -1;
      phase = 'patrol';
      illuminated = false;
      search = 0;
      patrolIndex = 0;
      path = [];
      repath = 0;
      targetCell = -1;
    },
    update(dt, world) {
      const distance = Math.hypot(world.player.x - position.x, world.player.z - position.z);
      const visible =
        (inCone(position, aim, world.player, config.visionRange, config.visionCos) ||
          (world.moving && distance < config.hearingRange)) &&
        hasLineOfSight(position, world.player, map);
      illuminated =
        world.lightOn &&
        inCone(world.player, world.aim, position, config.lightRange, config.lightCos) &&
        hasLineOfSight(world.player, position, map);
      if (visible) {
        phase = 'chase';
        lastKnown.x = world.player.x;
        lastKnown.z = world.player.z;
        search = config.searchSeconds;
      } else if (phase === 'chase') {
        phase = 'search';
        repath = 0;
      }
      if (phase === 'search') {
        search -= dt;
        if (search <= 0) {
          phase = 'patrol';
          repath = 0;
        }
      }
      let target = phase === 'patrol' ? patrol[patrolIndex] : lastKnown;
      if (phase === 'patrol' && Math.hypot(target.x - position.x, target.z - position.z) < 0.15) {
        patrolIndex = (patrolIndex + 1) % patrol.length;
        target = patrol[patrolIndex];
      }
      repath -= dt;
      const nextCell = cellIndex(target, map);
      if (repath <= 0 || nextCell !== targetCell) {
        path = findPath(position, target, map);
        pathIndex = path.length > 1 ? 1 : 0;
        repath = config.repathSeconds;
        targetCell = nextCell;
      }
      if (!path.length) return;
      const waypoint = pathIndex >= path.length - 1 ? target : path[pathIndex];
      const dx = waypoint.x - position.x,
        dz = waypoint.z - position.z,
        length = Math.hypot(dx, dz);
      if (length < 0.03) {
        if (pathIndex < path.length - 1) pathIndex++;
        return;
      }
      const speed =
        (phase === 'patrol' ? config.patrolSpeed : config.chaseSpeed) *
        (illuminated ? config.slowFactor : 1);
      const step = Math.min(speed * dt, length);
      aim.x = dx / length;
      aim.z = dz / length;
      delta.x = aim.x * step;
      delta.z = aim.z * step;
      moveCircle(position, delta, config.radius, map.walls);
      if (step >= length && pathIndex < path.length - 1) pathIndex++;
    },
  };
  return enemy;
}
