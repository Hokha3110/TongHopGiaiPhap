import { Component, Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BriefcaseBusiness, CalendarDays, CheckCheck, ChevronLeft, ChevronRight, CircleAlert, Clock3, Eye, EyeOff, FolderKanban, LayoutDashboard, LayoutGrid, ListFilter, LoaderCircle, LockKeyhole, LogOut, Plus, RefreshCw, Search, ShieldCheck, Users } from 'lucide-react';
import asicLogo from '../../public/logos/logo-ASIC.png';
import { STAGES, STATUSES, POC_LABELS, formatDate, isOverdue, stageLabel, statusLabel, worksRequest } from './model.js';

const ProjectDetail = lazy(() => import('./ProjectDetail.jsx'));
const ProjectForm = lazy(() => import('./ProjectForm.jsx'));
const initialRoute = () => {
  const hash = window.location.hash;
  if (hash === '#/new') return { type:'new' };
  const match = hash.match(/^#\/project\/([a-f0-9]{28})$/);
  return match ? { type:'detail', id:match[1] } : { type:'list' };
};
const emptyList = { items:[], total:0, stats:{total:0,active:0,blocked:0,completed:0,overdue:0} };

class PanelBoundary extends Component {
  state = { failed:false };
  static getDerivedStateFromError() { return { failed:true }; }
  render() {
    return this.state.failed ? <div className="works-empty"><CircleAlert size={32}/><h2>Chưa mở được trang này</h2><p>Tải lại để nhận phiên bản giao diện mới nhất.</p><button className="works-button" onClick={() => window.location.reload()}>Tải lại trang</button></div> : this.props.children;
  }
}
function Loading({ text = 'Đang tải không gian làm việc…' }) {
  return <div className="works-loading" role="status"><LoaderCircle size={25}/><p>{text}</p></div>;
}
function Login({ onLogin, unavailable, onRetry }) {
  const [username,setUsername] = useState('');
  const [password,setPassword] = useState('');
  const [show,setShow] = useState(false);
  const [captcha,setCaptcha] = useState(null);
  const [answer,setAnswer] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const data = await worksRequest('auth/login',{method:'POST',body:JSON.stringify({username,password,captchaToken:captcha?.token,captchaAnswer:answer})});
      setPassword(''); onLogin(data.user);
    } catch (problem) {
      if (problem.data?.captchaRequired) {setCaptcha(problem.data.captcha);setAnswer('');}
      setError(problem.message);
    } finally {setBusy(false);}
  }
  return <main className="works-login"><section className="works-login-intro"><div className="works-login-brand"><img src={asicLogo} alt="ASIC CyberSecurity"/><span>WORKS / PROJECT SPACE</span></div><span className="works-kicker">TỪ YÊU CẦU ĐẾN KẾT QUẢ</span><h1>Hiểu việc cần làm.<br/><em>Theo sát từng dự án.</em></h1><p>Mục tiêu rõ ràng. Đầu vào đầy đủ. Đầu ra đo được. Một nơi để theo dõi công việc, PoC và những bước tiếp theo.</p><div className="works-login-steps"><span>01 · Pre-sale</span><ArrowRight size={16}/><span>02 · Onsite</span><ArrowRight size={16}/><span>03 · Post-sale</span></div></section><section className="works-login-card"><span className="works-kicker"><LockKeyhole size={15}/> KHÔNG GIAN NỘI BỘ</span><h2>Chào bạn trở lại.</h2><p>Dùng tài khoản thư viện ASIC để quản lý dự án của bạn.</p>{unavailable ? <div className="works-error" role="alert">Chưa kết nối được máy chủ. <button className="works-button" onClick={onRetry}>Thử kết nối lại</button></div> : <form onSubmit={submit}><label>Tên đăng nhập<input autoComplete="username" value={username} onChange={event=>setUsername(event.target.value)} required maxLength={80}/></label><label>Mật khẩu<div className="works-password"><input type={show?'text':'password'} autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} required maxLength={256}/><button type="button" aria-label={show?'Ẩn mật khẩu':'Hiện mật khẩu'} onClick={()=>setShow(!show)}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>{captcha&&<label>Xác thực: {captcha.question}<input inputMode="numeric" autoComplete="off" value={answer} onChange={event=>setAnswer(event.target.value)} required/></label>}{error&&<div className="works-error" role="alert">{error}</div>}<button type="submit" className="works-button primary" disabled={busy}>{busy?<LoaderCircle size={17}/>:<ArrowRight size={17}/>} {busy?'Đang đăng nhập…':'Vào không gian dự án'}</button></form>}<div className="works-login-private"><ShieldCheck size={17}/><small>Dự án chỉ hiển thị với bạn, thành viên được mời và quản trị viên.</small></div></section></main>;
}

function ProjectCard({ project, onOpen, compact = false }) {
  const late = isOverdue(project);
  return <button type="button" className={'works-project-card'+(compact?' compact':'')} onClick={()=>onOpen(project.id)} aria-label={'Mở dự án '+project.name}>
    <div className="works-card-head"><span className="works-stage" data-stage={project.stage}>{stageLabel(project.stage)}</span><span className="works-status" data-status={project.status}>{statusLabel(project.status)}</span></div>
    <div className="works-card-customer">{project.customer || 'Chưa ghi khách hàng'}</div><h3>{project.name}</h3><p>{project.nextStep || project.description || 'Mở dự án để ghi mục tiêu, đầu vào và kết quả cần đạt.'}</p>
    <div className="works-progress-label"><span>Tiến độ tổng thể</span><b>{project.progress}%</b></div><div className="works-progress" role="progressbar" aria-valuenow={project.progress} aria-valuemin={0} aria-valuemax={100} aria-label={'Tiến độ '+project.name}><span style={{width:project.progress+'%'}}/></div>
    <div className="works-card-dates" data-overdue={late}><CalendarDays size={14}/><span>{project.startDate ? formatDate(project.startDate) : 'Chưa bắt đầu lịch'} → {project.endDate ? formatDate(project.endDate) : 'Chưa có hạn'}</span>{late&&<strong>Quá hạn</strong>}</div>
    <div className="works-card-meta"><span>{POC_LABELS[project.pocStatus || project.poc?.status] || 'Chưa có PoC'}</span><span><CheckCheck size={13}/>{project.testCasesPassed || 0}/{project.testCasesTotal || 0} test đạt</span></div><div className="works-card-owner"><span>{project.ownerName || 'Chủ dự án'}</span><span>{project.canEdit?'Có thể cập nhật':'Chỉ xem'} <ArrowRight size={14}/></span></div>
  </button>;
}

export default function WorksApp() {
  const [auth,setAuth] = useState('loading');
  const [user,setUser] = useState(null);
  const [sessionRevision,setSessionRevision] = useState(0);
  const [route,setRoute] = useState(initialRoute);
  const [query,setQuery] = useState('');
  const [search,setSearch] = useState('');
  const [stage,setStage] = useState('');
  const [status,setStatus] = useState('');
  const [archived,setArchived] = useState(false);
  const [view,setView] = useState('grid');
  const [page,setPage] = useState(1);
  const [list,setList] = useState(emptyList);
  const [loading,setLoading] = useState(true);
  const [listError,setListError] = useState('');
  const [listRevision,setListRevision] = useState(0);
  const [project,setProject] = useState(null);
  const [detailLoading,setDetailLoading] = useState(false);
  const [detailError,setDetailError] = useState('');
  const [detailRevision,setDetailRevision] = useState(0);
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState('');
  function expire() {setUser(null);setAuth('login');setList(emptyList);setProject(null);setDetailError('');setNotice('');}
  function accept(value) {setUser(value);setAuth('ready');setPage(1);setListRevision(n=>n+1);}
  function navigate(next) {window.location.hash = next;}
  function back() {navigate('/');}
  useEffect(()=>{const sync=()=>{const next=initialRoute();setRoute(next);setProject(null);setDetailLoading(next.type==='detail');setDetailError('');window.scrollTo({top:0,behavior:'instant'});};window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync);},[]);
  useEffect(()=>{
    const controller = new AbortController(); setAuth('loading');
    worksRequest('auth/session',{signal:controller.signal}).then(data=>{if(!controller.signal.aborted){if(data.authenticated&&data.user)accept(data.user);else setAuth('login');}}).catch(()=>{if(!controller.signal.aborted)setAuth('unavailable');});
    return()=>controller.abort();
  },[sessionRevision]);
  useEffect(()=>{const timer=setTimeout(()=>{setSearch(query.trim());setPage(1);},250);return()=>clearTimeout(timer);},[query]);
  useEffect(()=>{
    if(auth!=='ready')return;
    const controller = new AbortController(); setLoading(true);setListError('');
    const parameters = new URLSearchParams({q:search,stage,status,archived:String(archived),page:String(page),limit:'24'});
    worksRequest('projects?'+parameters,{signal:controller.signal}).then(data=>{if(!controller.signal.aborted)setList(data);}).catch(error=>{if(!controller.signal.aborted){if(error.status===401)expire();else setListError(error.message);}}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[auth,user?.id,search,stage,status,archived,page,listRevision]);
  useEffect(()=>{
    if(auth!=='ready'||route.type!=='detail')return;
    const controller=new AbortController(); setDetailLoading(true);setDetailError('');setProject(null);
    worksRequest('projects/'+route.id,{signal:controller.signal}).then(data=>{if(!controller.signal.aborted)setProject(data.project);}).catch(error=>{if(!controller.signal.aborted){if(error.status===401)expire();else setDetailError(error.message);}}).finally(()=>{if(!controller.signal.aborted)setDetailLoading(false);});
    return()=>controller.abort();
  },[auth,user?.id,route.type,route.id,detailRevision]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),6000);return()=>clearTimeout(timer);},[notice]);
  async function save(changes) {
    setBusy(true);setDetailError('');
    try {
      const data=await worksRequest('projects/'+project.id,{method:'PATCH',body:JSON.stringify({...changes,revision:project.revision})});
      setProject(data.project);setListRevision(n=>n+1);return data.project;
    } catch(error){if(error.status===401)expire();else setDetailError(error.message);throw error;}finally{setBusy(false);}
  }
  async function create(values) {
    setBusy(true);setDetailError('');
    try {
      const data=await worksRequest('projects',{method:'POST',body:JSON.stringify(values)});
      setListRevision(n=>n+1);setNotice('Đã tạo dự án. Bổ sung công việc và kế hoạch PoC để bắt đầu.');navigate('/project/'+data.project.id);return data.project;
    }catch(error){if(error.status===401)expire();else setDetailError(error.message);throw error;}finally{setBusy(false);}
  }
  async function searchPeople(value) {
    try {return (await worksRequest('projects/people?q='+encodeURIComponent(value))).items || [];}
    catch(error){if(error.status===401)expire();throw error;}
  }
  async function logout() {
    setBusy(true);
    try {await worksRequest('auth/logout',{method:'POST'});expire();}
    catch(error){setNotice('Chưa đăng xuất được. Kiểm tra kết nối rồi thử lại.');}
    finally{setBusy(false);}
  }
  const board=useMemo(()=>STAGES.map(item=>({...item,projects:list.items.filter(project=>project.stage===item.value)})),[list.items]);
  const filtered=Boolean(query||stage||status);
  const stats=list.stats || emptyList.stats;
  const pages=Math.max(1,Math.ceil(list.total/24));
  function reset() {setQuery('');setSearch('');setStage('');setStatus('');setPage(1);}
  function chooseArchive(value){setArchived(value);reset();back();}
  if(auth==='loading')return <main className="works-login"><Loading/></main>;
  if(auth!=='ready')return <Login onLogin={accept} unavailable={auth==='unavailable'} onRetry={()=>setSessionRevision(n=>n+1)}/>;
return <div className="works-app"><a className="works-skip" href="#works-content" onClick={event=>{event.preventDefault();const content=document.getElementById('works-content');content?.focus({preventScroll:true});content?.scrollIntoView({block:'start'});}}>Đến nội dung chính</a><aside className="works-sidebar"><a className="works-brand" href="#/" aria-label="ASIC Works - Dự án"><img className="works-brand-logo" src={asicLogo} alt="ASIC CyberSecurity"/><span>WORKS<small>KHÔNG GIAN DỰ ÁN</small></span></a><span className="works-nav-label">KHÔNG GIAN LÀM VIỆC</span><nav className="works-nav" aria-label="Điều hướng dự án"><button className={route.type==='list'&&!archived&&view==='grid'?'active':''} onClick={()=>{chooseArchive(false);setView('grid');}}><LayoutDashboard size={18}/>Dự án của tôi</button><button className={route.type==='list'&&!archived&&view==='board'?'active':''} onClick={()=>{chooseArchive(false);setView('board');}}><FolderKanban size={18}/>Bảng giai đoạn</button><button className={archived?'active':''} onClick={()=>chooseArchive(true)}><BriefcaseBusiness size={18}/>Dự án lưu trữ</button></nav><div className="works-sidebar-note"><ShieldCheck size={20}/><b>Không gian riêng tư</b><p>Bạn thấy dự án mình tham gia. Thêm thành viên trong từng dự án để cùng cập nhật.</p>{user.role==='admin'&&<small>Tài khoản admin có thể quản lý tất cả dự án.</small>}</div><a className="works-library-link" href="https://kaliot.online"><ArrowLeft size={16}/>Thư viện giải pháp</a><div className="works-user"><span>{(user.displayName||user.username||'?').slice(0,1).toUpperCase()}</span><div><b>{user.displayName||user.username}</b><small>{user.role==='admin'?'Quản trị viên':'Thành viên nội bộ'}</small></div><button type="button" className="works-icon-button" aria-label="Đăng xuất" onClick={logout} disabled={busy}><LogOut size={17}/></button></div></aside>
    <main className="works-main"><header className="works-topbar"><div><span>ASIC WORKS</span><i>/</i><b>{route.type==='new'?'Dự án mới':route.type==='detail'?'Chi tiết dự án':archived?'Đã lưu trữ':'Tổng quan dự án'}</b></div><span className="works-private-pill"><LockKeyhole size={13}/>Truy cập riêng tư</span></header><div className="works-content" id="works-content" tabIndex={-1}>
      {notice&&<div className="works-notice" role="status">{notice}<button type="button" aria-label="Đóng thông báo" onClick={()=>setNotice('')}>×</button></div>}
      <PanelBoundary key={route.type+(route.id||'')}><Suspense fallback={<Loading/>}>
      {route.type==='new'?<><div className="works-heading"><div><span className="works-kicker">BẮT ĐẦU TỪ MỤC TIÊU</span><h1>Tạo dự án mới</h1><p>Vì sao cần làm, cần gì để bắt đầu, và kết quả nào xác nhận đã hoàn thành?</p></div></div><ProjectForm onSubmit={create} onCancel={back} busy={busy} error={detailError}/></>
        :route.type==='detail'?detailLoading?<Loading text="Đang mở dự án…"/>:project?<ProjectDetail project={project} onSave={save} onBack={back} busy={busy} error={detailError} onSearchPeople={searchPeople}/>:<div className="works-empty"><CircleAlert size={32}/><h2>Chưa mở được dự án</h2><p role="alert">{detailError || 'Dự án không còn tồn tại hoặc bạn chưa được cấp quyền.'}</p><button className="works-button" onClick={back}>Về danh sách</button><button className="works-button" onClick={()=>setDetailRevision(n=>n+1)}>Thử lại</button></div>
        :<><div className="works-heading"><div><span className="works-kicker">MỖI CÔNG VIỆC ĐỀU CÓ MỤC ĐÍCH</span><h1>{archived?'Dự án đã lưu trữ':'Nắm rõ việc. Theo sát tiến độ.'}</h1><p>{archived?'Tra cứu dự án cũ và mở lại khi cần tiếp tục.':'Từ khảo sát đến bàn giao — biết đang ở đâu và bước tiếp theo là gì.'}</p></div><button type="button" className="works-button primary" onClick={()=>navigate('/new')}><Plus size={18}/>Tạo dự án</button></div>
        <div className="works-stats" aria-label="Tình hình dự án đang quản lý">{[{label:'Tổng dự án',value:stats.total,Icon:BriefcaseBusiness},{label:'Đang thực hiện',value:stats.active,Icon:Clock3},{label:'Cần gỡ vướng',value:stats.blocked,Icon:CircleAlert},{label:'Quá hạn',value:stats.overdue,Icon:CalendarDays}].map(({label,value,Icon})=><article className="works-stat" key={label}><span><Icon size={18}/>{label}</span><strong>{value}</strong><small>Trong các dự án chưa lưu trữ</small></article>)}</div>
        <section aria-label="Danh mục dự án"><div className="works-toolbar"><label className="works-search"><Search size={18}/><span className="works-sr-only">Tìm tên hoặc khách hàng</span><input type="search" placeholder="Tìm dự án, khách hàng…" value={query} maxLength={200} onChange={event=>setQuery(event.target.value)}/></label><div className="works-filters"><label><span className="works-sr-only">Lọc giai đoạn</span><select value={stage} onChange={event=>{setStage(event.target.value);setPage(1);}}><option value="">Tất cả giai đoạn</option>{STAGES.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label><span className="works-sr-only">Lọc trạng thái</span><select value={status} onChange={event=>{setStatus(event.target.value);setPage(1);}}><option value="">Tất cả trạng thái</option>{STATUSES.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div><div className="works-view-switch" role="group" aria-label="Kiểu hiển thị"><button type="button" aria-label="Xem thẻ dự án" aria-pressed={view==='grid'} onClick={()=>setView('grid')}><LayoutGrid size={18}/></button><button type="button" aria-label="Xem bảng giai đoạn" aria-pressed={view==='board'} onClick={()=>setView('board')}><FolderKanban size={18}/></button></div><button type="button" className="works-icon-button" title="Làm mới dự án" aria-label="Làm mới dự án" onClick={()=>setListRevision(n=>n+1)} disabled={loading}><RefreshCw size={17}/></button></div>
        <div className="works-result-count" role="status"><span>{loading?'Đang cập nhật…':`${list.total} dự án${filtered?' phù hợp':''}`}</span>{filtered&&<button type="button" className="works-button subtle" onClick={reset}><ListFilter size={14}/>Xóa bộ lọc</button>}</div>
        {listError&&<div className="works-error" role="alert"><CircleAlert size={18}/>{listError}<button type="button" className="works-button" onClick={()=>setListRevision(n=>n+1)}>Thử lại</button></div>}
        {loading&&!list.items.length?<Loading text="Đang tải dự án…"/>:!list.items.length&&!listError?<div className="works-empty"><FolderKanban size={40}/><h2>{filtered?'Chưa tìm thấy dự án phù hợp':archived?'Chưa có dự án lưu trữ':'Dự án đầu tiên bắt đầu từ đây'}</h2><p>{filtered?'Thử từ khóa khác hoặc mở rộng bộ lọc.':'Tạo dự án, ghi rõ mục tiêu và chia thành những công việc có đầu vào, đầu ra cụ thể.'}</p><button type="button" className="works-button primary" onClick={filtered?reset:()=>navigate('/new')}>{filtered?'Xóa bộ lọc':'Tạo dự án đầu tiên'}<ArrowRight size={16}/></button></div>
          :view==='grid'?<div className="works-project-grid" aria-busy={loading}>{list.items.map(item=><ProjectCard key={item.id} project={item} onOpen={id=>navigate('/project/'+id)}/>)}</div>:<div className="works-board" aria-busy={loading}>{board.map(column=><section className="works-board-column" key={column.value}><header className="works-board-heading"><div><span className="works-stage" data-stage={column.value}>{column.label}</span><small>{column.hint}</small></div><b>{column.projects.length}</b></header>{column.projects.length?column.projects.map(item=><ProjectCard key={item.id} compact project={item} onOpen={id=>navigate('/project/'+id)}/>):<p className="works-board-empty">Chưa có dự án ở giai đoạn này trên trang hiện tại.</p>}</section>)}</div>}
        {list.total>0&&<div className="works-pagination"><span>Trang {page}/{pages} · Tối đa 24 dự án mỗi trang</span><button type="button" className="works-button" disabled={page<=1||loading} onClick={()=>setPage(value=>value-1)} aria-label="Trang trước"><ChevronLeft size={17}/></button><button type="button" className="works-button" disabled={page>=pages||loading} onClick={()=>setPage(value=>value+1)} aria-label="Trang sau"><ChevronRight size={17}/></button></div>}</section></>}
      </Suspense></PanelBoundary>
    </div></main></div>;
}
