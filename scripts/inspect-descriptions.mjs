import { readFileSync } from 'node:fs';
const mes = JSON.parse(readFileSync('public/data/mes.json', 'utf8'));

// Where might "/n" appear? In descriptions OR in location.description.
let meDescHits = 0, locDescHits = 0;
const samples = [];
for (const m of mes) {
  if (/\/n/.test(m.description)) {
    meDescHits++;
    if (samples.length < 3) samples.push({ src: 'me.description', name: m.name, snippet: m.description.slice(0, 200) });
  }
  for (const l of m.locations) {
    if (/\/n/.test(l.description)) {
      locDescHits++;
      if (samples.length < 6) samples.push({ src: `location/${l.zoneName}`, name: m.name, snippet: l.description.slice(0, 200) });
    }
  }
}
console.log(`me descriptions with "/n": ${meDescHits}`);
console.log(`location descriptions with "/n": ${locDescHits}`);
console.log('\nSamples:');
for (const s of samples) console.log(`  [${s.src}] ${s.name}\n    ${JSON.stringify(s.snippet)}\n`);

// Also check raw \n (newline) and what the rendered string looks like
let realNewlineCount = 0;
for (const m of mes) {
  if (/\n/.test(m.description)) realNewlineCount++;
  for (const l of m.locations) if (/\n/.test(l.description)) realNewlineCount++;
}
console.log(`\nentries containing real \\n (newline): ${realNewlineCount}`);
