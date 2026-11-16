import { PLAYER, FLASHLIGHT } from './config.js';
import { createEllipseCollider } from './collision.js';
import { createEnemy } from './enemy.js';
import { distancesFrom, cellPoint, cellIndex, hasLineOfSight } from './navigation.js';

export function createWorld(map) {
  const position = { ...map.spawns.player },
    aim = { x: 0, z: -1 },
    delta = { x: 0, z: 0 };
  const exit = map.spawns.exit;
  const lockedWalls = [
    ...map.walls,
    { minX: exit.x - 0.5, maxX: exit.x + 0.5, minZ: exit.z + 0.28, maxZ: exit.z + 0.42 },
  ];
  const collider = createEllipseCollider(map.walls, PLAYER.radiusX, PLAYER.radiusZ);
  const lockedCollider = createEllipseCollider(lockedWalls, PLAYER.radiusX, PLAYER.radiusZ);
  const enemies = (map.enemies ?? []).map((spawn) => {
    if (spawn.patrol?.length) return createEnemy(spawn, map, map.enemyOptions);
    const distances = distancesFrom(spawn, map);
    let far = cellIndex(spawn, map),
      best = 0;
    for (let i = 0; i < distances.length; i++)
      if (distances[i] > best && distances[i] <= 7) {
        best = distances[i];
        far = i;
      }
    return createEnemy(
      { ...spawn, patrol: [{ x: spawn.x, z: spawn.z }, cellPoint(far, map)] },
      map,
      map.enemyOptions,
    );
  });
  const collected = new Set();
  const enemyWorld = { player: position, moving: false, noise: 0, lightOn: true, aim };
  const frame = { key: false, exit: false, caught: false, battery: 0 };
  const feedback = {
    keyPicked: false,
    batteriesPicked: 0,
    caught: false,
    completed: false,
    lightHit: false,
    threat: false,
    warning: false,
    walking: false,
    nearLockedExit: false,
    sneaking: false,
    parasiteHit: false,
    parasiteWarning: false,
    roar: false,
    scraping: false,
    hissing: false,
    noiseAlarm: false,
    noise: 0,
  };
  let parasiteWarning = 0;
  return {
    position,
    aim,
    enemies,
    collected,
    feedback,
    map,
    reset() {
      position.x = map.spawns.player.x;
      position.z = map.spawns.player.z;
      aim.x = 0;
      aim.z = -1;
      collected.clear();
      parasiteWarning = 0;
      enemies.forEach((e) => e.reset());
    },
    step(dt, controls, game) {
      feedback.keyPicked = false;
      feedback.batteriesPicked = 0;
      feedback.caught = false;
      feedback.completed = false;
      feedback.lightHit = false;
      feedback.threat = false;
      feedback.warning = false;
      feedback.walking = false;
      feedback.parasiteHit = feedback.roar = feedback.scraping = feedback.sneaking = false;
      feedback.parasiteWarning = false;
      feedback.hissing = feedback.noiseAlarm = false;
      feedback.noise = 0;
      if (game.state.phase !== 'playing') return feedback;
      dt = Math.min(0.05, Math.max(0, dt));
      const length = Math.hypot(controls.aimX, controls.aimZ);
      if (length > 0.0001) {
        aim.x = controls.aimX / length;
        aim.z = controls.aimZ / length;
      }
      const oldX = position.x,
        oldZ = position.z;
      feedback.sneaking = !!controls.sneaking;
      const moveScale = feedback.sneaking ? 0.4 : 1;
      delta.x = controls.moveX * PLAYER.speed * dt * moveScale;
      delta.z = controls.moveZ * PLAYER.speed * dt * moveScale;
      (game.state.hasKey ? collider : lockedCollider).move(position, delta);
      feedback.walking = Math.hypot(oldX - position.x, oldZ - position.z) > 0.0001;
      enemyWorld.moving = feedback.walking;
      enemyWorld.noise =
        dt > 0 ? Math.hypot(oldX - position.x, oldZ - position.z) / (PLAYER.speed * dt) : 0;
      feedback.noise = enemyWorld.noise;
      parasiteWarning = Math.max(0, parasiteWarning - dt);
      enemyWorld.lightOn = game.state.lightOn;
      frame.caught = false;
      for (const enemy of enemies) {
        enemy.update(dt, enemyWorld);
        feedback.lightHit ||= enemy.lightAffected;
        feedback.roar ||= enemy.roared;
        feedback.hissing ||= enemy.phase === 'repelled';
        feedback.noiseAlarm ||= enemy.signal > 0;
        feedback.scraping ||= enemy.type === 'mimic' && enemy.moving;
        feedback.threat ||= enemy.isThreat;
        feedback.warning ||= enemy.phase === 'windup';
        const contact =
          Math.hypot(position.x - enemy.position.x, position.z - enemy.position.z) <
          enemy.contactRadius;
        if (contact && enemy.lethal) frame.caught = true;
        if (contact && !enemy.lethal && hasLineOfSight(position, enemy.position, map)) {
          const bite = enemy.tryBite(game.state.lightOn);
          if (bite) {
            game.drainBattery(bite);
            feedback.parasiteHit = true;
            parasiteWarning = 1.2;
          }
        }
      }
      const exitDistance = Math.hypot(position.x - exit.x, position.z - exit.z);

      frame.key =
        !game.state.hasKey &&
        Math.hypot(position.x - map.spawns.key.x, position.z - map.spawns.key.z) <
          FLASHLIGHT.pickupRadius;
      frame.exit = exitDistance < 0.7;
      frame.battery = 0;
      if (!frame.caught)
        for (const battery of map.batteries ?? []) {
          if (
            !collected.has(battery.id) &&
            Math.hypot(position.x - battery.x, position.z - battery.z) < FLASHLIGHT.pickupRadius
          ) {
            collected.add(battery.id);
            frame.battery++;
          }
        }
      game.drainLight(dt, feedback.lightHit);
      game.resolveFrame(frame);
      feedback.keyPicked = !frame.caught && frame.key;
      feedback.batteriesPicked = frame.battery;
      feedback.caught = frame.caught;
      feedback.completed = game.state.phase === 'floorComplete';
      feedback.nearLockedExit = exitDistance < 1.25;
      feedback.parasiteWarning = parasiteWarning > 0;
      return feedback;
    },
  };
}
