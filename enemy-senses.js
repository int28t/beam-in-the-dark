import { findPath, inCone, hasLineOfSight } from './navigation.js';
import { CELL_SIZE } from './map.js';

// Persistent sensor state; targets are copied only on genuine new observations.
export function createEnemySenses(type, map, config) {
  let poll = 0,
    hold = 0;
  const result = { detected: false, fresh: false, illuminated: false, observed: false };
  return {
    reset() {
      poll = hold = 0;
    },
    update(dt, position, aim, world) {
      const distance = Math.hypot(world.player.x - position.x, world.player.z - position.z);
      const sight =
        distance <= Math.max(config.visionRange, config.lightRange) &&
        hasLineOfSight(position, world.player, map);
      result.illuminated =
        !!world.lightOn &&
        sight &&
        inCone(world.player, world.aim, position, config.lightRange, config.lightCos);
      result.observed =
        result.illuminated || (sight && inCone(world.player, world.aim, position, 3, 0.45));
      result.detected = result.fresh = false;
      if (type === 'listener') {
        poll -= dt;
        hold = Math.max(0, hold - dt);
        const noisy = world.moving && (world.noise ?? 1) > 0.55;
        if (!noisy) hold = 0;
        else if (poll <= 0) {
          poll = config.hearingInterval;
          const route =
            distance <= config.hearingRange ? findPath(position, world.player, map) : [];
          result.fresh = route.length > 0 && (route.length - 1) * CELL_SIZE <= config.hearingRange;
          hold = result.fresh ? config.hearingInterval : 0;
        }
        result.detected = noisy && hold > 0;
      } else if (type === 'parasite') {
        result.detected = result.fresh = !!world.lightOn && sight && distance <= config.visionRange;
      } else if (type === 'mimic') {
        result.detected = result.fresh = sight && distance <= config.visionRange;
      } else {
        result.detected = result.fresh =
          sight &&
          (inCone(position, aim, world.player, config.visionRange, config.visionCos) ||
            (world.moving && distance < config.hearingRange));
      }
      return result;
    },
  };
}
