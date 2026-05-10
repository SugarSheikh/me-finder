// Add a `locations` array to each ME by matching mystic-enchant markers from
// azerothhub against the catalog. Each marker's zone-relative top/left is
// converted to continent-relative percentages using the zone's bounds, so the
// UI just needs the continent map images.
import { readFileSync, writeFileSync } from 'node:fs';

const mes = JSON.parse(readFileSync('public/data/mes.json', 'utf8'));
const markersAll = JSON.parse(readFileSync('data/raw/azerothhub_markers.json', 'utf8'));
const zones = JSON.parse(readFileSync('data/raw/azerothhub_zones.json', 'utf8'));
let aliases = {};
try {
  const aliasFile = JSON.parse(readFileSync('data/aliases.json', 'utf8'));
  for (const k of Object.keys(aliasFile)) if (!k.startsWith('_')) aliases[k] = aliasFile[k];
} catch {}

function cleanDescription(s) {
  if (!s) return '';
  return String(s)
    .replace(/\s*\\n\s*/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function titleCase(s) {
  if (!s) return '';
  return String(s).replace(/(^|[\s-])([a-z])/g, (_, p, c) => p + c.toUpperCase()).replace(/-/g, ' ');
}

// Marker zoneId aliases — slug differences between marker data and zone catalog.
const ZONE_ALIASES = {
  'un-goro-crater': 'ungoro-crater',
  'barrens': 'the-barrens',
};

// zoneIds we want to surface even when they're not in the continent zones
// catalog (sub-zones / dungeons). Pin on the zone map only — no continent
// projection because we have no zoneBounds for them.
const zoneMaps = JSON.parse(readFileSync('public/data/zone_maps.json', 'utf8'));

const zoneById = new Map();
for (const z of zones) {
  if (!z?.id) continue;
  zoneById.set(z.id, {
    id: z.id,
    name: titleCase(z.name || z.id),
    parentId: z.parentId,
    bounds: z.bounds,
  });
}

function normalize(name) {
  return name.toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
function stripPrefix(name) {
  return name.replace(/^Mystic Scroll:\s*/i, '').replace(/\s*\((Alliance|Horde)(?:\s+[Vv]ersion)?\)\s*$/i, '').trim();
}

const meByKey = new Map();
for (const m of mes) {
  m.locations = [];
  meByKey.set(`${m.class}:${m.normalizedName}`, m);
}

const meMarkers = markersAll.filter(m => m.type === 'mystic-enchant');
let matched = 0;
let zoneMissing = 0;
const orphanMarkers = [];

for (const mk of meMarkers) {
  const cleanName = stripPrefix(mk.name);
  const norm = normalize(cleanName);
  const classes = Array.isArray(mk.classes) && mk.classes.length ? mk.classes : null;
  const resolvedZoneId = ZONE_ALIASES[mk.zoneId] || mk.zoneId;
  const zone = zoneById.get(resolvedZoneId);
  // Either a known continent zone, OR a sub-zone we have a map for.
  const subZoneHasMap = !zone && Boolean(zoneMaps[mk.zoneId]);
  if (!zone && !subZoneHasMap) { zoneMissing++; continue; }
  const continentTop = zone?.bounds ? zone.bounds.top + zone.bounds.height * (mk.top / 100) : null;
  const continentLeft = zone?.bounds ? zone.bounds.left + zone.bounds.width * (mk.left / 100) : null;

  // Try matching against each class in the marker's classes array (one ME entry per class)
  const tryClasses = classes || [...new Set(mes.map(x => x.class))]; // fallback: try all classes
  let any = false;
  for (const c of tryClasses) {
    const aliasKey = `${c}:${norm}`;
    const targets = aliases[aliasKey] != null ? (Array.isArray(aliases[aliasKey]) ? aliases[aliasKey] : [aliases[aliasKey]]) : [norm];
    for (const t of targets) {
      const me = meByKey.get(`${c}:${t}`);
      if (!me) continue;
      me.locations.push({
        zoneId: zone ? zone.id : mk.zoneId,
        zoneName: zone ? zone.name : titleCase(mk.zoneId),
        continent: zone ? zone.parentId : null,
        top: continentTop !== null ? +continentTop.toFixed(3) : null,
        left: continentLeft !== null ? +continentLeft.toFixed(3) : null,
        rawTop: mk.top,
        rawLeft: mk.left,
        zoneBounds: zone?.bounds || null,
        description: cleanDescription(mk.description),
        quality: mk.quality || null,
        resources: Array.isArray(mk.resources)
          ? mk.resources
              .filter(r => r.url && !/discord\.com|discord\.gg/.test(r.url))
              .map(r => ({ url: r.url, label: r.label }))
          : [],
      });
      any = true;
    }
  }
  if (any) matched++;
  else orphanMarkers.push({ name: cleanName, normalized: norm, classes: classes, zoneId: mk.zoneId });
}

// Coverage stats
const withVideo = mes.filter(m => m.videos.length > 0).length;
const withLocation = mes.filter(m => m.locations.length > 0).length;
const withEither = mes.filter(m => m.videos.length > 0 || m.locations.length > 0).length;
const withBoth = mes.filter(m => m.videos.length > 0 && m.locations.length > 0).length;
const withNeither = mes.filter(m => m.videos.length === 0 && m.locations.length === 0).length;

console.log(`Markers: ${meMarkers.length} mystic-enchant`);
console.log(`  matched to ME(s): ${matched}`);
console.log(`  zone bounds missing: ${zoneMissing}`);
console.log(`  orphan markers: ${orphanMarkers.length}`);
console.log('');
console.log(`MEs:                        ${mes.length}`);
console.log(`  with video:               ${withVideo}`);
console.log(`  with location:            ${withLocation}`);
console.log(`  with either:              ${withEither}  (gap: ${mes.length - withEither})`);
console.log(`  with both:                ${withBoth}`);
console.log(`  with neither:             ${withNeither}`);

writeFileSync('public/data/mes.json', JSON.stringify(mes, null, 2));
writeFileSync('data/raw/location_match_report.json', JSON.stringify({
  totalMarkers: meMarkers.length,
  matched, zoneMissing, orphanMarkers: orphanMarkers.length,
  coverage: { withVideo, withLocation, withEither, withBoth, withNeither },
  orphanMarkersList: orphanMarkers.slice(0, 100),
}, null, 2));

if (orphanMarkers.length) {
  console.log('\nFirst 12 orphan markers (no matching ME):');
  for (const o of orphanMarkers.slice(0, 12)) console.log(`  "${o.name}" (classes=${o.classes ? o.classes.join(',') : '?'}, zone=${o.zoneId})`);
}
