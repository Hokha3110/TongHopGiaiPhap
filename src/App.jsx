import { lazy, memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, ChevronDown,
  Command, FileText, Fingerprint, FlaskConical, FolderOpen, Gauge, Grid2X2,
  Eye, List, LockKeyhole, Menu, PanelLeftClose, PanelLeftOpen, Radar, RefreshCw, Search, Shield, ShieldCheck, X, Code2,
} from 'lucide-react';
import { groups } from './data/catalog.js';
import LibraryCatalog, { RecentSolutions } from './LibraryCatalog.jsx';
import AsyncPanel, { LoadingPanel } from './ui/AsyncPanel.jsx';
import { apiUrl, requestJson, loadDocuments as fetchDocuments, setLibrarySession, foldText, formatSize, scrollToSection } from './lib/libraryApi.js';
import { accountKey, readAccountIds, readPreference, readSavedIds, writePreference } from './lib/libraryPreferences.js';

const Admin = lazy(() => import('./Admin.jsx'));
const LoginScreen = lazy(() => import('./LoginScreen.jsx'));
const SolutionDetailPage = lazy(() => import('./SolutionDetailPage.jsx'));
const DocumentWorkspace = lazy(() => import('./DocumentWorkspace.jsx'));
const FilePreview = lazy(() => import('./FilePreview.jsx'));
const isAdminRoute = window.location.pathname.replace(/\/$/, '') === '/admin';
const icons = { grid:Grid2X2, lock:LockKeyhole, activity:Activity, flask:FlaskConical, code:Code2, fingerprint:Fingerprint, gauge:Gauge, search:Search, shield:Shield, radar:Radar };
const accessLevels = {
  admin:{ label:'ADMIN', caption:'Toàn quyền hệ thống', tone:'admin' },
  editor:{ label:'EDITOR', caption:'Quản lý nội dung', tone:'editor' },
  member:{ label:'MEMBER', caption:'Truy cập nội bộ', tone:'member' },
};
function readSolutionRoute() {
  try { const match=window.location.hash.match(/^#\/giai-phap\/([^/?#]+)/); return match ? decodeURIComponent(match[1]) : ''; }
  catch { return ''; }
}

const networkNodes = [
  { id: 'cnapp', x: 68, y: 73, color: 'cyan', label: 'CNAPP', lx: 38, ly: 51 },
  { id: 'soc', x: 151, y: 93, color: 'lime', label: 'SOC', lx: 135, ly: 73 },
  { id: 'labs', x: 328, y: 67, color: 'cyan', label: 'CYBER LABS', lx: 296, ly: 47 },
  { id: 'quality', x: 382, y: 126, color: 'orange', label: 'KIỂM THỬ', lx: 360, ly: 108 },
  { id: 'devsecops', x: 54, y: 187, color: 'cyan', label: 'DEVSECOPS', lx: 25, ly: 211 },
  { id: 'config', x: 139, y: 170, color: 'lime', label: 'CẤU HÌNH', lx: 111, ly: 193 },
  { id: 'osint', x: 303, y: 203, color: 'cyan', label: 'OSINT', lx: 291, ly: 225 },
  { id: 'data', x: 383, y: 175, color: 'lime', label: 'DỮ LIỆU', lx: 370, ly: 197 },
  { id: 'risk', x: 229, y: 34, color: 'orange', label: 'RỦI RO SỐ', lx: 202, ly: 19 },
];

function NetworkMap({ active, onSelect }) {
  const chooseNode = (id) => onSelect(id);
  return <div className="network-panel">
    <div className="network-panel-head"><span><i /> LĨNH VỰC AN NINH MẠNG</span><code>CHỌN ĐỂ LỌC</code></div>
    <svg className="network-svg" viewBox="0 0 440 270" role="group" aria-label="Sơ đồ lĩnh vực. Chọn một nút để lọc danh mục giải pháp.">
      <defs>
        <radialGradient id="nodeGlow"><stop stopColor="#c9ff62" stopOpacity=".9"/><stop offset="1" stopColor="#c9ff62" stopOpacity="0"/></radialGradient>
        <linearGradient id="pathGlow"><stop stopColor="#58d9ff" stopOpacity=".1"/><stop offset=".5" stopColor="#58d9ff" stopOpacity=".9"/><stop offset="1" stopColor="#c9ff62" stopOpacity=".5"/></linearGradient>
      </defs>
      <circle className="map-orbit" cx="228" cy="133" r="89"/><circle className="map-orbit orbit-outer" cx="228" cy="133" r="119"/>
      <path className="map-link" d="M68 73 151 93 228 133 328 67 382 126M54 187 139 170 228 133 303 203 383 175M151 93 139 170M328 67 303 203M68 73 54 187M382 126 383 175M229 34 228 133"/>
      <path className="map-link active" d="M54 187 139 170 228 133 328 67"/>
      <circle className="map-halo" cx="228" cy="133" r="40"/><circle className="map-core" cx="228" cy="133" r="17"/>
      <path className="core-shield" d="M228 122 237 126V133C237 139 233 143 228 146 223 143 219 139 219 133V126L228 122Z"/>
      {networkNodes.map(node => {
        const group = groups.find(item => item.id === node.id);
        const selected = active === node.id;
        return <g className={`map-node node-${node.color} ${selected ? 'selected' : ''}`} key={node.id} role="button" tabIndex="0" aria-label={`Lọc theo ${group?.short || node.label}`} aria-pressed={selected} onClick={() => chooseNode(node.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); chooseNode(node.id); } }}>
          <title>{group?.short || node.label} · {group ? 'lọc danh mục' : ''}</title>
          <circle className="map-node-hit" cx={node.x} cy={node.y} r="17"/><circle className="map-node-dot" cx={node.x} cy={node.y} r="5"/><circle className="map-node-ring" cx={node.x} cy={node.y} r="12"/>
          <text x={node.lx} y={node.ly}>{node.label}</text>
        </g>;
      })}
    </svg>
    <div className="network-panel-foot"><span><i /> 09 LĨNH VỰC</span><span>BẤM NÚT ĐỂ LỌC</span></div>
    <span className="map-coordinate">10°N / 106°E</span>
  </div>;
}


const MemoNetworkMap = memo(NetworkMap);

export default function App() {
  const searchInputRef = useRef(null);
  const sidebarRef = useRef(null);
  const heroRef = useRef(null);
  const [authStatus, setAuthStatus] = useState('checking');
  const [currentUser, setCurrentUser] = useState(null);
  const [active, setActive] = useState('all');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [saved, setSaved] = useState([]);
  const [recent, setRecent] = useState([]);
  const [showSaved, setShowSaved] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readPreference('tonghop.sidebar-collapsed', false) === true);
  const [view, setView] = useState(() => readPreference('tonghop.catalog-view','grid') === 'list' ? 'list' : 'grid');
  const [sort, setSort] = useState('A–Z');
  const [apiOnline, setApiOnline] = useState(false);
  const [remoteEntries, setRemoteEntries] = useState([]);
  const [indexedAt, setIndexedAt] = useState('');
  const [catalogState, setCatalogState] = useState('idle');
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [documentMatches, setDocumentMatches] = useState([]);
  const [documentSearchStatus, setDocumentSearchStatus] = useState('idle');
  const [showAllDocumentMatches, setShowAllDocumentMatches] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [detailEntry, setDetailEntry] = useState(null);
  const [solutionPageId, setSolutionPageId] = useState(readSolutionRoute);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [detailDocuments, setDetailDocuments] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [documentRevision, setDocumentRevision] = useState(0);
  const [toast, setToast] = useState('');

  const acceptSession = useCallback(user => {
    setLibrarySession(user.id);
    setSaved(readSavedIds(user.id));
    setRecent(readAccountIds(user.id, 'recent'));
    setCurrentUser(user);
    setAuthStatus('authenticated');
  }, []);
  const expireSession = useCallback(() => {
    setLibrarySession('');
    setCurrentUser(null); setAuthStatus('login'); setApiOnline(false);
    setRemoteEntries([]); setPreviewDoc(null); setDetailEntry(null);
    setSaved([]); setRecent([]); setMobileOpen(false); setDocumentMatches([]);
  }, []);

  useEffect(() => {
    const sync = () => { setSolutionPageId(readSolutionRoute()); setMobileOpen(false); };
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => { window.removeEventListener('hashchange', sync); window.removeEventListener('popstate', sync); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    requestJson('/api/auth/session', { signal:controller.signal })
      .then(data => { if (controller.signal.aborted) return; if (data.authenticated && data.user) acceptSession(data.user); else setAuthStatus(data.configured ? 'login' : 'unconfigured'); })
      .catch(() => { if (!controller.signal.aborted) setAuthStatus('unavailable'); });
    return () => controller.abort();
  }, [acceptSession]);
  useEffect(() => {
    if (currentUser?.id) writePreference(accountKey(currentUser.id, 'saved'), saved);
  }, [saved, currentUser?.id]);
  useEffect(() => {
    if (currentUser?.id) writePreference(accountKey(currentUser.id, 'recent'), recent);
  }, [recent, currentUser?.id]);
  useEffect(() => { writePreference('tonghop.catalog-view', view); }, [view]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || isAdminRoute) return;
    const controller = new AbortController();
    setCatalogState('loading');
    requestJson('/api/catalog', { signal:controller.signal })
      .then(data => {
        if (controller.signal.aborted) return;
        setRemoteEntries((data.entries || []).map(entry => ({ ...entry, mark:entry.mark || entry.name || 'ASIC', tags:Array.isArray(entry.tags) ? entry.tags : [], documentCount:Number(entry.documentCount) || 0 })));
        setIndexedAt(data.indexedAt || ''); setApiOnline(true); setCatalogState('ready');
      })
      .catch(error => { if (controller.signal.aborted) return; if (error.status === 401) expireSession(); else { setApiOnline(false); setCatalogState('error'); } });
    return () => controller.abort();
  }, [authStatus, currentUser?.id, catalogRevision, expireSession]);

  const allSolutions = useMemo(() => remoteEntries.filter(item => item.kind === 'solution' && !item.featured), [remoteEntries]);
  const allCollections = useMemo(() => remoteEntries.filter(item => item.kind === 'collection'), [remoteEntries]);
  const entriesById = useMemo(() => new Map(remoteEntries.map(item => [item.id,item])), [remoteEntries]);
  const groupCounts = useMemo(() => allSolutions.reduce((result,item) => { result[item.group]=(result[item.group] || 0)+1; return result; },{}), [allSolutions]);
  const savedSet = useMemo(() => new Set(saved), [saved]);
  const savedCount = useMemo(() => saved.filter(id => entriesById.has(id)).length, [saved,entriesById]);
  const recentEntries = useMemo(() => recent.map(id => entriesById.get(id)).filter(Boolean), [recent, entriesById]);
  const visible = useMemo(() => {
    const terms = foldText(deferredQuery).split(/\s+/).filter(Boolean);
    const source = showSaved ? remoteEntries.filter(item => item.kind === 'solution') : allSolutions;
    return source.filter(item => (active === 'all' || item.group === active) && (!showSaved || savedSet.has(item.id)) &&
      terms.every(term => foldText([item.name,item.desc,...item.tags,...(item.partners || [])].join(' ')).includes(term)))
      .sort((a,b) => sort === 'documents' ? b.documentCount-a.documentCount || a.name.localeCompare(b.name,'vi') : sort === 'Z–A' ? b.name.localeCompare(a.name,'vi') : a.name.localeCompare(b.name,'vi'));
  }, [deferredQuery,active,showSaved,savedSet,allSolutions,remoteEntries,sort]);
  const selectedGroup = groups.find(group => group.id === active);
  const totalDocuments = useMemo(() => remoteEntries.reduce((sum,entry) => sum+entry.documentCount,0), [remoteEntries]);
  const detailSolutionEntry = entriesById.get(solutionPageId);
  const relatedItems = useMemo(() => detailSolutionEntry ? allSolutions.filter(item => item.group===detailSolutionEntry.group && item.id!==detailSolutionEntry.id).slice(0,6) : [],[allSolutions,detailSolutionEntry]);

  useEffect(() => {
    setShowAllDocumentMatches(false);
    const value = query.trim();
    if (authStatus !== 'authenticated' || solutionPageId || isAdminRoute || value.length < 2) { setDocumentMatches([]); setDocumentSearchStatus('idle'); return; }
    if (!apiOnline) { setDocumentMatches([]); setDocumentSearchStatus('offline'); return; }
    const controller = new AbortController();
    setDocumentMatches([]); setDocumentSearchStatus('loading');
    const timer = setTimeout(() => {
      requestJson('/api/search?q=' + encodeURIComponent(value.slice(0,200)),{signal:controller.signal})
        .then(data => { if (!controller.signal.aborted) { setDocumentMatches(data.results || []); setDocumentSearchStatus('ready'); } })
        .catch(error => { if (controller.signal.aborted) return; if (error.status===401) expireSession(); else setDocumentSearchStatus('error'); });
    },300);
    return () => { clearTimeout(timer); controller.abort(); };
  },[query,apiOnline,authStatus,solutionPageId,expireSession]);

  const getDocuments = useCallback(async (entryId, options) => {
    try { return await fetchDocuments(entryId, options); }
    catch (error) { if (error.status === 401) expireSession(); throw error; }
  },[expireSession]);
  useEffect(() => {
    if (!detailEntry) return;
    let activeRequest = true;
    setDetailLoading(true); setDetailError(''); setDetailDocuments([]);
    getDocuments(detailEntry.id, {force:documentRevision>0})
      .then(documents => { if (activeRequest) setDetailDocuments(documents); })
      .catch(error => { if (activeRequest && error.name!=='AbortError') setDetailError(error.message); })
      .finally(() => { if (activeRequest) setDetailLoading(false); });
    return () => { activeRequest=false; };
  },[detailEntry?.id,documentRevision,getDocuments]);

  const backToLibrary = useCallback(() => {
    setSolutionPageId('');
    if (window.location.hash !== '#catalog') window.location.hash='#catalog';
    scrollToSection('catalog');
  },[]);
  const openSolutionPage = useCallback(entry => {
    const id = typeof entry === 'string' ? entry : entry?.id;
    if (!id) return;
    setRecent(previous => [id,...previous.filter(value => value!==id)].slice(0,8));
    setSearchOpen(false); setMobileOpen(false); setSolutionPageId(id);
    const hash='#/giai-phap/' + encodeURIComponent(id);
    if (window.location.hash!==hash) window.location.hash=hash;
    window.scrollTo({top:0,behavior:'instant'});
  },[]);
  const openEntry = useCallback(entry => { setDetailDocuments([]); setDetailError(''); setDetailLoading(true); setDetailEntry(entry); setDocumentRevision(0); setSearchOpen(false); },[]);
  const openDocument = useCallback(doc => { setPreviewDoc(doc); setSearchOpen(false); },[]);
  const toggleSave = useCallback(id => { setSaved(previous => previous.includes(id) ? previous.filter(value => value!==id) : [...previous,id]); },[]);
  const selectCatalogGroup = useCallback(groupId => {
    setActive(groupId); setShowSaved(false); setQuery(''); setMobileOpen(false); setSearchOpen(false); scrollToSection('catalog');
  },[]);
  const showSavedEntries = useCallback(() => {
    setActive('all'); setShowSaved(true); setQuery(''); setMobileOpen(false); setSearchOpen(false); scrollToSection('catalog');
  },[]);
  const resetFilters = () => {setQuery('');setActive('all');setShowSaved(false);setSearchOpen(false);};
  const shareSolution = useCallback(async entry => {
    const url=window.location.origin+'/#/giai-phap/'+encodeURIComponent(entry.id);
    try { await navigator.clipboard.writeText(url); setToast('Đã sao chép liên kết giải pháp. Người nhận cần đăng nhập để xem.'); }
    catch { window.prompt('Sao chép liên kết giải pháp:',url); }
  },[]);
  useEffect(() => { if (!toast) return; const timer=setTimeout(()=>setToast(''),4500); return ()=>clearTimeout(timer); },[toast]);
  async function logout() {
    try { await fetch(apiUrl('/api/auth/logout'),{method:'POST',credentials:'include'}); } catch {}
    expireSession();
  }

  useEffect(() => {
    if (authStatus!=='authenticated' || isAdminRoute) return;
    const keyboard = event => {
      if (event.defaultPrevented || document.querySelector('dialog[open]')) return;
      const typing=event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]');
      if (((event.ctrlKey || event.metaKey) && event.key.toLowerCase()==='k') || (event.key==='/' && !typing)) {
        event.preventDefault(); if (solutionPageId) backToLibrary(); requestAnimationFrame(()=>searchInputRef.current?.focus());
      }
      if (event.key==='Escape') {setMobileOpen(false);setSearchOpen(false);}
    };
    window.addEventListener('keydown',keyboard);
    return ()=>window.removeEventListener('keydown',keyboard);
  },[authStatus,solutionPageId,backToLibrary]);
  useEffect(() => {
    if (!mobileOpen) return;
    const opener=document.activeElement;
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const node=sidebarRef.current;
    node?.querySelector('button')?.focus({preventScroll:true});
    const trap=event=>{
      if(event.key!=='Tab')return;
      const list=[...(node?.querySelectorAll('a[href],button:not([disabled])') || [])].filter(el=>el.getClientRects().length);
      const first=list[0],last=list[list.length-1];
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
    };
    node?.addEventListener('keydown',trap);
    return ()=>{document.body.style.overflow=previous;node?.removeEventListener('keydown',trap);if(opener?.isConnected)opener.focus({preventScroll:true});};
  },[mobileOpen]);
  useEffect(() => {
    const node=heroRef.current;
    if (!node) return;
    let visible=true;
    const update=()=>node.classList.toggle('is-paused',document.hidden || !visible);
    const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;update();});
    observer.observe(node); document.addEventListener('visibilitychange',update);
    return ()=>{observer.disconnect();document.removeEventListener('visibilitychange',update);};
  },[authStatus,solutionPageId]);

  if(authStatus==='checking')return <LoadingPanel/>;
  if(authStatus!=='authenticated')return <AsyncPanel resetKey="login"><LoginScreen status={authStatus} adminMode={isAdminRoute} onLogin={acceptSession}/></AsyncPanel>;
  if(isAdminRoute)return <AsyncPanel resetKey="admin"><Admin user={currentUser} onLogout={logout}/></AsyncPanel>;

  const access=accessLevels[currentUser?.role] || accessLevels.member;
  const searching=Boolean(query.trim());
  const fileResult=doc=><button type="button" className="document-result compact" onClick={()=>openDocument(doc)} key={doc.id}><span className="file-type">{doc.extension || 'FILE'}</span><span className="file-info"><b>{doc.name}</b><small>{doc.entryName ? doc.entryName+' · ' : ''}{doc.folder || 'Thư mục gốc'} · {formatSize(doc.size)}</small></span><Eye size={16}/></button>;
  const publicHome=<div className={'app-shell'+(sidebarCollapsed?' sidebar-is-collapsed':'')}>
    <a href="#catalog" className="library-skip-link">Đến danh mục giải pháp</a>
    <aside ref={sidebarRef} className={'sidebar'+(mobileOpen?' open':'')} role={mobileOpen?'dialog':undefined} aria-modal={mobileOpen?true:undefined} aria-label="Điều hướng thư viện">
      <button type="button" className="mobile-close" onClick={()=>setMobileOpen(false)} aria-label="Đóng menu"><X size={18}/></button>
      <a className="brand brand-asic" href="#top" onClick={()=>setMobileOpen(false)}><span className="brand-asic-logo"><img src="/logos/logo-ASIC.png" alt="ASIC CyberSecurity" width="178" height="58"/></span></a>
      <div className="workspace"><span className="workspace-icon workspace-asic-icon"><img src="/logos/logo-ASIC.png" alt="" width="28" height="28"/></span><span><b>ASIC Library</b><small>Không gian kiến thức nội bộ</small></span></div>
      <div className="side-label">KHÁM PHÁ THƯ VIỆN</div>
      <nav className="nav-list">{groups.map(group=>{const Icon=icons[group.icon] || Shield;return <button type="button" key={group.id} title={group.short} aria-current={active===group.id&&!showSaved?'page':undefined} className={'nav-item'+(active===group.id&&!showSaved?' selected':'')} onClick={()=>selectCatalogGroup(group.id)}><Icon size={16}/><span>{group.short}</span><small>{group.id==='all'?allSolutions.length:groupCounts[group.id] || 0}</small></button>;})}<button type="button" title="Đã lưu" aria-current={showSaved?'page':undefined} className={'nav-item'+(showSaved?' selected':'')} onClick={showSavedEntries}><Bookmark size={16}/><span>Đã lưu</span><small>{savedCount}</small></button></nav>
      <div className="sidebar-spacer"/><a className="nav-item" href="https://works.kaliot.online"><Grid2X2 size={16}/><span>Không gian dự án</span></a>{['admin','editor'].includes(currentUser?.role)&&<a className="nav-item" href="/admin"><ShieldCheck size={16}/><span>Quản trị thư viện</span></a>}
      <div className="side-note"><div className="note-icon"><FolderOpen size={16}/></div><b>{apiOnline?totalDocuments+' tài liệu trong thư viện':'Dữ liệu chưa sẵn sàng'}</b><p>{apiOnline&&indexedAt?'Cập nhật '+new Date(indexedAt).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}):'Thử làm mới để kết nối lại thư viện.'}</p><span className={'api-state'+(apiOnline?' online':'')}><i/>{apiOnline?'ĐÃ KẾT NỐI':'CHƯA KẾT NỐI'}</span></div>
      <div className={'profile profile-'+access.tone} title={currentUser.displayName+' · '+access.label}><div className="avatar">{(currentUser.displayName || 'P').slice(0,1).toUpperCase()}</div><span><b>{currentUser.displayName || 'Thành viên'}</b><small>{access.caption}</small></span><span className="profile-level">{access.label}</span><span className="online-dot"/></div>
    </aside>
    {mobileOpen&&<button type="button" className="scrim" aria-label="Đóng menu" onClick={()=>setMobileOpen(false)}/>}
    <main id="top" className="main-area">
      <header className="topbar">
        <button type="button" className="mobile-menu" onClick={()=>setMobileOpen(true)} aria-label="Mở menu" aria-expanded={mobileOpen}><Menu size={19}/></button>
        <button type="button" className="sidebar-toggle" onClick={()=>setSidebarCollapsed(previous=>{writePreference('tonghop.sidebar-collapsed',!previous);return !previous;})} aria-label={sidebarCollapsed?'Mở rộng thanh bên':'Thu gọn thanh bên'} aria-expanded={!sidebarCollapsed} title={sidebarCollapsed?'Mở rộng thanh bên':'Thu gọn thanh bên'}>{sidebarCollapsed?<PanelLeftOpen size={17}/>:<PanelLeftClose size={17}/>}</button>
        <div className="crumb">THƯ VIỆN <span>/</span><b>{showSaved?'ĐÃ LƯU':active==='all'?'TỔNG QUAN':selectedGroup?.short.toUpperCase()}</b></div>
        <div className="top-actions"><button type="button" className="library-refresh" disabled={catalogState==='loading'} onClick={()=>setCatalogRevision(value=>value+1)} title="Làm mới thư viện"><RefreshCw size={15}/><span className="library-refresh-label">Làm mới</span></button><span className="secure-status"><i/>{access.label}</span><button type="button" className="logout-button" onClick={logout}>Đăng xuất</button></div>
      </header>
      <div className="content-wrap">
        <div className="library-welcome"><div><span>KHÔNG GIAN LÀM VIỆC / {access.label}</span><h2>Chào {currentUser.displayName || 'bạn'}, khám phá thư viện nhé.</h2></div><span className="library-welcome-meta"><ShieldCheck size={14}/> Dành riêng cho thành viên ASIC</span></div>
<section ref={heroRef} className="hero"><div className="hero-grid"/><div className="hero-content"><div className="eyebrow"><i className="pulse"/> ASIC KNOWLEDGE LIBRARY <span className="eyebrow-line"/></div><h1>Hiểu giải pháp.<br/><em>Tìm đúng tài liệu.</em></h1><p>Giải pháp, bài viết và tài liệu kỹ thuật được kết nối trong một không gian. Tìm theo hãng, lĩnh vực hoặc bài toán bạn đang xử lý.</p><div className="hero-actions"><button type="button" onClick={()=>scrollToSection('catalog')}>Khám phá giải pháp <ArrowDownRight size={16}/></button><span>{allSolutions.length} giải pháp <i/> {allCollections.length} thư viện dùng chung</span></div><div className="hero-meta"><span><ShieldCheck size={14}/> Tra cứu nội bộ</span><i className="meta-divider"/><span className="library-hero-status" data-offline={!apiOnline}><i className="live-dot"/>{apiOnline?'Thư viện đã sẵn sàng':'Đang chờ kết nối thư viện'}</span></div></div><div className="hero-visual"><MemoNetworkMap active={active} onSelect={selectCatalogGroup}/></div></section>

        <section className="search-section" aria-label="Tra cứu thư viện" onFocus={()=>setSearchOpen(true)}>
          <div className="search-box"><Search size={19}/><input ref={searchInputRef} value={query} maxLength={200} onChange={event=>{setQuery(event.target.value);setSearchOpen(true);}} onKeyDown={event=>{if(event.key==='Enter'){setSearchOpen(false);scrollToSection('catalog');}if(event.key==='ArrowDown')document.querySelector('.document-search .document-result')?.focus();}} placeholder="Tìm giải pháp, hãng hoặc tên tài liệu…" aria-label="Tìm trong thư viện" aria-controls={searchOpen&&documentSearchStatus!=='idle'?'library-search-results':undefined} aria-expanded={searchOpen&&documentSearchStatus!=='idle'}/>{query&&<button type="button" className="library-search-clear" onClick={()=>{setQuery('');searchInputRef.current?.focus();}} aria-label="Xóa từ khóa"><X size={15}/></button>}<kbd><Command size={12}/> K</kbd><button type="button" className="search-submit" aria-label="Đến danh mục kết quả" onClick={()=>{setSearchOpen(false);scrollToSection('catalog');}}><ArrowUpRight size={18}/></button></div>
          <div className="quick-hints"><span>TÌM NHANH</span>{['SIEM','Zero Trust','OSINT','Blancco'].map(term=><button type="button" key={term} onClick={()=>{setQuery(term);setSearchOpen(true);}}>{term}</button>)}</div>
          {searchOpen&&documentSearchStatus!=='idle'&&<div className="document-search" id="library-search-results"><div className="document-search-title"><span>{documentSearchStatus==='loading'?'ĐANG TÌM TÀI LIỆU':documentSearchStatus==='ready'?'TÀI LIỆU TRÙNG KHỚP':'CHƯA THỂ TÌM TÀI LIỆU'}</span><small>{documentSearchStatus==='ready'?documentMatches.length+' kết quả':''}</small><button type="button" className="library-search-clear" aria-label="Đóng kết quả tài liệu" onClick={()=>setSearchOpen(false)}><X size={14}/></button></div>{['error','offline'].includes(documentSearchStatus)&&<div className="document-search-message">Chưa kết nối được thư viện tài liệu. Bạn có thể tìm giải pháp bên dưới và thử làm mới.</div>}{documentSearchStatus==='ready'&&!documentMatches.length&&<div className="document-search-message">Chưa có tài liệu khớp từ khóa. Kết quả giải pháp hiển thị bên dưới.</div>}{documentMatches.slice(0,showAllDocumentMatches?60:6).map(fileResult)}{documentMatches.length>6&&<button type="button" className="document-search-more" onClick={()=>setShowAllDocumentMatches(value=>!value)}>{showAllDocumentMatches?'Thu gọn danh sách':'Xem thêm '+(documentMatches.length-6)+' tài liệu'}</button>}</div>}
        </section>
        <section className="metrics" aria-label="Số liệu thư viện"><div className="metric"><span className="metric-icon"><Grid2X2 size={15}/></span><span><b>{String(allSolutions.length).padStart(2,'0')}</b><small>GIẢI PHÁP</small></span></div><i className="metric-separator"/><div className="metric"><span className="metric-icon"><Shield size={15}/></span><span><b>{groups.length-1}</b><small>LĨNH VỰC</small></span></div><i className="metric-separator"/><div className="metric"><span className="metric-icon"><FileText size={15}/></span><span><b>{apiOnline?totalDocuments:'—'}</b><small>TÀI LIỆU</small></span></div><div className="metrics-note"><Bookmark size={14}/>{savedCount} giải pháp đã lưu trên thiết bị này</div></section>
        {!searching&&active==='all'&&!showSaved&&<RecentSolutions entries={recentEntries} onOpen={openSolutionPage} onClear={()=>setRecent([])}/>}

        <section id="catalog" className="catalog"><div className="section-heading"><div><div className="section-kicker">DANH MỤC GIẢI PHÁP <i/></div><h2>{showSaved?'Giải pháp đã lưu':active==='all'?'Khám phá theo lĩnh vực':selectedGroup?.name}<span className="result-count">{visible.length}</span></h2><p>{showSaved?'Lối tắt đến các giải pháp bạn thường sử dụng.':searching?'Kết quả theo tên, chủ đề và mô tả giải pháp.':'Mỗi lĩnh vực là một không gian. Mỗi giải pháp là một điểm bắt đầu.'}</p></div><div className="catalog-controls"><div className="catalog-view" role="group" aria-label="Chế độ hiển thị"><button type="button" aria-pressed={view==='grid'} aria-label="Xem dạng lưới" onClick={()=>setView('grid')}><Grid2X2 size={16}/></button><button type="button" aria-pressed={view==='list'} aria-label="Xem dạng danh sách" onClick={()=>setView('list')}><List size={16}/></button></div><label className="sort-control"><span>SẮP XẾP</span><select aria-label="Sắp xếp giải pháp" value={sort} onChange={event=>setSort(event.target.value)}><option value="A–Z">Tên A–Z</option><option value="Z–A">Tên Z–A</option><option value="documents">Nhiều tài liệu nhất</option></select><ChevronDown size={13}/></label></div></div>
          <div className="category-strip" role="group" aria-label="Lọc giải pháp theo lĩnh vực"><button type="button" aria-pressed={active==='all'} className={'category-chip'+(active==='all'?' active':'')} onClick={()=>selectCatalogGroup('all')}><Grid2X2 size={13}/>Tất cả<span>{allSolutions.length}</span></button>{groups.slice(1).map(group=>{const Icon=icons[group.icon] || Shield;return <button type="button" key={group.id} aria-pressed={active===group.id} className={'category-chip'+(active===group.id?' active':'')} onClick={()=>selectCatalogGroup(active===group.id?'all':group.id)}><Icon size={13}/>{group.short}<span>{groupCounts[group.id] || 0}</span></button>;})}</div>
          {(searching||active!=='all'||showSaved)&&<div className="catalog-filter-summary" role="status"><span>{visible.length} giải pháp{searching?' cho “'+query+'”':''}{showSaved?' trong mục đã lưu':''}</span><button type="button" onClick={resetFilters}><X size={12}/> Xóa bộ lọc</button></div>}
          {catalogState==='error'&&<div className="library-state library-state-error" role="alert"><Shield size={24}/><div><h3>Chưa kết nối được thư viện</h3><p>{remoteEntries.length?'Danh mục đang hiển thị có thể chưa được cập nhật.':'Kiểm tra kết nối và thử tải lại dữ liệu.'}</p></div><button type="button" onClick={()=>setCatalogRevision(value=>value+1)}><RefreshCw size={15}/> Thử lại</button></div>}
          {catalogState==='loading'&&!remoteEntries.length?<div className="library-skeleton" role="status" aria-label="Đang tải danh mục giải pháp">{Array.from({length:6},(_,index)=><div key={index}/>)}</div>:<>
            {!searching&&!showSaved&&active==='all'&&remoteEntries.filter(item=>item.featured).map(item=><button type="button" key={item.id} className="source-area-link" onClick={()=>openSolutionPage(item)}><span className="source-area-icon"><Radar size={16}/></span><span><b>{item.name}</b><small>{item.desc}</small></span><ArrowUpRight size={16}/></button>)}
            {visible.length?<LibraryCatalog entries={visible} savedIds={savedSet} view={view} searchTerm={deferredQuery} onOpen={openSolutionPage} onDocuments={openEntry} onToggleSave={toggleSave}/>:catalogState==='ready'&&<div className="empty-state"><Search size={28}/><h3>{showSaved?'Chưa có giải pháp đã lưu phù hợp':'Chưa tìm thấy giải pháp phù hợp'}</h3><p>{showSaved?'Bấm dấu trang trên ô giải pháp để lưu và tìm lại tại đây.':'Thử từ khóa ngắn hơn, tìm không dấu hoặc chọn lĩnh vực khác.'}</p><button type="button" onClick={resetFilters}>Xem toàn bộ danh mục <ArrowRight size={14}/></button></div>}
          </>}
          <div className="catalog-foot"><span>HIỂN THỊ <b>{visible.length}</b> GIẢI PHÁP</span><span><i/>{apiOnline?'THƯ VIỆN ĐÃ KẾT NỐI':'ĐANG CHỜ KẾT NỐI'}</span></div>
        </section>
        <section className="collections-section"><div className="section-heading compact-heading"><div><div className="section-kicker">KIẾN THỨC DÙNG CHUNG <i/></div><h2>Thư viện tham khảo</h2><p>Bộ trình bày, kiến trúc tổng thể và nội dung dành cho cả đội ngũ.</p></div></div><div className="collection-grid">{allCollections.map(item=><button type="button" className="collection-card" key={item.id} onClick={()=>openEntry(item)}><span className="collection-icon"><FolderOpen size={18}/></span><span className="collection-info"><b>{item.name}</b><small>{item.desc}</small></span><span className="collection-count">{item.documentCount}<small>TÀI LIỆU</small></span><ArrowRight size={15}/></button>)}</div></section>
        <footer><span>ASIC LIBRARY <i>·</i> KHÔNG GIAN KIẾN THỨC NỘI BỘ</span><span>Khám phá. Kết nối. Làm việc tốt hơn.</span></footer>
      </div>
    </main>
  </div>;

  let page=publicHome;
  if(solutionPageId){
    if(detailSolutionEntry)page=<AsyncPanel resetKey={solutionPageId}><SolutionDetailPage entry={detailSolutionEntry} area={{...(detailSolutionEntry.area || {}),label:groups.find(group=>group.id===detailSolutionEntry.group)?.short}} profile={detailSolutionEntry.profile} relatedItems={relatedItems} onOpenEntry={openEntry} onOpenDocument={openDocument} onOpenSolution={openSolutionPage} onLogout={logout} saved={savedSet.has(solutionPageId)} onToggleSave={toggleSave} onShare={shareSolution} onBack={backToLibrary} loadDocuments={getDocuments}/></AsyncPanel>;
    else if(catalogState==='loading'||catalogState==='idle')page=<LoadingPanel/>;
    else page=<div className="route-loading"><FileText size={30}/><h1>{catalogState==='error'?'Chưa tải được giải pháp':'Giải pháp chưa có trong thư viện'}</h1><p>{catalogState==='error'?'Thử kết nối lại để đọc nội dung.':'Nội dung có thể đã được cập nhật hoặc ngừng xuất bản.'}</p>{catalogState==='error'&&<button type="button" onClick={()=>setCatalogRevision(value=>value+1)}>Thử lại</button>}<button type="button" onClick={backToLibrary}>Về thư viện</button></div>;
  }
  return <>{page}
    {detailEntry&&<AsyncPanel overlay resetKey={'documents-'+detailEntry.id}><DocumentWorkspace entry={detailEntry} documents={detailDocuments} loading={detailLoading} error={detailError} onClose={()=>setDetailEntry(null)} onPreview={openDocument} onRetry={()=>setDocumentRevision(value=>value+1)}/></AsyncPanel>}
    {previewDoc&&<AsyncPanel overlay resetKey={'preview-'+previewDoc.id}><FilePreview document={previewDoc} onClose={()=>setPreviewDoc(null)} onSessionExpired={expireSession}/></AsyncPanel>}
    {toast&&<div className="library-toast" role="status"><ShieldCheck size={18}/><span>{toast}</span><button type="button" onClick={()=>setToast('')} aria-label="Đóng thông báo"><X size={15}/></button></div>}
  </>;
}







