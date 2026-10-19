import { useDeferredValue, useId, useMemo, useState } from 'react';
import { AlertCircle, ArrowDownWideNarrow, Download, Eye, File, FileCode2, FileImage, FileSpreadsheet, FileText, FileVideo, FolderOpen, Presentation, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import ModalFrame from './ui/ModalFrame.jsx';
import './document-workspace.css';

const apiBase = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
const downloadUrl = value => /^https?:\/\//i.test(value || '') ? value : apiBase + (value || '');
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const sizeLabel = value => {
  const bytes = Math.max(0, Number(value) || 0);
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
};
const fileDate = value => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('vi-VN');
};
const fileInfo = document => {
  const ext = String(document.extension || document.name?.split('.').pop() || '').replace(/^\./, '').toLowerCase();
  if (ext === 'pdf') return { ext, type: 'pdf', Icon: FileText };
  if (['ppt', 'pptx', 'pptm', 'odp'].includes(ext)) return { ext, type: 'office', Icon: Presentation };
  if (['xls', 'xlsx', 'xlsm', 'ods'].includes(ext)) return { ext, type: 'office', Icon: FileSpreadsheet };
  if (['doc', 'docx', 'docm', 'odt', 'rtf'].includes(ext)) return { ext, type: 'office', Icon: FileText };
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(ext)) return { ext, type: 'image', Icon: FileImage };
  if (['mp4', 'mov', 'mkv', 'webm', 'wmv', 'avi'].includes(ext)) return { ext, type: 'video', Icon: FileVideo };
  if (['txt', 'md', 'csv', 'json', 'log', 'xml'].includes(ext)) return { ext, type: 'text', Icon: FileCode2 };
  return { ext, type: 'other', Icon: File };
};
const types = [['all', 'Tất cả'], ['pdf', 'PDF'], ['office', 'Office'], ['image', 'Hình ảnh'], ['video', 'Video'], ['text', 'Văn bản'], ['other', 'Khác']];
const collator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });

export default function DocumentWorkspace({ entry, documents = [], loading = false, error = '', onClose, onPreview, onRetry }) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [sort, setSort] = useState('name');
  const deferredQuery = useDeferredValue(query);
  const indexed = useMemo(() => documents.map(document => ({
    document,
    ...fileInfo(document),
    search: normalize(`${document.name} ${document.folder || ''}`),
    modified: new Date(document.modified || 0).getTime() || 0,
  })), [documents]);
  const counts = useMemo(() => indexed.reduce((result, item) => {
    result[item.type] = (result[item.type] || 0) + 1;
    return result;
  }, { all: indexed.length }), [indexed]);
  const totalBytes = useMemo(() => documents.reduce((sum, document) => sum + (Number(document.size) || 0), 0), [documents]);
  const visible = useMemo(() => {
    const words = normalize(deferredQuery).trim().split(/\s+/).filter(Boolean);
    const filtered = indexed.filter(item => (type === 'all' || item.type === type) && words.every(word => item.search.includes(word)));
    return filtered.sort((a, b) => sort === 'recent'
      ? b.modified - a.modified || collator.compare(a.document.name, b.document.name)
      : sort === 'size'
        ? (Number(b.document.size) || 0) - (Number(a.document.size) || 0) || collator.compare(a.document.name, b.document.name)
        : collator.compare(a.document.name, b.document.name));
  }, [indexed, deferredQuery, type, sort]);
  const filtered = !!query.trim() || type !== 'all';
  const clearFilters = () => { setQuery(''); setType('all'); };

  return <ModalFrame className="document-workspace" labelledBy={`${id}-title`} onClose={onClose}>
    <header className="dw-header">
      <div className="dw-eyebrow"><FolderOpen size={14}/><span>THƯ VIỆN TÀI LIỆU</span></div>
      <button type="button" className="dw-icon-button dw-close" onClick={onClose} aria-label="Đóng thư mục"><X size={19}/></button>
      <div className="dw-heading"><span className="dw-folder-mark"><FolderOpen size={27}/></span><div><h2 id={`${id}-title`}>{entry?.name || 'Tài liệu giải pháp'}</h2><p>{entry?.desc || 'Tìm, xem trước và tải tài liệu trong thư viện.'}</p></div></div>
      <div className="dw-summary"><span><FileText size={13}/>{loading ? 'Đang đọc danh mục…' : `${documents.length} tài liệu`}</span>{!loading && !error && documents.length > 0 && <><i aria-hidden="true"/><span>{sizeLabel(totalBytes)}</span><i aria-hidden="true"/><span>Xem trước hoặc tải về</span></>}</div>
    </header>

    <div className="dw-controls">
      <div className="dw-search-row"><label className="dw-search"><Search size={18}/><span className="dw-sr-only">Tìm tên tài liệu hoặc thư mục</span><input autoFocus type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm tên tài liệu, thư mục…"/>{query && <button type="button" onClick={() => setQuery('')} aria-label="Xóa từ khóa"><X size={15}/></button>}</label><label className="dw-sort"><ArrowDownWideNarrow size={16}/><span className="dw-sr-only">Sắp xếp tài liệu</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="name">Tên A → Z</option><option value="recent">Mới cập nhật</option><option value="size">Dung lượng lớn</option></select></label></div>
      <div className="dw-types" role="group" aria-label="Lọc theo loại tài liệu"><SlidersHorizontal className="dw-filter-icon" size={14}/>{types.filter(([key]) => key === 'all' || counts[key] > 0).map(([key, label]) => <button type="button" key={key} className={type === key ? 'active' : ''} aria-pressed={type === key} onClick={() => setType(key)}>{label}<span>{counts[key] || 0}</span></button>)}</div>
    </div>

    <div className="dw-file-area" aria-busy={loading || deferredQuery !== query}>
      {loading ? <div className="dw-skeletons" role="status" aria-label="Đang tải danh sách tài liệu">{[1, 2, 3, 4].map(key => <div className="dw-skeleton" key={key}><span/><div><i/><i/></div></div>)}</div>
        : error ? <div className="dw-empty" role="alert"><span className="dw-empty-icon"><AlertCircle size={28}/></span><h3>Chưa tải được tài liệu</h3><p>{error}</p>{onRetry && <button type="button" onClick={onRetry}><RotateCcw size={15}/>Thử lại</button>}</div>
          : !visible.length ? <div className="dw-empty"><span className="dw-empty-icon">{filtered ? <Search size={28}/> : <FolderOpen size={28}/>}</span><h3>{filtered ? 'Chưa tìm thấy tài liệu phù hợp' : 'Thư mục đang trống'}</h3><p>{filtered ? 'Thử từ khóa khác hoặc mở rộng loại tài liệu.' : 'Các tài liệu được thêm vào giải pháp sẽ xuất hiện tại đây.'}</p>{filtered && <button type="button" onClick={clearFilters}><RotateCcw size={15}/>Xóa bộ lọc</button>}</div>
            : <ul className="dw-file-list" aria-label="Danh sách tài liệu">{visible.map(({ document, ext, type: fileType, Icon }) => <li className="dw-file" key={document.id}>
              <span className={`dw-file-symbol dw-file-${fileType}`}><Icon size={23}/><small>{ext || 'FILE'}</small></span>
              <div className="dw-file-info"><button type="button" className="dw-file-name" onClick={() => onPreview(document)} title={document.name}>{document.name}</button><div className="dw-file-meta"><span className="dw-file-folder" title={document.folder || 'Thư mục gốc'}>{document.folder || 'Thư mục gốc'}</span><i aria-hidden="true"/><span>{sizeLabel(document.size)}</span>{fileDate(document.modified) && <><i aria-hidden="true"/><time dateTime={new Date(document.modified).toISOString()}>{fileDate(document.modified)}</time></>}</div></div>
              <div className="dw-file-actions"><button type="button" className="dw-preview-button" onClick={() => onPreview(document)} aria-label={`Xem trước ${document.name}`} title="Xem trước"><Eye size={16}/><span>Xem trước</span></button>{document.url && <a className="dw-icon-button" href={downloadUrl(document.url)} download aria-label={`Tải xuống ${document.name}`} title="Tải xuống"><Download size={17}/></a>}</div>
            </li>)}</ul>}
    </div>

    <footer className="dw-footer"><span role="status" aria-live="polite">{loading ? 'Đang tải tài liệu…' : error ? 'Danh mục chưa sẵn sàng' : `${visible.length} / ${documents.length} tài liệu`}</span>{filtered && <button type="button" className="dw-clear" onClick={clearFilters}>Xóa bộ lọc</button>}<button type="button" className="dw-done" onClick={onClose}>Đóng thư mục</button></footer>
  </ModalFrame>;
}
