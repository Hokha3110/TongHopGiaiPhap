import { memo, useMemo, useState } from 'react';
import {
  Activity, ArrowRight, ArrowUpRight, Bookmark, Clock3, Code2, FileText,
  Fingerprint, FlaskConical, Gauge, Grid2X2, LockKeyhole, Radar, Search, Shield,
} from 'lucide-react';
import { groups } from './data/catalog.js';
import { entryBrandLogo } from './data/brandAssets.js';
import { mediaUrl } from './lib/libraryApi.js';
import './library-catalog.css';

const EMPTY = [];
const groupIcons = { lock: LockKeyhole, activity: Activity, flask: FlaskConical, code: Code2, fingerprint: Fingerprint, gauge: Gauge, search: Search, shield: Shield, radar: Radar };
const groupColors = { cnapp: '#b9eb79', soc: '#61d9e2', labs: '#b9a2f5', devsecops: '#81b9ff', config: '#e9c482', quality: '#f5a2b9', osint: '#97b1fb', data: '#6fe0ba', risk: '#f4ad85' };
const categories = groups.filter(group => group.id !== 'all').map(group => ({ ...group, Icon: groupIcons[group.icon] || Shield, accent: groupColors[group.id] || '#a5c4cc' }));
const otherCategory = { id: 'other', name: 'Các giải pháp khác', short: 'Giải pháp khác', Icon: Grid2X2, accent: '#a5c4cc' };
const categoryById = new Map(categories.map(group => [group.id, group]));

function Highlight({ value = '', searchTerm = '' }) {
  const text = String(value);
  const term = searchTerm.trim();
  const index = term ? text.toLocaleLowerCase('vi').indexOf(term.toLocaleLowerCase('vi')) : -1;
  if (index < 0) return text;
  return <>{text.slice(0, index)}<mark>{text.slice(index, index + term.length)}</mark>{text.slice(index + term.length)}</>;
}

const Artwork = memo(function Artwork({ entry, Icon, className = '' }) {
  const src = mediaUrl(entryBrandLogo(entry));
  const [failedSrc, setFailedSrc] = useState(null);
  return src && failedSrc !== src
    ? <img className={className} src={src} alt="" aria-hidden="true" loading="lazy" decoding="async" draggable="false" onError={() => setFailedSrc(src)}/>
    : <Icon className={`${className} is-placeholder`} aria-hidden="true" strokeWidth={.8}/>;
});

const SolutionCard = memo(function SolutionCard({ entry, category, saved, onOpen, onDocuments, onToggleSave, searchTerm }) {
  const tags = Array.isArray(entry.tags) ? entry.tags.filter(tag => typeof tag === 'string' && tag.trim()).slice(0, 3) : EMPTY;
  const documentCount = entry.documentCount == null ? null : Math.max(0, Number(entry.documentCount) || 0);
  const name = entry.name || 'Giải pháp chưa đặt tên';
  return <article className={`lc-card${saved ? ' is-saved' : ''}`}>
    <button className="lc-card__open" type="button" onClick={() => onOpen?.(entry)} aria-label={`Khám phá ${name}`}>
      <Artwork entry={entry} Icon={category.Icon} className="lc-card__artwork"/>
      <span className="lc-card__scrim" aria-hidden="true"/>
      <span className="lc-card__eyebrow"><category.Icon size={13}/>{category.short}</span>
      <span className="lc-card__copy"><strong><Highlight value={name} searchTerm={searchTerm}/></strong><span className="lc-card__description"><Highlight value={entry.desc || 'Khám phá thông tin giải pháp và tài liệu trong thư viện.'} searchTerm={searchTerm}/></span><span className="lc-card__tags">{tags.map((tag, index) => <span key={`${tag}-${index}`}><Highlight value={tag} searchTerm={searchTerm}/></span>)}</span></span>
      <span className="lc-card__explore">Khám phá giải pháp<ArrowUpRight size={17}/></span>
    </button>
    <button className={`lc-card__bookmark${saved ? ' is-saved' : ''}`} type="button" onClick={() => onToggleSave?.(entry.id)} aria-label={`${saved ? 'Bỏ lưu' : 'Lưu'} ${name}`} title={saved ? 'Bỏ lưu giải pháp' : 'Lưu để xem lại'} aria-pressed={saved}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'}/></button>
    <div className="lc-card__footer"><span><FileText size={13}/>{documentCount == null ? 'Thư viện tài liệu' : `${documentCount} tài liệu`}</span><button className="lc-card__documents" type="button" onClick={() => onDocuments?.(entry)} aria-label={`Xem tài liệu ${name}`}>Xem tài liệu<ArrowRight size={14}/></button></div>
  </article>;
});

export default function LibraryCatalog({ entries = EMPTY, savedIds = EMPTY, view = 'grid', onOpen, onDocuments, onToggleSave, searchTerm = '' }) {
  const grouped = useMemo(() => {
    const buckets = new Map();
    for (const entry of entries) {
      const category = categoryById.get(entry.group) || otherCategory;
      if (!buckets.has(category.id)) buckets.set(category.id, []);
      buckets.get(category.id).push(entry);
    }
    return [...categories, otherCategory].filter(category => buckets.has(category.id)).map(category => ({ ...category, entries: buckets.get(category.id) }));
  }, [entries]);
  const savedSet = useMemo(() => savedIds instanceof Set ? savedIds : new Set(savedIds), [savedIds]);
  return <div className={`lc-catalog${view === 'list' ? ' is-list' : ''}`} aria-label="Giải pháp theo lĩnh vực">
    {grouped.map(category => <section className="lc-group" key={category.id} style={{ '--lc-accent': category.accent }} aria-label={category.name}>
      <header className="lc-group__heading"><span className="lc-group__icon"><category.Icon size={20}/></span><div><span>LĨNH VỰC GIẢI PHÁP</span><h3>{category.name}</h3></div><span className="lc-group__count">{String(category.entries.length).padStart(2, '0')}<small>GIẢI PHÁP</small></span></header>
      <div className="lc-grid">{category.entries.map(entry => <SolutionCard key={entry.id} entry={entry} category={category} saved={savedSet.has(entry.id)} onOpen={onOpen} onDocuments={onDocuments} onToggleSave={onToggleSave} searchTerm={searchTerm}/>)}</div>
    </section>)}
  </div>;
}

export function RecentSolutions({ entries = EMPTY, onOpen, onClear }) {
  if (!entries.length) return null;
  return <section className="lc-recent" aria-labelledby="lc-recent-heading"><header className="lc-recent__heading"><h2 id="lc-recent-heading"><Clock3 size={17}/>Xem gần đây</h2>{onClear && <button type="button" onClick={onClear}>Xóa lịch sử</button>}</header><div className="lc-recent__grid">{entries.slice(0, 4).map(entry => {
    const category = categoryById.get(entry.group) || otherCategory;
    return <button key={entry.id} type="button" className="lc-recent__item" style={{ '--lc-accent': category.accent }} onClick={() => onOpen?.(entry)}><span className="lc-recent__artwork"><Artwork entry={entry} Icon={category.Icon} className="lc-recent__logo"/></span><span className="lc-recent__copy"><strong>{entry.name || 'Giải pháp chưa đặt tên'}</strong><small>{category.short}</small></span><ArrowUpRight size={16}/></button>;
  })}</div></section>;
}
