import { ENEMY } from './config.js';

export function getDifficulty(floor) {
  const level=Number.isFinite(floor)?Math.min(12,Math.max(1,Math.floor(floor))):1;
  return {roomCount:Math.min(8,4+Math.floor((level-1)/2)),enemyCount:Math.min(3,1+Math.floor((level-1)/3)),
    supplyEveryRooms:level<4?1:2,enemyOptions:{...ENEMY,chaseSpeed:Math.min(2.35,2.05+(level-1)*.03),
      visionRange:Math.min(8.2,7+(level-1)*.12),searchSeconds:Math.min(7.5,6+(level-1)*.15)}};
}
