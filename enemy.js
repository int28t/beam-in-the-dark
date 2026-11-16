import { ENEMY } from './config.js';
import { CELL_SIZE } from './map.js';
import { getMonsterType } from './monster-types.js';
import { findPath, inCone, hasLineOfSight, cellIndex } from './navigation.js';
import { moveCircle } from './collision.js';

export function createEnemy(spawn, map, options = {}) {
  const profile = getMonsterType(spawn.type);
  const config = { ...ENEMY, ...options, ...profile.tuning };
  const attack = profile.attack;
  const dashDirection = { x: 0, z: 0 };
  let attackTime = 0,
    cooldown = 0,
    hearingPoll = 0,
    heardHold = 0;
  function recover() {
    phase = 'recover';
    attackTime = attack.recoverSeconds;
    cooldown = attack.cooldownSeconds;
    repath = 0;
  }
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
    type: profile.id,
    contactRadius: profile.contactRadius,
    get isThreat() {
      return phase === 'chase' || phase === 'windup' || phase === 'dash';
    },
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
      lastKnown.x = spawn.x;
      lastKnown.z = spawn.z;
      attackTime = cooldown = hearingPoll = heardHold = 0;
      dashDirection.x = dashDirection.z = 0;
      pathIndex = 0;
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
      cooldown = Math.max(0, cooldown - dt);
      let visible = false,
        freshSignal = false;
      if (profile.id === 'listener') {
        hearingPoll -= dt;
        heardHold = Math.max(0, heardHold - dt);
        if (!world.moving) heardHold = 0;
        else if (hearingPoll <= 0) {
          hearingPoll = config.hearingInterval;
          const route =
            distance <= config.hearingRange ? findPath(position, world.player, map) : [];
          freshSignal = route.length > 0 && (route.length - 1) * CELL_SIZE <= config.hearingRange;
          heardHold = freshSignal ? config.hearingInterval : 0;
        }
        visible = world.moving && heardHold > 0;
      } else {
        visible =
          (inCone(position, aim, world.player, config.visionRange, config.visionCos) ||
            (world.moving && distance < config.hearingRange)) &&
          hasLineOfSight(position, world.player, map);
        freshSignal = visible;
      }
      illuminated =
        world.lightOn &&
        inCone(world.player, world.aim, position, config.lightRange, config.lightCos) &&
        hasLineOfSight(world.player, position, map);
      if (freshSignal) {
        lastKnown.x = world.player.x;
        lastKnown.z = world.player.z;
        search = config.searchSeconds;
      }
      if (phase === 'windup') {
        if (illuminated) recover();
        else {
          attackTime -= dt;
          if (attackTime <= 0) {
            phase = 'dash';
            attackTime = attack.dashSeconds;
          }
        }
        return;
      }
      if (phase === 'dash') {
        const step =
          attack.dashSpeed * Math.min(dt, attackTime) * (illuminated ? config.slowFactor : 1);
        delta.x = dashDirection.x * step;
        delta.z = dashDirection.z * step;
        const oldX = position.x,
          oldZ = position.z;
        moveCircle(position, delta, config.radius, map.walls);
        const blocked =
          Math.abs(position.x - oldX - delta.x) > 1e-6 ||
          Math.abs(position.z - oldZ - delta.z) > 1e-6;
        attackTime -= dt;
        if (blocked || attackTime <= 1e-8) recover();
        return;
      }
      if (phase === 'recover') {
        attackTime -= dt;
        if (attackTime > 0) return;
        phase = visible ? 'chase' : 'search';
        repath = 0;
      }
      if (visible) phase = 'chase';
      else if (phase === 'chase') {
        phase = 'search';
        repath = 0;
      }
      if (
        attack &&
        phase === 'chase' &&
        visible &&
        !illuminated &&
        cooldown <= 0 &&
        distance >= 1 &&
        distance <= attack.range
      ) {
        dashDirection.x = (world.player.x - position.x) / distance;
        dashDirection.z = (world.player.z - position.z) / distance;
        aim.x = dashDirection.x;
        aim.z = dashDirection.z;
        phase = 'windup';
        attackTime = attack.windupSeconds;
        return;
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
        profile.speedScale *
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
