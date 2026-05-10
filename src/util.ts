import type { Rarity, ClassKey, ME } from './types';

export const RARITY_ORDER: Rarity[] = ['artifact', 'legendary', 'epic', 'rare'];
export const CLASS_ORDER: ClassKey[] = [
  'warrior', 'paladin', 'hunter', 'rogue', 'priest', 'shaman', 'mage', 'warlock', 'druid',
];

export const RARITY_COLOR: Record<Rarity, string> = {
  artifact: '#e6cc80',
  legendary: '#ff8000',
  epic: '#a335ee',
  rare: '#0070dd',
};

export const CLASS_COLOR: Record<ClassKey, string> = {
  warrior: '#c79c6e',
  paladin: '#f58cba',
  hunter:  '#abd473',
  rogue:   '#fff569',
  priest:  '#ffffff',
  shaman:  '#0070de',
  mage:    '#69ccf0',
  warlock: '#9482c9',
  druid:   '#ff7d0a',
};

export function iconUrl(name: string): string {
  // Wowhead's public icon CDN — same icons used by every WoW community tool.
  return `https://wow.zamimg.com/images/wow/icons/large/${name.toLowerCase()}.jpg`;
}

export function rarityRank(r: Rarity): number {
  return RARITY_ORDER.indexOf(r);
}

export function levelDisplay(me: ME): string {
  if (me.level !== null) return `Lvl ${me.level}`;
  const [lo, hi] = me.levelRange;
  return lo === hi ? `Lvl ${lo}` : `Lvl ${lo}–${hi}`;
}
