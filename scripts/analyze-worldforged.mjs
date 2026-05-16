import { readFileSync } from 'node:fs';
const markers = JSON.parse(readFileSync('data/raw/azerothhub_markers.json', 'utf8'));
const wf = markers.filter(m => m.type === 'worldforge');
console.log(`azerothhub worldforge markers: ${wf.length}`);

// Unique items (by name) — markers can repeat the same item at multiple drop spots
function normalize(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
const unique = new Set();
for (const m of wf) unique.add(normalize(m.name.replace(/^Worldforge:\s*/i, '')));
console.log(`unique worldforge item names: ${unique.size}`);

// Sample
console.log('\nfirst 5 marker entries:');
for (const m of wf.slice(0, 5)) console.log(`  ${m.name} @ ${m.zoneId} (q=${m.quality || '-'})`);

// Avg markers per item
console.log(`\nmarkers per item: ${(wf.length / unique.size).toFixed(2)}`);
