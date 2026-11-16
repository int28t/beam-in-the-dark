export const MONSTER_TYPES = Object.freeze({
  shadow: Object.freeze({
    id: 'shadow',
    name: 'Тень',
    unlockFloor: 1,
    color: 0x101322,
    accent: 0xf78d77,
    contactRadius: 0.43,
    hint: 'Видит перед собой и слышит шаги вблизи. Стены скрывают тебя, луч сильно замедляет её.',
    speedScale: 1,
    tuning: Object.freeze({}),
  }),
  listener: Object.freeze({
    id: 'listener',
    name: 'Слухач',
    unlockFloor: 3,
    color: 0x182e2c,
    accent: 0x73c8b7,
    contactRadius: 0.4,
    hint: 'Слепой. Слышит шаги за углом по короткому пути. Неподвижного игрока не обнаруживает, но идёт к последнему звуку.',
    speedScale: 0.95,
    tuning: Object.freeze({
      visionRange: 0,
      hearingRange: 6,
      hearingInterval: 0.3,
      slowFactor: 0.45,
    }),
  }),
  charger: Object.freeze({
    id: 'charger',
    name: 'Ловчий',
    unlockFloor: 6,
    color: 0x30202c,
    accent: 0xd59aff,
    contactRadius: 0.49,
    hint: 'Предупреждает янтарной вспышкой и делает прямой рывок. Уйди в сторону или сорви подготовку лучом.',
    speedScale: 1,
    tuning: Object.freeze({ hearingRange: 0, visionCos: 0.65, slowFactor: 0.4 }),
    attack: Object.freeze({
      windupSeconds: 0.8,
      dashSeconds: 0.75,
      dashSpeed: 4.2,
      recoverSeconds: 1.2,
      cooldownSeconds: 3,
      range: 3.4,
    }),
  }),
});
export function getMonsterType(id) {
  return Object.hasOwn(MONSTER_TYPES, id) ? MONSTER_TYPES[id] : MONSTER_TYPES.shadow;
}
export function getAvailableMonsterTypes(floor) {
  const level = Number.isFinite(floor) ? Math.max(1, Math.floor(floor)) : 1;
  return Object.keys(MONSTER_TYPES).filter((id) => MONSTER_TYPES[id].unlockFloor <= level);
}
