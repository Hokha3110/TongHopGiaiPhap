import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Upload, X, Search, FolderOpen, Check, CheckCircle2, AlertCircle, FileText, ArrowRight, LockKeyhole, Pause, RotateCcw, Plus } from 'lucide-react';
import { groups } from './data/catalog.js';
import { entryBrandLogo } from './data/brandAssets.js';
import { mediaUrl } from './Article.jsx';
import { addUploadFiles, formatFileSize, normalizedText, uploadDocument, MAX_UPLOAD_FILES, UPLOAD_ACCEPT } from './documentUpload.js';
import './admin-document-upload.css';

const groupName = row => row?.draft.kind === 'collection' ? 'Thư viện dùng chung' : groups.find(group => group.id === row?.draft.group)?.name || 'Giải pháp';
function Brand({ row }) {
  const src = mediaUrl(entryBrandLogo({ ...row.draft, id: row.id }));
  const [failed, setFailed] = useState('');
  return <span className="adu-brand">{src && failed !== src ? <img src={src} alt="" onError={() => setFailed(src)}/> : <FolderOpen size={22}/>}</span>;
}

export default function AdminDocumentUpload({ entries, onClose, onUploaded }) {
  const [destination, setDestination] = useState(null);
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [confirmed, setConfirmed] = useState(false);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [message, setMessage] = useState('');
  const [dragging, setDragging] = useState(false);
  const dialog = useRef(null), fileInput = useRef(null), stop = useRef(false), active = useRef(false), mounted = useRef(true);
  const warnOnLeave = useRef(false);
  const available = entries.filter(row => !row.deleted_at);
  const filtered = available.filter(row => normalizedText(`${row.draft.name} ${groupName(row)}`).includes(normalizedText(query.trim())));
  const ready = rows.filter(row => row.status === 'ready');
  const completed = rows.filter(row => row.status === 'success');
  const issues = rows.filter(row => ['invalid', 'error', 'unknown'].includes(row.status));
  const totalBytes = rows.reduce((sum, row) => sum + row.file.size, 0);
  const destinationActive = destination && available.some(row => row.id === destination.id);
  warnOnLeave.current = running || ready.length > 0;

  useEffect(() => {
    mounted.current = true;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current.showModal();
    const warn = event => { if (warnOnLeave.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => {
      mounted.current = false; stop.current = true;
      window.removeEventListener('beforeunload', warn);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  function close() {
    if (active.current) return;
    if (ready.length && !window.confirm(`Còn ${ready.length} file chưa tải. Đóng và bỏ danh sách chờ?`)) return;
    onClose();
  }
  function selectDestination(row) {
    if (started || active.current) return;
    setDestination(row); setConfirmed(false); setMessage('');
  }
  function addFiles(files) {
    if (active.current || !destinationActive) return;
    const result = addUploadFiles(rows, Array.from(files));
    setRows(result.rows); setConfirmed(false);
    setMessage([result.duplicates ? `Bỏ qua ${result.duplicates} file đã có trong danh sách chọn.` : '', result.overflow ? `Mỗi đợt tối đa ${MAX_UPLOAD_FILES} file. ${result.overflow} file chưa được thêm.` : ''].filter(Boolean).join(' '));
  }
  const updateRow = (key, patch) => { if (mounted.current) setRows(current => current.map(row => row.key === key ? { ...row, ...patch } : row)); };

  async function startUpload() {
    if (active.current || !destinationActive || !confirmed || !ready.length) return;
    // Capture the destination and queue once. Filtering or rerendering cannot reroute a file.
    const target = destination.id;
    const batch = [...ready];
    active.current = true; stop.current = false;
    setRunning(true); setStarted(true); setStopping(false); setMessage('');
    let sent = 0, failed = 0, refreshNeeded = false, authExpired = false;
    try {
      for (const row of batch) {
        if (stop.current || !mounted.current) break;
        updateRow(row.key, { status: 'uploading', progress: 0, error: '' });
        try {
          await uploadDocument(row.file, target, { onProgress: progress => updateRow(row.key, { progress }) });
          sent++; refreshNeeded = true;
          updateRow(row.key, { status: 'success', progress: 100 });
        } catch (error) {
          failed++;
          updateRow(row.key, { status: error.uncertain ? 'unknown' : 'error', error: error.message });
          if (error.uncertain || [401, 403, 429].includes(error.status)) {
            stop.current = true; refreshNeeded ||= Boolean(error.uncertain);
            authExpired = error.status === 401;
          }
        }
      }
    } finally {
      if (mounted.current) {
        setMessage(`Đã tải ${sent} file vào ${destination.draft.name}.${failed ? ` ${failed} file cần kiểm tra.` : ''}${stop.current ? ' Đã dừng; các file còn lại chưa được gửi.' : ''}`);
        // Refresh only once per batch, and keep the queue visible if the session expired.
        if (refreshNeeded && !authExpired) {
          try { await onUploaded(target); }
          catch { if (mounted.current) setMessage('Đã xử lý đợt tải nhưng chưa làm mới được danh sách. Xem kết quả từng file bên dưới.'); }
        }
        if (mounted.current) { setRunning(false); setStopping(false); }
      }
      active.current = false;
    }
  }
  function retry(row) {
    if (row.status === 'unknown' && !window.confirm('File có thể đã được lưu. Bạn đã kiểm tra danh sách tài liệu và xác nhận cần tải lại?')) return;
    updateRow(row.key, { status: 'ready', progress: 0, error: '' }); setConfirmed(false); setMessage('');
  }

  return createPortal(<dialog ref={dialog} className="adu-dialog" aria-labelledby="adu-title" aria-describedby="adu-description" onCancel={event => { event.preventDefault(); close(); }}>
    <header className="adu-header"><div className="adu-heading-icon"><Upload size={24}/></div><div><span className="adu-eyebrow">THƯ VIỆN / THÊM TÀI LIỆU</span><h2 id="adu-title">Tải tài liệu lên</h2><p id="adu-description">Chọn đúng nơi lưu. Thêm nhiều file trong một lần.</p></div><button className="adu-icon-button adu-close" type="button" disabled={running} onClick={close} aria-label="Đóng tải tài liệu"><X size={20}/></button></header>
    <div className="adu-body">
      <aside className="adu-destinations" aria-label="Chọn nơi lưu tài liệu">
        <div className="adu-step"><span>01</span><div><h3>Chọn nơi lưu</h3><p>Mỗi đợt tải thuộc một giải pháp.</p></div></div>
        <label className="adu-search"><Search size={16}/><input autoFocus aria-label="Tìm giải pháp nhận tài liệu" placeholder="Tìm tên giải pháp…" value={query} disabled={started} onChange={event => setQuery(event.target.value)}/></label>
        <div className="adu-destination-list">{filtered.map(row => <button type="button" key={row.id} className={`adu-destination${destination?.id === row.id ? ' is-selected' : ''}`} disabled={started} aria-pressed={destination?.id === row.id} onClick={() => selectDestination(row)}>
          <Brand row={row}/><span><strong>{row.draft.name}</strong><small>{groupName(row)}</small>{!row.published && <em>Bản nháp · chưa hiển thị cho thành viên</em>}</span>{destination?.id === row.id && <Check size={17}/>}</button>)}
          {!filtered.length && <p className="adu-empty-search">Không tìm thấy giải pháp. Thử tên khác hoặc tạo nội dung trong mục Nội dung.</p>}
        </div>
        {started && <p className="adu-lock-note"><LockKeyhole size={14}/> Nơi lưu đã khóa cho đợt này. Đóng và mở đợt mới để chọn giải pháp khác.</p>}
      </aside>
      <section className="adu-files" aria-label="Danh sách file tải lên">
        <div className="adu-step"><span>02</span><div><h3>Thêm tài liệu</h3><p>Tối đa {MAX_UPLOAD_FILES} file mỗi đợt · 90 MB/file.</p></div></div>
        {destination ? <div className="adu-target"><Brand row={destination}/><div><span>TẤT CẢ FILE SẼ ĐƯỢC LƯU VÀO</span><strong>{destination.draft.name}</strong><small>{groupName(destination)}</small></div><FolderOpen size={22}/></div> : <div className="adu-target is-empty"><FolderOpen size={24}/><div><strong>Chưa chọn nơi lưu</strong><small>Chọn một giải pháp ở bước 01 để thêm file.</small></div></div>}
        {destination && !destination.published && <p className="adu-draft-note">Đây là bản nháp. Thành viên chỉ thấy tài liệu sau khi nội dung được xuất bản.</p>}
        {destination && !destinationActive && <p className="adu-warning" role="alert">Nơi lưu không còn hoạt động. Đóng hộp tải lên và chọn lại.</p>}
        <div className={`adu-dropzone${dragging ? ' is-dragging' : ''}${!destinationActive ? ' is-disabled' : ''}`} onDragOver={event => { event.preventDefault(); if (destinationActive && !running) setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}>
          <Upload size={27}/><strong>{rows.length ? 'Thêm file vào danh sách' : 'Kéo thả tài liệu vào đây'}</strong><p>PDF, Word, Excel, PowerPoint, ảnh và các định dạng được hỗ trợ.</p>
          <button type="button" className="adu-secondary" disabled={!destinationActive || running} onClick={() => fileInput.current.click()}><Plus size={16}/> Chọn nhiều file</button>
          <input ref={fileInput} type="file" multiple accept={UPLOAD_ACCEPT} hidden onChange={event => { addFiles(event.target.files); event.target.value = ''; }}/>
        </div>
        {rows.length > 0 && <><div className="adu-queue-heading"><h4>{rows.length} file <span>· {formatFileSize(totalBytes)}</span></h4><span>{completed.length} xong{issues.length ? ` · ${issues.length} cần kiểm tra` : ''}</span></div>
          <ul className="adu-queue">{rows.map(row => <li key={row.key} className={`adu-file is-${row.status}`}><span className="adu-file-icon">{row.status === 'success' ? <CheckCircle2 size={21}/> : ['error','invalid','unknown'].includes(row.status) ? <AlertCircle size={21}/> : <FileText size={21}/>}</span><div className="adu-file-copy"><strong title={row.file.name}>{row.file.name}</strong><small>{formatFileSize(row.file.size)} · {row.status === 'ready' ? 'Chờ tải' : row.status === 'success' ? 'Đã lưu' : row.status === 'uploading' ? row.progress === 100 ? 'Đang lưu trên máy chủ…' : `Đang tải ${row.progress}%` : row.status === 'invalid' ? 'Không thể tải' : row.status === 'unknown' ? 'Cần kiểm tra kết quả' : 'Tải thất bại'}</small>{row.status === 'uploading' && <progress max="100" value={row.progress} aria-label={`Tiến độ ${row.file.name}`}/ >}{row.error && <p>{row.error}</p>}</div>
            {['error','unknown'].includes(row.status) && <button type="button" className="adu-icon-button" disabled={running} onClick={() => retry(row)} aria-label={`Thử lại ${row.file.name}`} title="Đưa lại vào danh sách chờ"><RotateCcw size={17}/></button>}
            {row.status !== 'uploading' && row.status !== 'success' && <button type="button" className="adu-icon-button" disabled={running} onClick={() => { setRows(current => current.filter(item => item.key !== row.key)); setConfirmed(false); }} aria-label={`Bỏ ${row.file.name}`}><X size={17}/></button>}
          </li>)}</ul></>}
        {message && <p className="adu-message" role="status">{message}</p>}
      </section>
    </div>
    <footer className="adu-footer"><div>{destination && ready.length > 0 ? <label className="adu-confirm"><input type="checkbox" checked={confirmed} disabled={running || !destinationActive} onChange={event => setConfirmed(event.target.checked)}/><span>Tôi xác nhận tải <b>{ready.length} file</b> vào <b>{destination.draft.name}</b>.</span></label> : <p>{completed.length ? `${completed.length} file đã được lưu vào ${destination?.draft.name}.` : 'Chọn nơi lưu và thêm file để tiếp tục.'}</p>}<small>File tải lên tạo tài liệu mới. Dùng “Sửa / Phiên bản” để thay file đã có.</small></div><div className="adu-actions">{running ? <button className="adu-secondary" type="button" disabled={stopping} onClick={() => { stop.current = true; setStopping(true); }}><Pause size={16}/>{stopping ? 'Đang chờ file hiện tại…' : 'Dừng sau file hiện tại'}</button> : <><button className="adu-secondary" type="button" onClick={close}>{ready.length ? 'Để sau' : 'Đóng'}</button><button className="adu-primary" type="button" disabled={!confirmed || !ready.length || !destinationActive} onClick={startUpload}>Tải {ready.length} file lên <ArrowRight size={17}/></button></>}</div></footer>
  </dialog>, document.body);
}
