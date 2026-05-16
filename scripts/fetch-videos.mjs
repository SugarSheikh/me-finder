// Scrape every class playlist on Whiter's channel; emit a flat videos list
// with normalized name + class for matching.
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const YTDLP = join(homedir(), 'bin', 'yt-dlp.exe');

// Video sources. Each playlist tags a class. The parser handles title shape per source.
const PLAYLISTS = [
  // Whiter | Bronzebeard & More
  { class: 'warrior', id: 'PLdApKfDWsi1_GG7rGZeHQ69lcAnJWcb3v', source: 'whiter' },
  { class: 'mage',    id: 'PLdApKfDWsi18yLtWHluSWp2EjqdMIu13W', source: 'whiter' },
  { class: 'priest',  id: 'PLdApKfDWsi1_LHfYoxGkiZfUOjJUprYQS', source: 'whiter' },
  { class: 'rogue',   id: 'PLdApKfDWsi1-vBkurLCl510vHGkm0_bJb', source: 'whiter' },
  { class: 'druid',   id: 'PLdApKfDWsi1-YnlzstjkV0HbgDw3hZrAq', source: 'whiter' },
  { class: 'hunter',  id: 'PLdApKfDWsi1_6vR0rLLvs9KxU7eH7cb0A', source: 'whiter' },
  { class: 'shaman',  id: 'PLdApKfDWsi19OxpycEuMOUI8hjPd87wXO', source: 'whiter' },
  { class: 'paladin', id: 'PLdApKfDWsi1-KR5TJw5fzutC4DQGlfiHy', source: 'whiter' },
  { class: 'warlock', id: 'PLdApKfDWsi18S-Y7K-oWyJRKMZOz4y5Ry', source: 'whiter' },
  // Shadowmeld GG
  { class: 'hunter',  id: 'PLXCFdLURG4z_NZOhFdKPXO9SOVOYduwY3', source: 'shadowmeld' },
  { class: 'mage',    id: 'PLXCFdLURG4z83HenvnJt3qpelkGsK5fsl', source: 'shadowmeld' },
  { class: 'rogue',   id: 'PLXCFdLURG4z-2mMmC4Oat-MuV4yGYGqxq', source: 'shadowmeld' },
  { class: 'priest',  id: 'PLXCFdLURG4z9Z63mdkXnGzr-CtSAv8HUS', source: 'shadowmeld' },
  { class: 'warlock', id: 'PLXCFdLURG4z-3MpUTXr9op571CLDo_Gn0', source: 'shadowmeld' },
  { class: 'shaman',  id: 'PLXCFdLURG4z-4JnZLMuvS9q5eH__gVnHQ', source: 'shadowmeld' },
  { class: 'druid',   id: 'PLXCFdLURG4z-AC3xO1BWX3g62mRRpas6Q', source: 'shadowmeld' },
  { class: 'warrior', id: 'PLXCFdLURG4z9cxF44WG9Xnfv996oRjM33', source: 'shadowmeld' },
  { class: 'paladin', id: 'PLXCFdLURG4z8w_ea0L_td49XPVrKKBzTg', source: 'shadowmeld' },
];

// Whiter title patterns:
//   "How to get Mystic Enchant: <Name> | <Class> [...]"
//   "Mystic Enchant: <Name> | <Class> [...]"
//   "Mystic Scroll: <Name> | ..."
const WHITER_RE_STRICT = /^(?:How to get )?Mystic (?:Enchant|Scroll):\s*(.+?)\s*\|/i;
const WHITER_RE_LOOSE  = /^(?:How to get )?Mystic (?:Enchant|Scroll)\s+(.+?):?\s*\|/i;
// Shadowmeld GG title pattern:
//   "how to get <NAME> in Warcraft reborn - ascension bronzebeard! [optional flair]"
const SHADOWMELD_RE = /^how to get\s+(.+?)\s+in\s+[Ww]arcraft\s+[Rr]eborn/i;

const RANK_RE = /\s*[#(]?(\d+)\)?\s*$/;     // " (2)" or " #2"
const FACTION_RE = /\s*(?:as\s+|[#(]\s*)?(Alliance|Horde)(?:\s+[Vv]ersion)?\s*\)?\s*$/i;
const FLAIR_RE = /\s*(?:UPDATED(?:\s+\w+){0,3}|NEW\s+SPOT|A\+H|EASY|FAST)\s*$/i;

// Patterns that indicate a video is about a gear item (BiS libram, ring,
// trinket, etc.) rather than a mystic enchant — skip these entirely.
const NON_ME_RE = /\b(BiS|BEST IN SLOT|LIBRAM|TRINKET|RING|POLEARM|DAGGER|STAFF|EPIC POLEARM|EPIC DAGGER|WF (?:Dagger|Polearm|Staff)|Spell Penetration)\b/i;

function parseTitle(title, source) {
  if (NON_ME_RE.test(title)) return null;
  let m;
  if (source === 'shadowmeld') {
    m = title.match(SHADOWMELD_RE);
  } else {
    m = title.match(WHITER_RE_STRICT) || title.match(WHITER_RE_LOOSE);
  }
  if (!m) return null;
  let name = m[1];
  // Strip trailing flair like "UPDATED NEW SPOT", "A+H", etc.
  while (FLAIR_RE.test(name)) name = name.replace(FLAIR_RE, '').trim();
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
const seen = new Set();
for (const { class: cls, id, source } of PLAYLISTS) {
  console.log(`-- ${source}/${cls} (${id})`);
  const rows = listPlaylist(id);
  console.log(`   ${rows.length} videos`);
  for (const r of rows) {
    if (seen.has(r.videoId)) continue;
    seen.add(r.videoId);
    const parsed = parseTitle(r.title, source);
    if (!parsed) { skipped.push({ source, class: cls, ...r, reason: 'no_me_title' }); continue; }
    videos.push({
      videoId: r.videoId,
      url: `https://www.youtube.com/watch?v=${r.videoId}`,
      title: r.title,
      class: cls,
      source,
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
