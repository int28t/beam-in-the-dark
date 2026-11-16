export const VERSION = '0.10.0';
export const PLAYER = Object.freeze({ speed: 2.65, radiusX: 0.24, radiusZ: 0.18 });
export const ENEMY = Object.freeze({
  patrolSpeed: 0.95,
  chaseSpeed: 2.05,
  radius: 0.24,
  visionRange: 7,
  visionCos: 0.55,
  hearingRange: 2.1,
  searchSeconds: 6,
  slowFactor: 0.25,
  lightRange: 10,
  lightCos: Math.cos(Math.PI / 6.5),
  repathSeconds: 0.45,
});
export const FLASHLIGHT = Object.freeze({
  capacity: 100,
  drain: 0.65,
  exposedDrain: 2.4,
  refill: 32,
  pickupRadius: 0.65,
});
