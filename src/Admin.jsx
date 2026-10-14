import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, LayoutDashboard, Users, FileText, FolderOpen, History, ArrowLeft, LogOut, Plus, RefreshCw, Save, Upload, Eye, Trash2, RotateCcw } from 'lucide-react';
import { groups } from './data/catalog.js';
import Article, { mediaUrl } from './Article.jsx';
import './admin.css';

const base = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
const tabs = [['overview','Tổng quan',LayoutDashboard],['entries','Nội dung',FileText],['documents','Tài liệu',FolderOpen],['users','Tài khoản',Users],['audit','Nhật ký',History]];
const roleNames = { admin:'Quản trị viên', editor:'Biên tập viên', member:'Thành viên' };
const blankEntry = { name:'', desc:'', group:'cnapp', kind:'solution', tags:[], body:'', logoUrl:'', partners:[], sourceUrl:'' };
const time = value => value ? new Date(value).toLocaleString('vi-VN') : '—';
const size = bytes => `${(Number(bytes || 0) / 1024 / 1024).toFixed(1)} MB`;

export default function Admin({ user, onLogout }) {
  const [tab,setTab] = useState('overview');
  const [entries,setEntries] = useState([]);
  const [items,setItems] = useState([]);
  const [overview,setOverview] = useState({});
  const [editor,setEditor] = useState(null);
  const [userEditor,setUserEditor] = useState(null);
  const [docEditor,setDocEditor] = useState(null);
  const [versions,setVersions] = useState([]);
  const [entryFilter,setEntryFilter] = useState('');
  const [q,setQ] = useState('');
  const [trash,setTrash] = useState(false);
  const [page,setPage] = useState(1);
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [preview,setPreview] = useState(false);
  const [progress,setProgress] = useState(null);
  const [dirty,setDirty] = useState(false);
  const editorRef = useRef(null);
  const requestGeneration = useRef(0);
  const canAdmin = user?.role === 'admin';
  const canEdit = canAdmin || user?.role === 'editor';

  async function api(path, method = 'GET', body) {
    const response = await fetch(base + '/api/admin/' + path, { method, credentials:'include', headers: body ? {'Content-Type':'application/json'} : {}, body: body ? JSON.stringify(body) : undefined });
    const result = await response.json();
    if (response.status === 401) { onLogout(); throw new Error('Phiên đăng nhập đã hết hạn.'); }
    if (!response.ok) throw new Error(result.error || 'Không thực hiện được thao tác.');
    return result;
  }
  async function refresh() {
    const generation = ++requestGeneration.current;
    setLoading(true);
    try {
      const [catalog, data] = await Promise.all([api('entries'), api(tab === 'documents' ? `documents?entryId=${encodeURIComponent(entryFilter)}&q=${encodeURIComponent(q)}&trash=${trash}&page=${page}` : tab === 'entries' ? 'overview' : `${tab}?page=${page}`)]);
      if (generation !== requestGeneration.current) return;
      setEntries(catalog.items); setItems(data.items || []);
      if (tab === 'overview') setOverview(data);
    } catch (err) { if (generation === requestGeneration.current) setError(err.message); }
    finally { if (generation === requestGeneration.current) setLoading(false); }
  }
  useEffect(() => { if (canEdit) { setError(''); refresh(); } return () => { requestGeneration.current++; }; }, [tab,entryFilter,q,trash,page]);
  useEffect(() => {
    const warn = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function mutate(fn, message) {
    setBusy(true); setError(''); setNotice('');
    try { await fn(); setNotice(message); await refresh(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  function chooseTab(value) {
    if (dirty && !window.confirm('Bỏ các thay đổi chưa lưu?')) return;
    setDirty(false); setEditor(null); setUserEditor(null); setDocEditor(null); setTab(value); setPage(1); setNotice(''); setError('');
  }
  function editEntry(row) {
    if (dirty && !window.confirm('Bỏ các thay đổi chưa lưu?')) return;
    setEditor(row ? { ...row.draft, id:row.id, revision:row.revision } : { ...blankEntry }); setDirty(false); setPreview(false);
  }
  function changeEntry(key,value) { setEditor(previous => ({...previous,[key]:value})); setDirty(true); }
  function insert(text) {
    const input = editorRef.current;
    const start = input?.selectionStart ?? editor.body.length;
    const end = input?.selectionEnd ?? start;
    changeEntry('body', editor.body.slice(0,start) + text + editor.body.slice(end));
    input?.focus();
  }
  function upload(file, path) {
    if (!file) return Promise.reject(new Error('Chưa chọn file.'));
    if (file.size > 90 * 1024 * 1024) return Promise.reject(new Error('File vượt 90 MB. Chép file lớn vào Solutions trên Linux rồi chọn Nhập từ Solutions.'));
    return new Promise((resolve,reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST',base + '/api/admin/' + path); xhr.withCredentials=true; xhr.timeout=10*60*1000;
      xhr.upload.onprogress = e => { if (e.lengthComputable) setProgress(Math.round(e.loaded/e.total*100)); };
      xhr.onload = () => { setProgress(null); let result; try { result=JSON.parse(xhr.responseText); } catch { reject(new Error('Máy chủ không nhận được file. Kiểm tra giới hạn của Tunnel.')); return; } if (xhr.status >= 200 && xhr.status < 300) resolve(result); else reject(new Error(result.error || 'Tải lên thất bại.')); };
      xhr.onerror = xhr.ontimeout = () => { setProgress(null); reject(new Error('Kết nối tải lên bị ngắt.')); };
      const form = new FormData(); form.append('file',file); xhr.send(form);
    });
  }
  if (!canEdit) return <main className="admin-denied"><ShieldCheck/><h1>Bạn không có quyền quản trị</h1><a href="/">Về thư viện</a></main>;
  const activeEntries = entries.filter(e => !e.deleted_at);
  const docOptions = activeEntries.map(e => <option value={e.id} key={e.id}>{e.draft.name}{!e.published ? ' · bản nháp' : ''}</option>);
  const shownEntries = entries.filter(e => Boolean(e.deleted_at) === trash && e.draft.name.toLowerCase().includes(q.toLowerCase()));
  return <div className="admin-shell">
    <aside className="admin-nav"><a className="admin-brand admin-brand-asic" href="/"><span className="admin-brand-logo"><img src="/logos/logo-ASIC.png" alt="ASIC CyberSecurity"/></span><span>ASIC LIBRARY<small>QUẢN TRỊ</small></span></a><nav>{tabs.filter(([key]) => canAdmin || !['users','audit'].includes(key)).map(([key,label,Icon]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => chooseTab(key)}><Icon size={17}/>{label}</button>)}</nav><div className="admin-person"><b>{user.displayName}</b><small>{roleNames[user.role]}</small><a href="/"><ArrowLeft size={15}/> Về thư viện</a><button onClick={onLogout}><LogOut size={15}/> Đăng xuất</button></div></aside>
    <main className="admin-main"><header className="admin-heading"><div><span className="section-kicker">THƯ VIỆN NỘI BỘ / QUẢN TRỊ</span><h1>{tabs.find(t => t[0] === tab)?.[1]}</h1></div><button disabled={busy || loading} onClick={refresh}><RefreshCw size={15}/> Làm mới</button></header>
      {error && <div className="admin-error" role="alert">{error}</div>}{notice && <div className="admin-notice" role="status">{notice}</div>}{loading && <p role="status">Đang tải dữ liệu…</p>}
      {progress !== null && <div className="admin-progress"><progress value={progress} max="100"/> {progress}% · Đang tải file</div>}
      <fieldset className="admin-work" disabled={busy}>
      {tab === 'overview' && <><div className="admin-stats">{[['Danh mục',overview.entries],['Chưa xuất bản',overview.drafts],['Tài liệu',overview.documents],['Tài khoản hoạt động',overview.users]].map(([label,value]) => <article key={label}><span>{label}</span><strong>{value ?? '—'}</strong></article>)}</div><section className="admin-panel"><h2>Thư viện đã sẵn sàng để cập nhật</h2><p>Sửa bài viết trong Nội dung, tải file trong Tài liệu. Bản nháp chỉ xuất hiện trong trang quản trị; thành viên đọc bản đã xuất bản.</p><p>Dung lượng các phiên bản đã lập chỉ mục: {size(overview.bytes)}.</p><button onClick={() => chooseTab('entries')}><FileText size={16}/> Quản lý nội dung</button></section><section className="admin-panel"><h2>Tài liệu đã chép lên Linux</h2><p>Nhập các file mới trong Solutions. Bài viết, tên tài liệu đã sửa và thùng rác được giữ nguyên. File thay thế nên tải qua mục Phiên bản.</p><button onClick={() => mutate(async () => { const r=await api('import','POST',{}); setOverview(v => ({...v})); window.alert(`Đã thêm ${r.imported} / ${r.scanned} tài liệu được quét.`); },'Đã nhập dữ liệu từ Solutions.')}><RefreshCw size={16}/> Nhập từ Solutions</button></section></>}
      {tab === 'entries' && <><div className="admin-toolbar"><input aria-label="Tìm nội dung" placeholder="Tìm giải pháp, thư viện…" value={q} onChange={e => setQ(e.target.value)}/><label className="admin-check"><input type="checkbox" checked={trash} onChange={e => setTrash(e.target.checked)}/> Thùng rác</label><button className="admin-primary" onClick={() => editEntry(null)}><Plus size={15}/> Tạo nội dung</button></div>
      <div className="admin-editor-layout"><section className="admin-panel admin-entry-list">{shownEntries.map(row => <article key={row.id}><button onClick={() => editEntry(row)} disabled={Boolean(row.deleted_at)}><b>{row.draft.name}</b><small>{row.published ? 'Đã xuất bản' : 'Bản nháp'} · lần sửa {row.revision}</small></button><div className="admin-row-actions">{row.deleted_at ? <button onClick={() => mutate(() => api(`entries/${row.id}/restore`,'POST',{revision:row.revision}),'Đã khôi phục.')}><RotateCcw size={14}/> Khôi phục</button> : <><button onClick={() => { if (window.confirm('Ẩn nội dung và tài liệu của mục này khỏi thư viện?')) mutate(() => api(`entries/${row.id}/trash`,'POST',{revision:row.revision}),'Đã chuyển vào thùng rác.'); }} aria-label={`Xóa ${row.draft.name}`}><Trash2 size={14}/></button>{row.published && <button onClick={() => { if (window.confirm('Gỡ xuất bản mục này?')) mutate(() => api(`entries/${row.id}/unpublish`,'POST',{revision:row.revision}),'Đã gỡ xuất bản.'); }}>Gỡ xuất bản</button>}</>}</div></article>)}{!shownEntries.length && <p>Chưa có nội dung phù hợp.</p>}</section>
      {editor ? <form className="admin-panel admin-editor" onSubmit={e => { e.preventDefault(); const publish=e.nativeEvent.submitter?.value === 'publish'; mutate(async () => { const r=await api('entries'+(editor.id ? '/'+editor.id : ''),editor.id ? 'PUT' : 'POST',{...editor,publish}); const list=await api('entries'); const saved=list.items.find(v=>v.id===r.id); setEditor({...saved.draft,id:saved.id,revision:saved.revision}); setDirty(false); },publish ? 'Đã xuất bản nội dung.' : 'Đã lưu bản nháp.'); }}>
        <h2>{editor.id ? 'Biên tập nội dung' : 'Nội dung mới'}{dirty && <small> · Chưa lưu</small>}</h2><label>Tên<input required maxLength={180} value={editor.name} onChange={e=>changeEntry('name',e.target.value)}/></label><div className="admin-fields"><label>Loại<select value={editor.kind} onChange={e=>changeEntry('kind',e.target.value)}><option value="solution">Giải pháp</option><option value="collection">Thư viện dùng chung</option></select></label><label>Lĩnh vực<select value={editor.group || 'data'} onChange={e=>changeEntry('group',e.target.value)}>{groups.filter(g=>g.id!=='all').map(g=><option key={g.id} value={g.id}>{g.short}</option>)}</select></label></div>
        <label>Mô tả ngắn<textarea rows={3} maxLength={2000} value={editor.desc} onChange={e=>changeEntry('desc',e.target.value)}/></label><label>Thẻ chủ đề, cách nhau bằng dấu phẩy<input value={editor.tags.join(',')} onChange={e=>changeEntry('tags',e.target.value.split(','))}/></label>
        <label>Hãng được đề cập, cách nhau bằng dấu phẩy<input value={(editor.partners || []).join(',')} onChange={e=>changeEntry('partners',e.target.value.split(','))}/></label><label>Liên kết nguồn<input type="url" placeholder="https://..." value={editor.sourceUrl || ''} onChange={e=>changeEntry('sourceUrl',e.target.value)}/></label>
        <label>Logo<input placeholder="/logos/ten-logo.png hoặc /api/files/…?view=inline" value={editor.logoUrl || ''} onChange={e=>changeEntry('logoUrl',e.target.value)}/></label>{editor.logoUrl && <img className="admin-logo-preview" alt="Logo đang chọn" src={mediaUrl(editor.logoUrl)}/>}
        <div className="admin-row-actions"><label className="admin-file-button"><Upload size={14}/> Tải logo<input type="file" accept="image/png,image/jpeg,image/webp" disabled={!editor.id} onChange={e=>{const f=e.target.files[0]; e.target.value=''; if(f) mutate(async()=>{const r=await upload(f,`documents?entryId=${editor.id}`);changeEntry('logoUrl',r.url);},'Đã tải logo. Lưu hoặc xuất bản để áp dụng.');}}/></label><small>Lưu nháp lần đầu để tải ảnh.</small></div>
        <div className="admin-markdown-tools"><button type="button" onClick={()=>insert('\n## Tiêu đề\n\n')}>Tiêu đề</button><button type="button" onClick={()=>insert('**Nội dung in đậm**')}>In đậm</button><button type="button" onClick={()=>insert('\n- Nội dung danh sách\n')}>Danh sách</button><button type="button" onClick={()=>insert('[Tên liên kết](https://example.com)')}>Liên kết</button><label className="admin-file-button"><Upload size={14}/> Chèn ảnh<input type="file" accept="image/png,image/jpeg,image/webp" disabled={!editor.id} onChange={e=>{const f=e.target.files[0];e.target.value='';if(f)mutate(async()=>{const r=await upload(f,`documents?entryId=${editor.id}`);insert(`\n\n![Ảnh giải pháp](${r.url})\n\n`);},'Đã chèn ảnh vào bản nháp.');}}/></label><button type="button" onClick={()=>setPreview(!preview)}><Eye size={14}/>{preview?'Soạn bài':'Xem trước'}</button></div>
        {preview ? <Article body={editor.body}/> : <label>Bài viết (Markdown)<textarea ref={editorRef} className="admin-body-input" value={editor.body} onChange={e=>changeEntry('body',e.target.value)} maxLength={200000}/></label>}
        <div className="admin-row-actions"><button type="submit" value="draft"><Save size={15}/> Lưu nháp</button><button className="admin-primary" type="submit" value="publish">Xuất bản</button></div>
      </form> : <section className="admin-panel"><h2>Chọn nội dung để chỉnh sửa</h2><p>Các bài giới thiệu và danh mục cũ đã được nhập vào database.</p></section>}</div></>}
      {tab === 'documents' && <><div className="admin-toolbar"><input aria-label="Tìm tài liệu" placeholder="Tìm tên tài liệu…" value={q} onChange={e=>{setQ(e.target.value);setPage(1);}}/><select aria-label="Danh mục tài liệu" value={entryFilter} onChange={e=>{setEntryFilter(e.target.value);setPage(1);}}><option value="">Tất cả danh mục</option>{docOptions}</select><label className="admin-check"><input type="checkbox" checked={trash} onChange={e=>{setTrash(e.target.checked);setPage(1);}}/> Thùng rác</label><label className="admin-file-button"><Upload size={15}/> Tải tài liệu<input type="file" disabled={!entryFilter || trash} onChange={e=>{const f=e.target.files[0];e.target.value='';if(f)mutate(()=>upload(f,`documents?entryId=${entryFilter}`),'Đã tải tài liệu.');}}/></label></div><p className="admin-hint">Chọn một danh mục để tải file lên · tối đa 90 MB/file. File lớn có thể chép lên Solutions rồi nhập từ Tổng quan.</p>
      <div className="admin-table-wrap"><table><thead><tr><th>Tài liệu</th><th>Danh mục</th><th>Dung lượng</th><th>Cập nhật</th><th>Thao tác</th></tr></thead><tbody>{items.map(doc=><tr key={doc.id}><td><a href={base+doc.url} target="_blank" rel="noreferrer">{doc.name}</a><small>{doc.extension}</small></td><td>{entries.find(e=>e.id===doc.entryId)?.draft.name}</td><td>{size(doc.size)}</td><td>{time(doc.modified)}</td><td><div className="admin-row-actions"><button onClick={()=>{setDocEditor(doc);api(`documents/${doc.id}/versions`).then(r=>setVersions(r.items)).catch(e=>setError(e.message));}}>Sửa / Phiên bản</button><button onClick={()=>{if(trash || window.confirm('Chuyển tài liệu vào thùng rác?'))mutate(()=>api(`documents/${doc.id}/${trash?'restore':'trash'}`,'POST',{}),trash?'Đã khôi phục.':'Đã chuyển vào thùng rác.');}}>{trash?'Khôi phục':'Xóa'}</button></div></td></tr>)}</tbody></table>{!items.length && !loading && <p>Không có tài liệu phù hợp.</p>}</div>
      {docEditor && <section className="admin-panel"><form onSubmit={e=>{e.preventDefault();mutate(async()=>{await api(`documents/${docEditor.id}`,'PATCH',docEditor);setDocEditor(null);},'Đã cập nhật tài liệu.');}}><h2>Thông tin tài liệu</h2><label>Tên hiển thị<input required value={docEditor.name} onChange={e=>setDocEditor({...docEditor,name:e.target.value})}/></label><label>Danh mục<select value={docEditor.entryId} onChange={e=>setDocEditor({...docEditor,entryId:e.target.value})}>{docOptions}</select></label><div className="admin-row-actions"><button type="submit">Lưu thông tin</button><button type="button" onClick={()=>setDocEditor(null)}>Đóng</button><label className="admin-file-button">Thêm phiên bản<input type="file" disabled={Boolean(docEditor.deletedAt)} onChange={e=>{const f=e.target.files[0];e.target.value='';if(f)mutate(async()=>{await upload(f,`documents/${docEditor.id}/upload`);setDocEditor(null);},'Đã thay phiên bản. File cũ được giữ lại.');}}/></label></div></form><h3>Lịch sử phiên bản</h3>{versions.map(v=><div className="admin-version" key={v.id}><span>{v.original_name} · {size(v.size)} · {time(v.created_at)}</span><button disabled={v.id===docEditor.version} onClick={()=>mutate(async()=>{await api(`documents/${docEditor.id}/version`,'POST',{version:v.id});setDocEditor(null);},'Đã khôi phục phiên bản.')}>{v.id===docEditor.version?'Đang dùng':'Dùng phiên bản này'}</button></div>)}</section>}</>}
      {tab === 'users' && <><div className="admin-toolbar"><p>Tài khoản có mật khẩu riêng. Khóa hoặc đổi mật khẩu sẽ thu hồi phiên đăng nhập.</p><button className="admin-primary" onClick={()=>setUserEditor({username:'',displayName:'',role:'member',active:true,password:''})}><Plus size={15}/> Tạo tài khoản</button></div><div className="admin-table-wrap"><table><thead><tr><th>Tên</th><th>Đăng nhập</th><th>Quyền</th><th>Trạng thái</th><th/></tr></thead><tbody>{items.map(u=><tr key={u.id}><td>{u.displayName}</td><td>{u.username}</td><td>{roleNames[u.role]}</td><td>{u.active?'Hoạt động':'Đã khóa'}</td><td><button onClick={()=>setUserEditor({...u,password:''})}>Chỉnh sửa</button></td></tr>)}</tbody></table></div>{userEditor && <form className="admin-panel" onSubmit={e=>{e.preventDefault();mutate(async()=>{await api('users'+(userEditor.id?'/'+userEditor.id:''),userEditor.id?'PATCH':'POST',userEditor);setUserEditor(null);},'Đã lưu tài khoản.');}}><h2>{userEditor.id?'Cập nhật tài khoản':'Tài khoản mới'}</h2><div className="admin-fields"><label>Tên đăng nhập<input autoComplete="off" required pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,79}" value={userEditor.username} onChange={e=>setUserEditor({...userEditor,username:e.target.value})}/></label><label>Tên hiển thị<input required value={userEditor.displayName} onChange={e=>setUserEditor({...userEditor,displayName:e.target.value})}/></label><label>Quyền<select value={userEditor.role} onChange={e=>setUserEditor({...userEditor,role:e.target.value})}>{Object.entries(roleNames).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>{userEditor.id?'Mật khẩu mới (để trống nếu giữ nguyên)':'Mật khẩu'}<input type="password" autoComplete="new-password" minLength={12} maxLength={256} required={!userEditor.id} value={userEditor.password} onChange={e=>setUserEditor({...userEditor,password:e.target.value})}/></label></div><label className="admin-check"><input type="checkbox" checked={userEditor.active} onChange={e=>setUserEditor({...userEditor,active:e.target.checked})}/> Tài khoản hoạt động</label><div className="admin-row-actions"><button className="admin-primary" type="submit">Lưu tài khoản</button><button type="button" onClick={()=>setUserEditor(null)}>Đóng</button></div></form>}</>}
      {tab === 'audit' && <div className="admin-table-wrap"><table><thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Thao tác</th><th>Đối tượng</th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td>{time(item.created_at)}</td><td>{item.actor_name}</td><td>{item.action}</td><td><code>{item.target_id}</code></td></tr>)}</tbody></table></div>}
      {['documents','users','audit'].includes(tab) && <div className="admin-pagination"><button disabled={page<=1 || loading} onClick={()=>setPage(page-1)}>Trang trước</button><span>Trang {page}</span><button disabled={items.length<50 || loading} onClick={()=>setPage(page+1)}>Trang sau</button></div>}
      </fieldset>
    </main>
  </div>;
}
