import { ENEMY } from './config.js';
import { createEnemySenses } from './enemy-senses.js';
import { getMonsterType } from './monster-types.js';
import { findPath, cellIndex, hasLineOfSight } from './navigation.js';
import { moveCircle } from './collision.js';

export function createEnemy(spawn, map, options = {}) {
  const profile = getMonsterType(spawn.type);
  const config = { ...ENEMY, ...options, ...profile.tuning };
  const attack = profile.attack;
  const senses = createEnemySenses(profile.id, map, config);
  const flank = { x: 0, z: 0 };
  let repelTime = 0,
    roarCooldown = 0,
    signal = 0,
    roared = false,
    moving = false,
    biteCooldown = 0;
  const dashDirection = { x: 0, z: 0 };
  let attackTime = 0,
    cooldown = 0;
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
    lethal: profile.id !== 'parasite',
    get lightAffected() {
      return (
        illuminated &&
        profile.id !== 'listener' &&
        profile.id !== 'warden' &&
        profile.id !== 'parasite'
      );
    },
    get roared() {
      return roared;
    },
    get signal() {
      return signal;
    },
    get moving() {
      return moving;
    },
    tryBite(lightOn) {
      if (profile.id !== 'parasite' || !lightOn || biteCooldown > 1e-8) return 0;
      biteCooldown = 3;
      return 35;
    },
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
      attackTime = cooldown = repelTime = roarCooldown = signal = biteCooldown = 0;
      roared = moving = false;
      senses.reset();
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
      moving = roared = false;
      roarCooldown = Math.max(0, roarCooldown - dt);
      signal = Math.max(0, signal - dt * 1.5);
      biteCooldown = Math.max(0, biteCooldown - dt);
      const sensed = senses.update(dt, position, aim, world);
      const visible = sensed.detected,
        freshSignal = sensed.fresh;
      illuminated = sensed.illuminated;
      if (freshSignal) {
        lastKnown.x = world.player.x;
        lastKnown.z = world.player.z;
        search = config.searchSeconds;
      }
      if (profile.id === 'listener' && freshSignal && roarCooldown <= 0) {
        roared = true;
        signal = 1;
        roarCooldown = 2;
      }
      if (profile.id === 'shadow' && illuminated) {
        if (phase !== 'repelled') repelTime = 0.3;
        phase = 'repelled';
        repelTime -= dt;
        if (repelTime <= 0 && distance > 1e-6) {
          delta.x = ((position.x - world.player.x) / distance) * 0.55 * dt;
          delta.z = ((position.z - world.player.z) / distance) * 0.55 * dt;
          moveCircle(position, delta, config.radius, map.walls);
        }
        aim.x = (world.player.x - position.x) / Math.max(distance, 1e-6);
        aim.z = (world.player.z - position.z) / Math.max(distance, 1e-6);
        return;
      }
      if (phase === 'repelled') {
        phase = visible ? 'chase' : 'search';
        repath = 0;
      }
      if (profile.id === 'mimic' && sensed.observed) {
        phase = 'frozen';
        return;
      }
      if (profile.id === 'mimic' && phase === 'frozen') {
        phase = visible ? 'chase' : 'search';
        repath = 0;
      }
      if (profile.id === 'parasite' && !visible && phase !== 'patrol') {
        phase = 'patrol';
        repath = 0;
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
      if (profile.id === 'mimic' && phase === 'patrol') return;
      let target = phase === 'patrol' ? patrol[patrolIndex] : lastKnown;
      if (profile.id === 'shadow' && visible && distance > 2) {
        flank.x = lastKnown.x - world.aim.x * 1.3;
        flank.z = lastKnown.z - world.aim.z * 1.3;
        if (map.walkable[cellIndex(flank, map)] && hasLineOfSight(world.player, flank, map))
          target = flank;
      }
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
      const beforeX = position.x,
        beforeZ = position.z;
      moveCircle(position, delta, config.radius, map.walls);
      moving = Math.hypot(position.x - beforeX, position.z - beforeZ) > 1e-6;
      if (step >= length && pathIndex < path.length - 1) pathIndex++;
    },
  };
  return enemy;
}
