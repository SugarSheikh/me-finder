// Join MEs with videos by (normalizedName, class). Emit:
//   public/data/mes.json          — MEs augmented with videos array
//   data/raw/match_report.json    — coverage stats + orphans + unmatched MEs
import { readFileSync, writeFileSync } from 'node:fs';

const mes = JSON.parse(readFileSync('public/data/mes.json', 'utf8'));
const videos = JSON.parse(readFileSync('public/data/videos.json', 'utf8'));

let aliases = {};
try {
  aliases = JSON.parse(readFileSync('data/aliases.json', 'utf8'));
  for (const k of Object.keys(aliases)) if (k.startsWith('_')) delete aliases[k];
} catch {}
// aliases shape: { "<class>:<normalized video name>": "<normalized ME name>" }

function normalize(name) {
  return name.toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const meByKey = new Map();
for (const m of mes) {
  m.videos = [];
  m.normalizedName = normalize(m.name);
  meByKey.set(`${m.class}:${m.normalizedName}`, m);
}

const orphanVideos = [];
let matched = 0;
for (const v of videos) {
  const aliasKey = `${v.class}:${v.normalizedName}`;
  const aliasVal = aliases[aliasKey];
  const targets = Array.isArray(aliasVal) ? aliasVal : [aliasVal || v.normalizedName];
  let hit = false;
  for (const target of targets) {
    const me = meByKey.get(`${v.class}:${target}`);
    if (!me) continue;
    me.videos.push({
      videoId: v.videoId,
      url: v.url,
      title: v.title,
      rank: v.rank,
      faction: v.faction,
    });
    hit = true;
  }
  if (hit) matched++;
  else orphanVideos.push({ class: v.class, name: v.displayName, normalized: v.normalizedName, videoId: v.videoId, title: v.title });
}

// Sort each ME's videos: rank asc (null first), then faction (alliance first), then videoId for stability
for (const m of mes) {
  m.videos.sort((a, b) => {
    const ar = a.rank ?? 0, br = b.rank ?? 0;
    if (ar !== br) return ar - br;
    const af = a.faction || '', bf = b.faction || '';
    if (af !== bf) return af.localeCompare(bf);
    return a.videoId.localeCompare(b.videoId);
  });
}

const withVideo = mes.filter(m => m.videos.length > 0);
const without = mes.filter(m => m.videos.length === 0);

// Per-class coverage
const perClass = {};
for (const m of mes) {
  perClass[m.class] = perClass[m.class] || { total: 0, withVideo: 0, withoutVideo: 0 };
  perClass[m.class].total++;
  if (m.videos.length > 0) perClass[m.class].withVideo++;
  else perClass[m.class].withoutVideo++;
}
for (const c of Object.keys(perClass)) {
  const p = perClass[c];
  p.coverage = +(100 * p.withVideo / p.total).toFixed(1);
}

writeFileSync('public/data/mes.json', JSON.stringify(mes, null, 2));
writeFileSync('data/raw/match_report.json', JSON.stringify({
  totalMes: mes.length,
  totalVideos: videos.length,
  matched,
  orphanVideos: orphanVideos.length,
  unmatchedMes: without.length,
  perClass,
  unmatchedMesByClass: without.reduce((acc, m) => {
    acc[m.class] = acc[m.class] || [];
    acc[m.class].push({ name: m.name, rarity: m.rarity, normalized: m.normalizedName });
    return acc;
  }, {}),
  orphanVideosList: orphanVideos,
}, null, 2));

console.log(`MEs: ${mes.length}   Videos: ${videos.length}`);
console.log(`Matched videos→ME: ${matched} / ${videos.length}`);
console.log(`Orphan videos (no ME): ${orphanVideos.length}`);
console.log(`MEs with ≥1 video: ${withVideo.length} / ${mes.length}`);
console.log(`MEs without any video: ${without.length}\n`);
console.table(perClass);

if (orphanVideos.length > 0) {
  console.log('\nFirst 15 orphan videos:');
  for (const o of orphanVideos.slice(0, 15)) console.log(`  [${o.class}] ${o.name}  (${o.videoId})`);
}
