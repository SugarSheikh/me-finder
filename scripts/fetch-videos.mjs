// Scrape every class playlist on Whiter's channel; emit a flat videos list
// with normalized name + class for matching.
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const YTDLP = join(homedir(), 'bin', 'yt-dlp.exe');

const PLAYLISTS = [
  { class: 'warrior', id: 'PLdApKfDWsi1_GG7rGZeHQ69lcAnJWcb3v' },
  { class: 'mage',    id: 'PLdApKfDWsi18yLtWHluSWp2EjqdMIu13W' },
  { class: 'priest',  id: 'PLdApKfDWsi1_LHfYoxGkiZfUOjJUprYQS' },
  { class: 'rogue',   id: 'PLdApKfDWsi1-vBkurLCl510vHGkm0_bJb' },
  { class: 'druid',   id: 'PLdApKfDWsi1-YnlzstjkV0HbgDw3hZrAq' },
  { class: 'hunter',  id: 'PLdApKfDWsi1_6vR0rLLvs9KxU7eH7cb0A' },
  { class: 'shaman',  id: 'PLdApKfDWsi19OxpycEuMOUI8hjPd87wXO' },
  { class: 'paladin', id: 'PLdApKfDWsi1-KR5TJw5fzutC4DQGlfiHy' },
  { class: 'warlock', id: 'PLdApKfDWsi18S-Y7K-oWyJRKMZOz4y5Ry' },
];

// Title patterns to strip:
//   "How to get Mystic Enchant: <Name> | <Class> [...]"
//   "Mystic Enchant: <Name> | <Class> [...]"
//   "Mystic Scroll: <Name> | ..."  (Whiter has used both phrasings)
//   "Mystic Enchant <Name>: | ..." (typo'd colon position seen on at least one video)
//   "<Name> (2) | ..."
//   "<Name> (Alliance Version) | ..."
const TITLE_RE_STRICT = /^(?:How to get )?Mystic (?:Enchant|Scroll):\s*(.+?)\s*\|/i;
const TITLE_RE_LOOSE  = /^(?:How to get )?Mystic (?:Enchant|Scroll)\s+(.+?):?\s*\|/i;
const RANK_RE = /\s*\((\d+)\)\s*$/;
// Faction suffix variants seen in the wild:
//   " (Alliance Version)" / " (Horde Version)"
//   " (Alliance)" / " (Horde)"
//   " as Alliance" / " as Horde"
//   " (alliance version)" — lowercase inside parens
const FACTION_RE = /\s*(?:as\s+|\(\s*)?(Alliance|Horde)(?:\s+[Vv]ersion)?\s*\)?\s*$/i;

function parseTitle(title) {
  const m = title.match(TITLE_RE_STRICT) || title.match(TITLE_RE_LOOSE);
  if (!m) return null;
  let name = m[1];
  let rank = null;
  let faction = null;
  // Faction first because it can come before/after rank
  const fm = name.match(FACTION_RE);
  if (fm) { faction = fm[1].toLowerCase(); name = name.replace(FACTION_RE, '').trim(); }
  const rm = name.match(RANK_RE);
  if (rm) { rank = parseInt(rm[1], 10); name = name.replace(RANK_RE, '').trim(); }
  // One more sweep — sometimes faction sits between name and rank
  const fm2 = name.match(FACTION_RE);
  if (fm2 && !faction) { faction = fm2[1].toLowerCase(); name = name.replace(FACTION_RE, '').trim(); }
  return { displayName: name, rank, faction };
}

function normalize(name) {
  return name.toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function listPlaylist(playlistId) {
  const url = `https://www.youtube.com/playlist?list=${playlistId}`;
  const out = execFileSync(YTDLP, [
    '--flat-playlist',
    '--print', '%(id)s|||%(title)s',
    url,
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return out.split('\n').filter(Boolean).map(line => {
    const [id, ...rest] = line.split('|||');
    return { videoId: id, title: rest.join('|||') };
  });
}

const videos = [];
const skipped = [];
for (const { class: cls, id } of PLAYLISTS) {
  console.log(`-- ${cls} (${id})`);
  const rows = listPlaylist(id);
  console.log(`   ${rows.length} videos`);
  for (const r of rows) {
    const parsed = parseTitle(r.title);
    if (!parsed) { skipped.push({ class: cls, ...r, reason: 'no_me_title' }); continue; }
    videos.push({
      videoId: r.videoId,
      url: `https://www.youtube.com/watch?v=${r.videoId}`,
      title: r.title,
      class: cls,
      displayName: parsed.displayName,
      normalizedName: normalize(parsed.displayName),
      rank: parsed.rank,
      faction: parsed.faction,
    });
  }
}

mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/videos.json', JSON.stringify(videos, null, 2));
writeFileSync('data/raw/videos_skipped.json', JSON.stringify(skipped, null, 2));

console.log(`\nWrote public/data/videos.json: ${videos.length} videos`);
console.log(`Skipped (non-ME titles): ${skipped.length}`);
if (skipped.length > 0) {
  console.log('Sample skipped:');
  for (const s of skipped.slice(0, 5)) console.log(`  [${s.class}] ${s.title}`);
}
