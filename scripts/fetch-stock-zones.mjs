// Backfill the stock 3.3.5a zones that aren't in Bronzebeard's MPQ stack
// (BB stripped Interface/WorldMap/* from common.MPQ — they ship custom maps
// for their content but rely on the player's own stock client for vanilla).
//
// Source: github.com/Gethe/wow-ui-textures, branch `classic`, which is a
// pre-extracted PNG mirror of the WoW Classic UI textures including 12-tile
// zone maps under WorldMap/<Dir>/<Dir>{1..12}.PNG.
import sharp from 'sharp';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'https://raw.githubusercontent.com/Gethe/wow-ui-textures/classic/WorldMap';
const OUT_DIR = 'public/maps/zones';
mkdirSync(OUT_DIR, { recursive: true });

// azerothhub slug -> { dir, tile } where dir is the GitHub folder name and
// tile is the per-tile file prefix (sometimes differs in case from dir).
const SLUG_TO_GETHE = {
  'elwynn-forest': { dir: 'Elwynn', tile: 'Elwynn' },
  'the-barrens': { dir: 'Barrens', tile: 'Barrens' },
  'stormwind-city': { dir: 'StormwindCity', tile: 'StormwindCity' },
  'thunder-bluff': { dir: 'ThunderBluff', tile: 'ThunderBluff' },
  'stranglethorn-vale': { dir: 'StranglethornVale', tile: 'StranglethornVale' },
  'ungoro-crater': { dir: 'UngoroCrater', tile: 'UngoroCrater' },
  'hillsbrad-foothills': { dir: 'HillsbradFoothills', tile: 'HillsbradFoothills' },
  'alterac-mountains': { dir: 'Alterac', tile: 'Alterac' },
  'arathi-highlands': { dir: 'Arathi', tile: 'Arathi' },
  'blasted-lands': { dir: 'BLASTEDLANDS', tile: 'BlastedLands' },
  'burning-steppes': { dir: 'BurningSteppes', tile: 'BurningSteppes' },
  'coldridge-valley': { dir: 'ColdridgeValley', tile: 'ColdridgeValley' },
  'deadwind-pass': { dir: 'DeadwindPass', tile: 'DeadwindPass' },
  'deathknell': { dir: 'DeathknellStart', tile: 'DeathknellStart' },
  'dun-morogh': { dir: 'DunMorogh', tile: 'DunMorogh' },
  'dustwallow-marsh': { dir: 'Dustwallow', tile: 'Dustwallow' },
  'eastern-plaguelands': { dir: 'EasternPlaguelands', tile: 'EasternPlaguelands' },
  'loch-modan': { dir: 'LochModan', tile: 'LochModan' },
  // 'red-cloud-mesa' has no standalone map in stock 3.3.5a (sub-area of Mulgore).
  // 'valley-of-trials' similarly is a sub-area of Durotar.
  'redridge-mountains': { dir: 'Redridge', tile: 'Redridge' },
  'searing-gorge': { dir: 'SearingGorge', tile: 'SearingGorge' },
  'silverpine-forest': { dir: 'Silverpine', tile: 'Silverpine' },
  'stonetalon-mountains': { dir: 'StonetalonMountains', tile: 'StonetalonMountains' },
  'swamp-of-sorrows': { dir: 'SwampOfSorrows', tile: 'SwampOfSorrows' },
  'the-hinterlands': { dir: 'Hinterlands', tile: 'Hinterlands' },
  'thousand-needles': { dir: 'Thousandneedles', tile: 'ThousandNeedles' },
  'tirisfal-glades': { dir: 'Tirisfal', tile: 'Tirisfal' },
  'western-plaguelands': { dir: 'WesternPlaguelands', tile: 'WesternPlaguelands' },
};

const OUTPUT_WIDTH = 768;
const JPEG_QUALITY = 85;
const TILE_COLS = 4;
const TILE_ROWS = 3;

async function fetchBuf(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

let extracted = 0;
const failed = [];

for (const [slug, { dir, tile }] of Object.entries(SLUG_TO_GETHE)) {
  const outPath = join(OUT_DIR, `${slug}.jpg`);
  if (existsSync(outPath)) { console.log(`  skip: ${slug} already exists`); continue; }

  // Pull all 12 tiles in parallel
  const tilePromises = [];
  for (let i = 1; i <= 12; i++) {
    const url = `${BASE}/${dir}/${tile}${i}.PNG`;
    tilePromises.push(fetchBuf(url).then(buf => ({ i, buf })).catch(e => ({ i, err: e.message })));
  }
  const tiles = await Promise.all(tilePromises);
  const errs = tiles.filter(t => t.err);
  if (errs.length) {
    console.log(`  ${slug}: ${errs.length}/12 missing tiles - ${errs.map(e => `t${e.i}:${e.err}`).join(', ')}`);
    failed.push(slug);
    continue;
  }

  // Decode each PNG with sharp to get dimensions + raw pixels
  const decoded = [];
  for (const { i, buf } of tiles) {
    const img = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    decoded.push({ i, data: img.data, info: img.info });
  }
  const tileSize = decoded[0].info.width;
  if (decoded.some(d => d.info.width !== tileSize || d.info.height !== tileSize)) {
    console.log(`  ${slug}: tiles inconsistent — skipping`);
    failed.push(slug);
    continue;
  }

  // Stitch
  const W = TILE_COLS * tileSize;
  const H = TILE_ROWS * tileSize;
  const composite = Buffer.alloc(W * H * 4);
  for (const { i, data } of decoded) {
    const idx0 = i - 1;
    const col = idx0 % TILE_COLS;
    const row = Math.floor(idx0 / TILE_COLS);
    const dstX = col * tileSize;
    const dstY = row * tileSize;
    for (let y = 0; y < tileSize; y++) {
      const srcRow = y * tileSize * 4;
      const dstRow = ((dstY + y) * W + dstX) * 4;
      data.copy(composite, dstRow, srcRow, srcRow + tileSize * 4);
    }
  }

  const buf = await sharp(composite, { raw: { width: W, height: H, channels: 4 } })
    .resize(OUTPUT_WIDTH)
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
  writeFileSync(outPath, buf);
  extracted++;
  console.log(`  ${slug} (${dir}/${tile}): ${tileSize}px tiles -> ${buf.length} B`);
}

console.log(`\nExtracted: ${extracted}`);
console.log(`Failed: ${failed.length} (${failed.join(', ')})`);
