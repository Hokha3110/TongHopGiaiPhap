import { useState } from 'react';
import {
  Activity, ArrowUpRight, Code2, FileText, Fingerprint, FlaskConical,
  FolderOpen, Gauge, Grid2X2, LockKeyhole, PencilLine, Radar, RotateCcw,
  Search, Shield, Trash2,
} from 'lucide-react';
import { groups } from './data/catalog.js';
import { entryBrandLogo } from './data/brandAssets.js';
import { mediaUrl } from './Article.jsx';
import './admin-entry-browser.css';

const groupIcons = { lock: LockKeyhole, activity: Activity, flask: FlaskConical, code: Code2, fingerprint: Fingerprint, gauge: Gauge, search: Search, shield: Shield, radar: Radar };
const groupColors = { cnapp: '#b9eb79', soc: '#61d9e2', labs: '#b9a2f5', devsecops: '#81b9ff', config: '#e9c482', quality: '#f5a2b9', osint: '#97b1fb', data: '#6fe0ba', risk: '#f4ad85' };
const categories = [
  ...groups.filter(group => group.id !== 'all').map(group => ({ ...group, Icon: groupIcons[group.icon] || Shield, accent: groupColors[group.id] })),
  { id: 'collections', name: 'Thư viện & tài liệu dùng chung', short: 'Tài liệu dùng chung', Icon: FolderOpen, accent: '#9fbec6' },
  { id: 'other', name: 'Giải pháp chưa phân loại', short: 'Chưa phân loại', Icon: Grid2X2, accent: '#9fbec6' },
];
const categoryId = entry => entry.kind === 'collection' ? 'collections' : groups.some(group => group.id === entry.group && group.id !== 'all') ? entry.group : 'other';

function EntryArtwork({ row, Icon }) {
  const src = mediaUrl(entryBrandLogo({ ...row.draft, id: row.id }));
  const [failedSrc, setFailedSrc] = useState(null);
  return src && failedSrc !== src
    ? <img className="admin-content-card__watermark" src={src} alt="" aria-hidden="true" loading="lazy" draggable="false" onError={() => setFailedSrc(src)}/>
    : <Icon className="admin-content-card__watermark is-placeholder" aria-hidden="true" strokeWidth={.8}/>;
}

export default function AdminEntryBrowser({ entries, compact, selectedId, trash, loading, onEdit, onManage }) {
  const [filter, setFilter] = useState('all');
  const buckets = categories.map(category => ({ ...category, rows: entries.filter(row => categoryId(row.draft) === category.id) })).filter(category => category.rows.length);
  // Keep a selected category visible even when a search returns no matches in it.
  const filterOptions = filter === 'all' || buckets.some(category => category.id === filter)
    ? buckets : categories.filter(category => category.id === filter).map(category => ({ ...category, rows: [] })).concat(buckets);
  const visibleGroups = buckets.filter(category => filter === 'all' || category.id === filter);
  const count = visibleGroups.reduce((total, category) => total + category.rows.length, 0);

  return <section className={`admin-content-browser${compact ? ' is-compact' : ''}`} aria-label="Nội dung theo lĩnh vực">
    <header className="admin-content-browser__header">
      <div><h2>{trash ? 'Nội dung trong thùng rác' : 'Không gian nội dung'}</h2><p>{trash ? 'Khôi phục nội dung trước khi biên tập.' : 'Chọn một giải pháp để mở không gian biên tập.'}</p></div>
      <span className="admin-content-browser__count">{count} nội dung</span>
    </header>
    <div className="admin-content-filters" role="group" aria-label="Lọc lĩnh vực nội dung">
      <button type="button" className="admin-content-filter" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}><Grid2X2 size={14}/>Tất cả<span className="admin-content-filter__count">{entries.length}</span></button>
      {filterOptions.map(category => <button type="button" className="admin-content-filter" key={category.id} aria-pressed={filter === category.id} onClick={() => setFilter(category.id)} style={{ '--group-accent': category.accent }}><category.Icon size={14}/>{category.short}<span className="admin-content-filter__count">{category.rows.length}</span></button>)}
    </div>
    <div className="admin-content-groups">
      {visibleGroups.map(category => <section className="admin-content-group" key={category.id} style={{ '--group-accent': category.accent }} aria-labelledby={`admin-group-${category.id}`}>
        <header className="admin-content-group__heading">
          <span className="admin-content-group__icon"><category.Icon size={20}/></span>
          <div><span>{category.id === 'collections' ? 'THƯ VIỆN CHUNG' : 'LĨNH VỰC GIẢI PHÁP'}</span><h3 id={`admin-group-${category.id}`}>{category.name}</h3><p>{category.rows.filter(row => row.published).length} đã xuất bản · {category.rows.filter(row => !row.published).length} bản nháp</p></div>
          <span className="admin-content-group__count">{String(category.rows.length).padStart(2, '0')}</span>
        </header>
        <div className="admin-content-grid">
          {category.rows.map(row => <article key={row.id} className={`admin-content-card${selectedId === row.id ? ' is-selected' : ''}${row.deleted_at ? ' is-trashed' : ''}`}>
            <button type="button" className="admin-content-card__open" disabled={Boolean(row.deleted_at)} aria-label={`Chỉnh sửa ${row.draft.name}`} aria-pressed={selectedId === row.id} onClick={() => onEdit(row)}>
              <EntryArtwork row={row} Icon={category.Icon}/>
              <span className="admin-content-card__scrim" aria-hidden="true"/>
              <span className="admin-content-card__top"><span className={`admin-content-card__status ${row.deleted_at ? 'is-deleted' : row.published ? 'is-published' : 'is-draft'}`}>{row.deleted_at ? 'Đã đưa vào thùng rác' : row.published ? 'Đã xuất bản' : 'Bản nháp'}</span><small>Lần sửa {row.revision}</small></span>
              <span className="admin-content-card__copy"><strong>{row.draft.name}</strong><span className="admin-content-card__description">{row.draft.desc || 'Thêm bài viết và tài liệu cho nội dung này.'}</span><span className="admin-content-card__tags">{(row.draft.tags || []).filter(Boolean).slice(0,2).map((tag, index) => <span key={`${tag}-${index}`}>{tag}</span>)}</span></span>
              <span className="admin-content-card__cta"><PencilLine size={13}/>{row.deleted_at ? 'Khôi phục để chỉnh sửa' : 'Biên tập nội dung'}<ArrowUpRight size={16}/></span>
            </button>
            <div className="admin-content-card__actions">
              <span className="admin-content-card__revision">{row.draft.kind === 'collection' ? 'Thư viện' : 'Giải pháp'}</span>
              {row.deleted_at ? <button type="button" onClick={() => onManage(row, 'restore')} aria-label={`Khôi phục ${row.draft.name}`}><RotateCcw size={13}/> Khôi phục</button> : <>
                {row.published && <button type="button" onClick={() => onManage(row, 'unpublish')} aria-label={`Gỡ xuất bản ${row.draft.name}`}>Gỡ xuất bản</button>}
                <button type="button" className="admin-danger" onClick={() => onManage(row, 'trash')} aria-label={`Chuyển ${row.draft.name} vào thùng rác`} title="Chuyển vào thùng rác"><Trash2 size={14}/></button>
              </>}
            </div>
          </article>)}
        </div>
      </section>)}
      {!visibleGroups.length && <div className="admin-content-empty"><FileText size={28}/><h3>{loading ? 'Đang tải nội dung…' : 'Chưa có nội dung phù hợp'}</h3><p>{filter !== 'all' ? 'Chọn Tất cả hoặc thay đổi từ khóa tìm kiếm.' : 'Thử từ khóa khác hoặc tạo nội dung mới.'}</p>{filter !== 'all' && <button type="button" onClick={() => setFilter('all')}>Xem tất cả lĩnh vực</button>}</div>}
    </div>
  </section>;
}
