export type Rarity = 'rare' | 'epic' | 'legendary' | 'artifact';
export type ClassKey =
  | 'warrior' | 'mage' | 'priest' | 'rogue'
  | 'druid' | 'hunter' | 'shaman' | 'paladin' | 'warlock';

export type VideoRef = {
  videoId: string;
  url: string;
  title: string;
  rank: number | null;
  faction: 'alliance' | 'horde' | null;
};

export type RequiredTab = { tab: string; investment: number };

export type LocationResource = { url: string; label: string };
export type Location = {
  zoneId: string;
  zoneName: string;
  continent: string;       // "kalimdor" | "eastern-kingdoms"
  top: number;             // % on continent map
  left: number;            // % on continent map
  rawTop: number;
  rawLeft: number;
  description: string;
  quality: string | null;
  resources: LocationResource[];
};

export type ME = {
  id: string;
  name: string;
  normalizedName: string;
  class: ClassKey;
  classLabel: string;
  rarity: Rarity;
  rarityLabel: string;
  level: number | null;
  levelRange: [number, number];
  specs: string[];
  icon: string;
  description: string;
  requiredTabs: RequiredTab[] | null;
  requiredSpellIds: string[] | null;
  videos: VideoRef[];
  locations: Location[];
};
