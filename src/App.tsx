import { useEffect, useMemo, useState } from 'react';
import type { ME, ClassKey, Rarity, VideoRef, Location } from './types';
import { CLASS_ORDER, CLASS_COLOR, RARITY_COLOR, iconUrl, levelDisplay, rarityRank } from './util';
import './App.css';

const CONTINENT_MAPS: Record<string, { src: string; label: string }> = {
  'kalimdor': { src: 'maps/kalimdor.png', label: 'Kalimdor' },
  'eastern-kingdoms': { src: 'maps/eastern_kingdoms.png', label: 'Eastern Kingdoms' },
};

// Loaded once at startup. Maps zoneId -> static path of a zone-level image.
// Zones not in this manifest fall back to a continent-map crop using zoneBounds.
let ZONE_MAPS: Record<string, string> = {};

type Filters = {
  cls: ClassKey | null;
  rarities: Set<Rarity>;
  spec: string | null;
  zoneId: string | null;
  q: string;
  withVideoOnly: boolean;
  hideNoData: boolean;
};

const ALL_RARITIES: Rarity[] = ['artifact', 'legendary', 'epic', 'rare'];

export default function App() {
  const [mes, setMes] = useState<ME[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    cls: null,
    rarities: new Set(ALL_RARITIES),
    spec: null,
    zoneId: null,
    q: '',
    withVideoOnly: false,
    hideNoData: false,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const selectMe = (id: string) => { setSelectedId(id); setMobileView('detail'); };

  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}data/mes.json`).then(r => r.json()),
      fetch(`${import.meta.env.BASE_URL}data/zone_maps.json`).then(r => r.ok ? r.json() : {}),
    ])
      .then(([mes, zoneMaps]: [ME[], Record<string, string>]) => {
        ZONE_MAPS = zoneMaps;
        setMes(mes);
      })
      .catch(e => setError(String(e)));
  }, []);

  const specsForClass = useMemo<string[]>(() => {
    if (!mes || !filters.cls) return [];
    const set = new Set<string>();
    for (const m of mes) if (m.class === filters.cls) for (const s of m.specs) set.add(s);
    return [...set].sort();
  }, [mes, filters.cls]);

  // All distinct zones across all MEs' locations, with ME counts.
  // Filtered by class when a class is selected so the dropdown stays relevant.
  const zonesAvailable = useMemo<{ id: string; name: string; count: number }[]>(() => {
    if (!mes) return [];
    const counts = new Map<string, { name: string; count: number }>();
    for (const m of mes) {
      if (filters.cls && m.class !== filters.cls) continue;
      const seen = new Set<string>();
      for (const l of m.locations) {
        if (seen.has(l.zoneId)) continue;
        seen.add(l.zoneId);
        const entry = counts.get(l.zoneId);
        if (entry) entry.count++;
        else counts.set(l.zoneId, { name: l.zoneName, count: 1 });
      }
    }
    return [...counts.entries()]
      .map(([id, { name, count }]) => ({ id, name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [mes, filters.cls]);

  const filtered = useMemo<ME[]>(() => {
    if (!mes) return [];
    const q = filters.q.trim().toLowerCase();
    let list = mes;
    if (filters.cls) list = list.filter(m => m.class === filters.cls);
    list = list.filter(m => filters.rarities.has(m.rarity));
    if (filters.spec) list = list.filter(m => m.specs.includes(filters.spec!));
    if (filters.zoneId) list = list.filter(m => m.locations.some(l => l.zoneId === filters.zoneId));
    if (q) list = list.filter(m =>
      m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q));
    if (filters.withVideoOnly) list = list.filter(m => m.videos.length > 0);
    if (filters.hideNoData) list = list.filter(m => m.videos.length > 0 || m.locations.length > 0);
    return list.slice().sort((a, b) => {
      const ra = rarityRank(a.rarity), rb = rarityRank(b.rarity);
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });
  }, [mes, filters]);

  const selected: ME | null = useMemo(() => {
    if (!mes || !selectedId) return null;
    return mes.find(m => m.id === selectedId) || null;
  }, [mes, selectedId]);

  if (error) return <div className="error">Failed to load data: {error}</div>;
  if (!mes) return <div className="loading">Loading…</div>;

  const appClass = `app${mobileView === 'detail' ? ' show-detail' : ' show-list'}${filtersOpen ? ' filters-open' : ''}`;
  return (
    <div className={appClass}>
      {filtersOpen && <div className="backdrop" onClick={() => setFiltersOpen(false)} />}
      <aside className="sidebar">
        <header>
          <div className="sidebar-top">
            <div>
              <h1>Bronzebeard ME Finder</h1>
              <p className="tagline">Filter the catalog · find the video · go get it.</p>
            </div>
            <button className="mobile-close" onClick={() => setFiltersOpen(false)} aria-label="Close filters">✕</button>
          </div>
        </header>

        <section>
          <h3>Class</h3>
          <div className="chip-grid">
            <button
              className={`chip${filters.cls === null ? ' on' : ''}`}
              onClick={() => setFilters(f => ({ ...f, cls: null, spec: null, zoneId: null }))}
            >All</button>
            {CLASS_ORDER.map(c => (
              <button
                key={c}
                className={`chip${filters.cls === c ? ' on' : ''}`}
                style={filters.cls === c ? { borderColor: CLASS_COLOR[c], color: CLASS_COLOR[c] } : undefined}
                onClick={() => setFilters(f => ({ ...f, cls: c, spec: null, zoneId: null }))}
              >{cap(c)}</button>
            ))}
          </div>
        </section>

        <section>
          <h3>Rarity</h3>
          <div className="chip-grid">
            {ALL_RARITIES.map(r => {
              const on = filters.rarities.has(r);
              return (
                <button
                  key={r}
                  className={`chip${on ? ' on' : ''}`}
                  style={on ? { borderColor: RARITY_COLOR[r], color: RARITY_COLOR[r] } : undefined}
                  onClick={() => setFilters(f => {
                    const next = new Set(f.rarities);
                    if (next.has(r)) next.delete(r); else next.add(r);
                    if (next.size === 0) ALL_RARITIES.forEach(x => next.add(x));
                    return { ...f, rarities: next };
                  })}
                >{cap(r)}</button>
              );
            })}
          </div>
        </section>

        {filters.cls && specsForClass.length > 0 && (
          <section>
            <h3>Spec</h3>
            <div className="chip-grid">
              <button
                className={`chip${filters.spec === null ? ' on' : ''}`}
                onClick={() => setFilters(f => ({ ...f, spec: null }))}
              >Any</button>
              {specsForClass.map(s => (
                <button
                  key={s}
                  className={`chip${filters.spec === s ? ' on' : ''}`}
                  onClick={() => setFilters(f => ({ ...f, spec: s }))}
                >{prettySpec(s)}</button>
              ))}
            </div>
          </section>
        )}

        <section>
          <h3>Zone {filters.zoneId && <button className="clear-link" onClick={() => setFilters(f => ({ ...f, zoneId: null }))}>clear</button>}</h3>
          <select
            className="dropdown"
            value={filters.zoneId ?? ''}
            onChange={e => setFilters(f => ({ ...f, zoneId: e.target.value || null }))}
          >
            <option value="">Any zone</option>
            {zonesAvailable.map(z => (
              <option key={z.id} value={z.id}>{z.name} ({z.count})</option>
            ))}
          </select>
        </section>

        <section>
          <h3>Search</h3>
          <input
            className="search"
            type="search"
            placeholder="Name or description…"
            value={filters.q}
            onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}
          />
        </section>

        <section>
          <label className="toggle">
            <input
              type="checkbox"
              checked={filters.hideNoData}
              onChange={e => setFilters(f => ({ ...f, hideNoData: e.target.checked }))}
            /> Hide MEs with no data
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={filters.withVideoOnly}
              onChange={e => setFilters(f => ({ ...f, withVideoOnly: e.target.checked }))}
            /> Only show MEs with a video
          </label>
        </section>

        <footer className="muted small">
          {filtered.length} of {mes.length} shown · {mes.filter(m => m.videos.length > 0).length} have videos
        </footer>
      </aside>

      <main className="list-pane">
        <header className="mobile-bar">
          <button className="mobile-btn" onClick={() => setFiltersOpen(true)}>
            <span aria-hidden>☰</span> Filters
          </button>
          <span className="mobile-bar-info">{filtered.length} of {mes.length}</span>
        </header>
        {filtered.length === 0
          ? <div className="empty">No MEs match these filters.</div>
          : filtered.map(m => (
            <MeCard
              key={m.id}
              me={m}
              selected={m.id === selectedId}
              onClick={() => selectMe(m.id)}
            />
          ))}
      </main>

      <aside className="detail-pane">
        <header className="mobile-bar">
          <button className="mobile-btn" onClick={() => setMobileView('list')}>
            <span aria-hidden>←</span> Back
          </button>
        </header>
        {selected ? <MeDetail me={selected} /> : <div className="muted center pad">Pick an ME to see details + video.</div>}
      </aside>
    </div>
  );
}

function MeCard({ me, selected, onClick }: { me: ME; selected: boolean; onClick: () => void }) {
  return (
    <button className={`card${selected ? ' selected' : ''}`} onClick={onClick}>
      <img className="icon" src={iconUrl(me.icon)} alt="" loading="lazy"
        onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0.2'; }} />
      <div className="card-body">
        <div className="card-title" style={{ color: RARITY_COLOR[me.rarity] }}>
          {me.name}
        </div>
        <div className="card-meta">
          <span className="badge" style={{ color: CLASS_COLOR[me.class] }}>{me.classLabel}</span>
          <span className="badge dim">{me.rarityLabel}</span>
          <span className="badge dim">{levelDisplay(me)}</span>
          {me.specs.map(s => <span key={s} className="badge dim">{prettySpec(s)}</span>)}
          {me.videos.length > 0 && <span className="badge video">▶ {me.videos.length}</span>}
          {me.locations.length > 0 && <span className="badge location">📍 {me.locations.length}</span>}
          {me.source === 'community' && <span className="badge community" title="Not in bisbeard's catalog — sourced from azerothhub markers + Whiter videos">Community</span>}
        </div>
      </div>
    </button>
  );
}

function MeDetail({ me }: { me: ME }) {
  return (
    <div className="detail">
      <div className="detail-head">
        <img className="icon-big" src={iconUrl(me.icon)} alt=""
          onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0.2'; }} />
        <div>
          <h2 style={{ color: RARITY_COLOR[me.rarity] }}>{me.name}</h2>
          <div className="detail-meta">
            <span className="badge" style={{ color: CLASS_COLOR[me.class] }}>{me.classLabel}</span>
            <span className="badge" style={{ color: RARITY_COLOR[me.rarity] }}>{me.rarityLabel}</span>
            <span className="badge dim">{levelDisplay(me)}</span>
            {me.specs.map(s => <span key={s} className="badge dim">{prettySpec(s)}</span>)}
            {me.source === 'community' && <span className="badge community" title="Not in bisbeard's catalog — sourced from azerothhub markers + Whiter videos">Community</span>}
          </div>
        </div>
      </div>

      <p className="description">{me.description}</p>

      {me.requiredTabs && me.requiredTabs.length > 0 && (
        <div className="requires">
          <strong>Requires:</strong>{' '}
          {me.requiredTabs.map((t, i) => (
            <span key={i}>{i > 0 ? ' · ' : ''}{t.investment} points in {t.tab}</span>
          ))}
        </div>
      )}

      <LocationSection locations={me.locations} />

      <h3>{me.videos.length === 0 ? 'No video yet' : me.videos.length === 1 ? 'How to get it' : `Videos (${me.videos.length})`}</h3>
      {me.videos.length === 0 ? (
        <p className="muted small">{me.locations.length > 0 ? 'No video yet — see locations above.' : 'No how-to-find video or pin location catalogued yet.'}</p>
      ) : (
        <div className="video-grid">
          {me.videos.map(v => <VideoEmbed key={v.videoId} v={v} />)}
        </div>
      )}
    </div>
  );
}

function LocationSection({ locations }: { locations: Location[] }) {
  const [activeLoc, setActiveLoc] = useState<number>(0);
  if (locations.length === 0) return null;
  const active = locations[Math.min(activeLoc, locations.length - 1)];

  return (
    <div className="locations">
      <h3>Locations ({locations.length})</h3>

      <ZoneZoomMap location={active} />

      <ContinentOverview locations={locations} activeIdx={activeLoc} onSelect={setActiveLoc} />

      <div className="location-list">
        {locations.map((loc, i) => (
          <button
            key={i}
            className={`location-card${activeLoc === i ? ' selected' : ''}`}
            onClick={() => setActiveLoc(i)}
            type="button"
          >
            <div className="location-head">
              <span className="location-num">{i + 1}</span>
              <span className="location-zone">{loc.zoneName}</span>
              <span className="muted small">{loc.rawTop.toFixed(1)}, {loc.rawLeft.toFixed(1)}</span>
            </div>
            {loc.description && <p className="location-desc">{loc.description}</p>}
            {loc.resources.length > 0 && (
              <div className="location-resources">
                {loc.resources.map((r, j) => (
                  <a
                    key={j}
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                  >
                    {r.label} ↗
                  </a>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function VideoEmbed({ v }: { v: VideoRef }) {
  const [playing, setPlaying] = useState(false);
  const thumb = `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;
  return (
    <div className="video">
      <div className="video-frame">
        {playing ? (
          <iframe
            src={`https://www.youtube.com/embed/${v.videoId}?autoplay=1`}
            title={v.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            className="video-play"
            onClick={() => setPlaying(true)}
            aria-label={`Play video for ${v.title}`}
          >
            <img src={thumb} alt="" loading="lazy"
              onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0.2'; }} />
            <span className="video-play-icon" aria-hidden>▶</span>
          </button>
        )}
      </div>
      <div className="video-caption">
        {v.rank ? <span className="badge dim">Rank {v.rank}</span> : null}
        {v.faction ? <span className="badge dim">{cap(v.faction)}</span> : null}
        <a href={v.url} target="_blank" rel="noreferrer">Watch on YouTube ↗</a>
      </div>
    </div>
  );
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); }
function prettySpec(s: string) { return s.charAt(0) + s.slice(1).toLowerCase(); }

// Zone-level zoom map. Only rendered when a zone-level image exists for the
// selected location's zone. For zones without an image (29/52 currently),
// users still see the pin on the continent overview below.
function ZoneZoomMap({ location }: { location: Location }) {
  const zoneSrc = ZONE_MAPS[location.zoneId];
  const base = import.meta.env.BASE_URL;
  if (!zoneSrc) {
    return (
      <div className="zone-zoom">
        <div className="zone-zoom-label">{location.zoneName}</div>
        <div className="zone-zoom-empty">
          No zone-level map for {location.zoneName} yet — pin shown on the continent overview below.
        </div>
      </div>
    );
  }
  return (
    <div className="zone-zoom">
      <div className="zone-zoom-label">{location.zoneName}</div>
      <div className="zone-zoom-frame">
        <img src={`${base}${zoneSrc}`} alt={location.zoneName} />
        <button
          className="pin active"
          style={{ top: `${location.rawTop}%`, left: `${location.rawLeft}%` }}
          disabled
          aria-hidden
        >
          <span className="pin-dot" />
        </button>
      </div>
    </div>
  );
}

// Smaller continent overview with all pins — keeps the global "where in the world" view.
function ContinentOverview({ locations, activeIdx, onSelect }:
  { locations: Location[]; activeIdx: number; onSelect: (i: number) => void }) {
  const byContinent = new Map<string, number[]>();
  for (let i = 0; i < locations.length; i++) {
    const c = locations[i].continent;
    if (!c) continue; // sub-zone marker — pin only on the zone-level map
    if (!byContinent.has(c)) byContinent.set(c, []);
    byContinent.get(c)!.push(i);
  }
  if (byContinent.size === 0) return null;
  const base = import.meta.env.BASE_URL;
  return (
    <div className="continent-overview">
      {[...byContinent.entries()].map(([continent, idxs]) => {
        const map = CONTINENT_MAPS[continent];
        if (!map) return null;
        return (
          <div key={continent} className="continent-thumb">
            <div className="continent-label">{map.label}</div>
            <div className="continent-map">
              <img src={`${base}${map.src}`} alt={map.label} loading="lazy" />
              {idxs.map(i => {
                const loc = locations[i];
                const isActive = activeIdx === i;
                return (
                  <button
                    key={i}
                    className={`pin small${isActive ? ' active' : ''}`}
                    style={{ top: `${loc.top}%`, left: `${loc.left}%` }}
                    onClick={() => onSelect(i)}
                    title={loc.zoneName}
                    aria-label={`Pin ${i + 1} in ${loc.zoneName}`}
                  >
                    <span className="pin-dot" />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
