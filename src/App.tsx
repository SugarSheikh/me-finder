import { useEffect, useMemo, useState } from 'react';
import type { ME, ClassKey, Rarity, VideoRef } from './types';
import { CLASS_ORDER, CLASS_COLOR, RARITY_COLOR, iconUrl, levelDisplay, rarityRank } from './util';
import './App.css';

type Filters = {
  cls: ClassKey | null;
  rarities: Set<Rarity>;
  spec: string | null;
  q: string;
  withVideoOnly: boolean;
};

const ALL_RARITIES: Rarity[] = ['artifact', 'legendary', 'epic', 'rare'];

export default function App() {
  const [mes, setMes] = useState<ME[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    cls: null,
    rarities: new Set(ALL_RARITIES),
    spec: null,
    q: '',
    withVideoOnly: false,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/mes.json`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((data: ME[]) => setMes(data))
      .catch(e => setError(String(e)));
  }, []);

  const specsForClass = useMemo<string[]>(() => {
    if (!mes || !filters.cls) return [];
    const set = new Set<string>();
    for (const m of mes) if (m.class === filters.cls) for (const s of m.specs) set.add(s);
    return [...set].sort();
  }, [mes, filters.cls]);

  const filtered = useMemo<ME[]>(() => {
    if (!mes) return [];
    const q = filters.q.trim().toLowerCase();
    let list = mes;
    if (filters.cls) list = list.filter(m => m.class === filters.cls);
    list = list.filter(m => filters.rarities.has(m.rarity));
    if (filters.spec) list = list.filter(m => m.specs.includes(filters.spec!));
    if (q) list = list.filter(m =>
      m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q));
    if (filters.withVideoOnly) list = list.filter(m => m.videos.length > 0);
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

  return (
    <div className="app">
      <aside className="sidebar">
        <header>
          <h1>Bronzebeard ME Finder</h1>
          <p className="tagline">Filter the catalog · find the video · go get it.</p>
        </header>

        <section>
          <h3>Class</h3>
          <div className="chip-grid">
            <button
              className={`chip${filters.cls === null ? ' on' : ''}`}
              onClick={() => setFilters(f => ({ ...f, cls: null, spec: null }))}
            >All</button>
            {CLASS_ORDER.map(c => (
              <button
                key={c}
                className={`chip${filters.cls === c ? ' on' : ''}`}
                style={filters.cls === c ? { borderColor: CLASS_COLOR[c], color: CLASS_COLOR[c] } : undefined}
                onClick={() => setFilters(f => ({ ...f, cls: c, spec: null }))}
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
        {filtered.length === 0
          ? <div className="empty">No MEs match these filters.</div>
          : filtered.map(m => (
            <MeCard
              key={m.id}
              me={m}
              selected={m.id === selectedId}
              onClick={() => setSelectedId(m.id)}
            />
          ))}
      </main>

      <aside className="detail-pane">
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

      <h3>{me.videos.length === 0 ? 'No video yet' : me.videos.length === 1 ? 'How to get it' : `Videos (${me.videos.length})`}</h3>
      {me.videos.length === 0 ? (
        <p className="muted small">No how-to-find video has been catalogued for this ME yet.</p>
      ) : (
        <div className="video-grid">
          {me.videos.map(v => <VideoEmbed key={v.videoId} v={v} />)}
        </div>
      )}
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
