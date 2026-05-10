// For each orphan video, suggest the closest ME in the same class by edit distance,
// plus an "any class" closest match in case Whiter mis-tagged.
import { readFileSync } from 'node:fs';

const report = JSON.parse(readFileSync('data/raw/match_report.json', 'utf8'));
const mes = JSON.parse(readFileSync('public/data/mes.json', 'utf8'));

function lev(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length; if (!b.length) return a.length;
  const dp = Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) dp[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]; dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[b.length];
}

function sub(needle, haystack) {
  // return true if needle is substring of haystack or vice versa
  return haystack.includes(needle) || needle.includes(haystack);
}

for (const o of report.orphanVideosList) {
  const inClass = mes.filter(m => m.class === o.class);
  let best = { d: Infinity, name: '', rarity: '' };
  for (const m of inClass) {
    const mn = m.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const d = lev(o.normalized, mn);
    if (d < best.d) best = { d, name: m.name, rarity: m.rarity, normalized: mn };
  }
  // Substring matches across the whole catalog (handles compound titles like "Dragon Roar & Dragon Warrior")
  const subHits = mes.filter(m => {
    const mn = m.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return sub(mn, o.normalized) && mn.length >= 4;
  }).slice(0, 4).map(m => `${m.class}:${m.name} [${m.rarity}]`);

  console.log(`\n[${o.class}] "${o.name}" (${o.videoId})`);
  console.log(`  closest in-class:    "${best.name}" [${best.rarity}]  edit-dist ${best.d}`);
  if (subHits.length) console.log(`  catalog substrings:  ${subHits.join(' | ')}`);
}
