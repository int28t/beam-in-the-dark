export const SKINS = Object.freeze({
  classic: Object.freeze({
    name: 'Сланцевый плащ',
    cloak: 0x344b52,
    hood: 0x415a60,
    requiredBest: 0,
  }),
  wine: Object.freeze({ name: 'Винный плащ', cloak: 0x562e40, hood: 0x784456, requiredBest: 3 }),
  bone: Object.freeze({ name: 'Пепельный плащ', cloak: 0x858177, hood: 0xb1aa97, requiredBest: 6 }),
});
export function getSkin(id) {
  return Object.hasOwn(SKINS, id) ? SKINS[id] : SKINS.classic;
}
export function earnedSkins(best) {
  return Object.keys(SKINS).filter((id) => SKINS[id].requiredBest <= best);
}
