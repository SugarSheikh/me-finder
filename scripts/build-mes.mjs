// Take the raw per-class/per-rarity ME block and emit a flat catalog usable
// by the UI. Self-contained — does not call out anywhere.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const raw = JSON.parse(readFileSync('data/raw/me_block.json', 'utf8'));

// Bisbeard descriptions sometimes contain a literal backslash-n sequence as
// paragraph separator (rendered as " \n " in the UI). Convert those to real
// newlines and squeeze excessive whitespace.
function cleanDescription(s) {
  if (!s) return '';
  return String(s)
    .replace(/\s*\\n\s*/g, '\n')   // " \n " -> real newline
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const RARITY_ORDER = ['rare', 'epic', 'legendary', 'artifact'];
const RARITY_LABEL = { rare: 'Rare', epic: 'Epic', legendary: 'Legendary', artifact: 'Artifact' };
const CLASS_LABEL = {
  warrior: 'Warrior', mage: 'Mage', priest: 'Priest', rogue: 'Rogue',
  druid: 'Druid', hunter: 'Hunter', shaman: 'Shaman', paladin: 'Paladin', warlock: 'Warlock',
};
// From in-game catalog column headers (BronzeBeardRE screenshots).
// Artifact and Legendary are uniform; Epic and Rare span level cohorts that we
// will backfill per-ME from the screenshots in a follow-up pass.
const LEVEL_FOR_RARITY = { artifact: 35, legendary: 30, epic: null, rare: null };
const LEVEL_RANGE_FOR_RARITY = {
  artifact: [35, 35], legendary: [30, 30], epic: [15, 40], rare: [10, 60],
};

const flat = [];
for (const cls of Object.keys(raw)) {
  for (const rarity of Object.keys(raw[cls])) {
    for (const id of Object.keys(raw[cls][rarity])) {
      const m = raw[cls][rarity][id];
      flat.push({
        id: String(m.id),
        name: m.name,
        class: cls,
        classLabel: CLASS_LABEL[cls] || cls,
        rarity,
        rarityLabel: RARITY_LABEL[rarity] || rarity,
        level: LEVEL_FOR_RARITY[rarity],
        levelRange: LEVEL_RANGE_FOR_RARITY[rarity],
        specs: m.specs || [],
        icon: m.icon,
        description: cleanDescription(m.description),
        requiredTabs: m.requiredTabs || null,
        requiredSpellIds: m.requiredSpellIds || null,
      });
    }
  }
}

flat.sort((a, b) => {
  if (a.class !== b.class) return a.class.localeCompare(b.class);
  const ar = RARITY_ORDER.indexOf(a.rarity), br = RARITY_ORDER.indexOf(b.rarity);
  if (ar !== br) return br - ar;
  return a.name.localeCompare(b.name);
});

const counts = {};
for (const m of flat) {
  counts[m.class] = counts[m.class] || { total: 0 };
  counts[m.class][m.rarity] = (counts[m.class][m.rarity] || 0) + 1;
  counts[m.class].total++;
}

mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/mes.json', JSON.stringify(flat, null, 2));
console.log(`Wrote public/data/mes.json: ${flat.length} entries`);
console.table(counts);
