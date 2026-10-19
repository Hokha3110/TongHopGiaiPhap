import Admin from './Admin.jsx';
import Article, { mediaUrl } from './Article.jsx';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, ChevronDown,
  Command, FileText, Fingerprint, FlaskConical, FolderOpen, Gauge, Grid2X2,
  Download, Eye, EyeOff, ExternalLink, LockKeyhole, Menu, PanelLeftClose, PanelLeftOpen, Radar, Search, Shield, ShieldCheck, X, Code2,
} from 'lucide-react';
import { groups } from './data/catalog.js';
import { localBrandLogos } from './data/brandAssets.js';


const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
const apiUrl = path => `${API_BASE}${path}`;
const fileUrl = path => path?.startsWith('http') ? path : apiUrl(path || '');
const icons = { grid: Grid2X2, lock: LockKeyhole, activity: Activity, flask: FlaskConical, code: Code2, fingerprint: Fingerprint, gauge: Gauge, search: Search, shield: Shield, radar: Radar };
const formatSize = bytes => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const fileExtension = doc => (doc.extension || doc.name?.split('.').pop() || '').replace(/^\./, '').toLowerCase();
const accessLevels = {
  admin: { label: 'ADMIN', caption: 'Toàn quyền hệ thống', tone: 'admin' },
  editor: { label: 'EDITOR', caption: 'Quản lý nội dung', tone: 'editor' },
  member: { label: 'MEMBER', caption: 'Truy cập nội bộ', tone: 'member' },
};
// Simple Icons serves brand symbols as SVG; keep the existing wordmark as an
// automatic fallback for vendors that are not represented in the icon set.
const brandIconSlugs = {
  '02-picus': 'picussecurity', '03-niagara': 'niagaranetworks',
  '04-apposite': 'apposite', '05-crimewall-maltego': 'maltego',
  '07-graylog': 'graylog', '08-keysight': 'keysight', '09-exxact': 'exxact',
  '10-accuknox': 'accuknox', '11-penlink': 'penlink', '12-parasoft': 'parasoft',
  '13-cimcor': 'cimcor', '14-iriusrisk': 'iriusrisk',
  '20-security-scorecard': 'securityscorecard', '21-nowsecure': 'nowsecure',
  '22-blancco': 'blancco', '24-trend-micro': 'trendmicro',
  '29-simspace': 'simspace', '666-fasoo': 'fasoo',
};
const inlineUrl = doc => fileUrl(doc.url) + (doc.url?.includes('?') ? '&' : '?') + 'view=inline';
const previewType = doc => {
  const extension = fileExtension(doc);
  if (extension === 'pdf') return 'pdf';
  if (['png','jpg','jpeg','webp','svg'].includes(extension)) return 'image';
  if (['mp4','mov','mkv','webm'].includes(extension)) return 'video';
  if (['txt','md','csv'].includes(extension)) return 'text';
  if (['docx','docm'].includes(extension)) return 'docx';
  if (['doc','rtf','xls','xlsm','xlsx','ppt','pptm','pptx','odt','ods','odp'].includes(extension)) return 'office';
  return 'other';
};
const videoTypes = { mp4: 'video/mp4', mov: 'video/quicktime', mkv: 'video/x-matroska', webm: 'video/webm' };
const readSolutionRoute = () => {
  if (typeof window === 'undefined') return '';
  const match = window.location.hash.match(/^#\/giai-phap\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
};

function DocxPreview({ source, title }) {
  const [preview, setPreview] = useState({ status: 'loading', html: '', message: '' });
  useEffect(() => {
    let active = true;
    setPreview({ status: 'loading', html: '', message: '' });
    (async () => {
      try {
        const response = await fetch(source, { credentials: 'include' });
        if (!response.ok) throw new Error('Không tải được tài liệu từ máy chủ.');
        const arrayBuffer = await response.arrayBuffer();
        const mammothModule = await import('mammoth/mammoth.browser.js');
        const mammoth = mammothModule.default || mammothModule;
        const result = await mammoth.convertToHtml({ arrayBuffer });
        const html = [
          '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<title>Tài liệu</title><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; img-src data: blob:; style-src &#39;unsafe-inline&#39;; font-src data:"><style>',
          '*{box-sizing:border-box}html{background:#e8edef}body{margin:0;padding:26px 18px;color:#20282d;font:15px/1.7 Arial,Helvetica,sans-serif}.docx-page{width:min(850px,100%);min-height:100vh;margin:0 auto;padding:54px 66px;background:#fff;box-shadow:0 4px 24px #0b1a2020;overflow-wrap:anywhere}h1,h2,h3,h4{line-height:1.3;margin:1.3em 0 .55em}p{margin:.55em 0}img{max-width:100%;height:auto}table{border-collapse:collapse;max-width:100%;width:100%;margin:1em 0}td,th{border:1px solid #9aa4a8;padding:6px 9px;vertical-align:top}ul,ol{padding-left:1.6em}pre{white-space:pre-wrap;overflow-wrap:anywhere}a{color:#087d91}',
          '@media(max-width:640px){body{padding:0}.docx-page{padding:28px 20px;box-shadow:none}}',
          '</style></head><body><article class="docx-page">', result.value, '</article></body></html>'
        ].join('');
        if (active) setPreview({ status: 'ready', html, message: '' });
      } catch {
        if (active) setPreview({ status: 'error', html: '', message: 'Không tạo được bản xem trước. Bạn vẫn có thể tải file về để mở bằng Word.' });
      }
    })();
    return () => { active = false; };
  }, [source]);
  if (preview.status === 'loading') return <div className="docx-preview-state">Đang chuẩn bị bản xem trước…</div>;
  if (preview.status === 'error') return <div className="docx-preview-state">{preview.message}</div>;
  return <div className="docx-preview-wrap"><div className="docx-preview-note">Bản xem nhanh · cách trình bày có thể khác một chút so với Word</div><iframe className="docx-preview-frame" sandbox="" srcDoc={preview.html} title={'Bản xem trước ' + title}/></div>;
}

function OfficePreview({ document }) {
  const [preview, setPreview] = useState({ status: 'loading', src: '', message: '' });
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setPreview({ status: 'loading', src: '', message: '' });
    fetch(apiUrl('/api/office-preview/' + encodeURIComponent(document.id)), { credentials: 'include' })
      .then(async response => {
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Không tạo được bản xem trước.');
        }
        const blob = await response.blob();
        if (!blob.type.includes('application/pdf')) throw new Error('Máy chủ không trả về bản xem trước PDF.');
        return URL.createObjectURL(blob);
      })
      .then(src => {
        if (active) {
          objectUrl = src;
          setPreview({ status: 'ready', src, message: '' });
        } else URL.revokeObjectURL(src);
      })
      .catch(error => {
        if (active) setPreview({ status: 'error', src: '', message: error.message });
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [document.id]);
  if (preview.status === 'loading') return <div className="office-preview-state">Đang chuyển tài liệu để xem…</div>;
  if (preview.status === 'error') return <div className="office-preview-state"><FileText size={28}/><p>{preview.message}</p><small>Bạn vẫn có thể tải file về để mở bằng ứng dụng phù hợp.</small></div>;
  return <iframe className="office-preview-frame" src={preview.src} title={'Bản xem trước ' + document.name}/>;
}

function BrandMark({ item }) {
  const [failed, setFailed] = useState(false);
  const slug = brandIconSlugs[item.id];
  const logo = mediaUrl(item.logoUrl || '') || localBrandLogos[item.id] || (slug ? `https://cdn.simpleicons.org/${slug}` : '');
  return <span className={`wordmark ${item.tone} ${item.mark.length > 8 ? 'long' : ''} ${logo && !failed ? 'has-logo' : ''} brand-${item.id}`}>
    {logo && !failed && <img src={logo} alt={`${item.name} logo`} loading="lazy" onError={() => setFailed(true)} />}
    {(!logo || failed) && item.mark}
  </span>;
}

function CodeRain() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const glyphs = '01ABCDEF<>[]{}:/$#';
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let columns = [];
    let frame = 0;
    let lastPaint = 0;
    const fontSize = 15;
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.floor(width * pixelRatio);
      canvas.height = Math.floor(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      const count = Math.ceil(width / fontSize);
      columns = Array.from({ length: count }, () => ({
        y: Math.random() * -height / fontSize,
        speed: .35 + Math.random() * 1.1,
        trail: 5 + Math.floor(Math.random() * 14),
      }));
      context.fillStyle = '#05090d';
      context.fillRect(0, 0, width, height);
    };
    const paint = (time = 0) => {
      if (document.hidden) return;
      if (time - lastPaint > 45) {
        lastPaint = time;
        context.fillStyle = 'rgba(4, 9, 13, .13)';
        context.fillRect(0, 0, width, height);
        context.font = '12px "IBM Plex Mono", monospace';
        columns.forEach((column, index) => {
          const x = index * fontSize;
          for (let step = 0; step < column.trail; step += 1) {
            const y = (column.y - step) * fontSize;
            if (y < 0 || y > height) continue;
            const glyph = glyphs[Math.floor(Math.random() * glyphs.length)];
            context.fillStyle = step === 0 ? '#c8f477' : (index % 5 === 0 ? '#35cbd0' : '#38a77b');
            context.globalAlpha = step === 0 ? .8 : Math.max(.035, .19 - step * .009);
            context.fillText(glyph, x, y);
          }
          context.globalAlpha = 1;
          column.y += column.speed;
          if ((column.y - column.trail) * fontSize > height) {
            column.y = Math.random() * -18;
            column.speed = .35 + Math.random() * 1.1;
          }
        });
      }
      if (!reducedMotion) frame = window.requestAnimationFrame(paint);
    };
    const onVisibility = () => {
      if (document.hidden) window.cancelAnimationFrame(frame);
      else paint();
    };
    resize();
    paint();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  return <canvas className="login-code-rain" ref={canvasRef} aria-hidden="true"/>;
}

function LoginScreen({ status, onLogin, adminMode = false }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captcha, setCaptcha] = useState(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event) {
    event.preventDefault();
    setBusy(true); setMessage('');
    try {
      const response = await fetch(apiUrl('/api/auth/login'), { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, captchaToken: captcha?.token, captchaAnswer }) });
      const data = await response.json().catch(() => ({}));
      if (data.captchaRequired) { setCaptcha(data.captcha || null); setCaptchaAnswer(''); }
      if (!response.ok) throw new Error(data.error || 'Chưa đăng nhập được.');
      setPassword(''); setCaptcha(null); setCaptchaAnswer(''); onLogin(data.user);
    } catch (error) { setMessage(error.message || 'Không kết nối được máy chủ.'); }
    finally { setBusy(false); }
  }
  return <main className="login-screen"><CodeRain/><div className="login-vignette" aria-hidden="true"/><div className="login-stage">
    <section className="login-system" aria-label="Cổng truy cập thư viện nội bộ">
      <div className="login-asic-brand"><span className="login-asic-logo"><img src="/logos/logo-ASIC.png" alt="ASIC CyberSecurity"/></span></div>
      <div className="login-system-kicker"><span className="login-pulse"/> PRIVATE LIBRARY <i/> ACCESS GATEWAY</div>
      <div className="login-system-title"><span>THƯ VIỆN</span><strong>GIẢI PHÁP<br/><em>AN NINH MẠNG</em></strong></div>
      <div className="login-terminal" aria-hidden="true">
        <div className="login-terminal-head"><span><i/> ACCESS GATE / 01</span><span>AUTH REQUIRED</span></div>
        <div className="login-terminal-body"><p><b>root@asic:~$</b> portal --mode=member</p><p className="terminal-dim">[NET] &nbsp; resolving internal library<span>........</span><i>OK</i></p><p className="terminal-dim">[AUTH] identity verification<span>..........</span><i className="wait">WAIT</i></p><p><b>›</b> credentials required<span className="terminal-cursor"/></p></div>
        <div className="login-terminal-foot"><span>SESSION STATE</span><b><i/> LOCKED</b><span>MEMBER ACCESS</span></div>
      </div>
      <div className="login-readout"><span><small>GATEWAY</small><b>INTERNAL</b></span><span><small>ACCESS</small><b>RESTRICTED</b></span><span><small>SESSION</small><b>12 HOURS</b></span></div>
      <div className="login-side-code" aria-hidden="true">0x7F&nbsp; AUTH_GATE<br/>0xA4&nbsp; IDENTITY<br/>0xD1&nbsp; SESSION_LOCK<br/>0x09&nbsp; ACCESS_NODE</div>
    </section>
    <div className={`login-card ${adminMode ? 'login-card-admin' : ''}`}><div className="login-card-top"><span className="login-brand"><span className="brand-mark">{adminMode ? <ShieldCheck size={20}/> : <LockKeyhole size={20}/>}</span><span><b>{adminMode ? 'ADMIN CONTROL' : 'MEMBER LOGIN'}</b><small>{adminMode ? 'QUẢN TRỊ HỆ THỐNG' : 'ĐĂNG NHẬP NỘI BỘ'}</small></span></span><span className={`gateway-state ${status === 'unavailable' ? 'offline' : ''}`}><i/>{status === 'unavailable' ? 'OFFLINE' : status === 'checking' ? 'CHECKING' : adminMode ? 'ADMIN GATE' : 'GATEWAY'}</span></div><h1>{adminMode ? <>Admin <em>Access</em></> : <>Login now! <em>Bro</em></>}</h1><p className="login-intro">{adminMode ? 'Khu vực quản trị nội dung, tài liệu và tài khoản.' : 'Đăng nhập để tra cứu thư viện giải pháp.'}</p>
    {status === 'unavailable' ? <div className="login-message">Chưa kết nối được máy chủ xác thực. Kiểm tra API rồi tải lại trang nhé.</div> : status === 'unconfigured' ? <div className="login-message">Máy chủ chưa khởi tạo tài khoản. Chạy <code>npm run db:setup</code> trên server để tạo quản trị viên đầu tiên.</div> : <form onSubmit={submit}><label>TÊN ĐĂNG NHẬP<input autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required/></label><label>MẬT KHẨU<span className="login-password-wrap"><input autoComplete="current-password" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} required/><button className="login-password-toggle" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></span></label>{captcha && <label className="login-captcha">XÁC THỰC CAPTCHA<span className="login-captcha-row"><b>{captcha.question}</b><input inputMode="numeric" pattern="[0-9]*" autoComplete="off" value={captchaAnswer} onChange={event => setCaptchaAnswer(event.target.value)} placeholder="Kết quả" required/></span><small>Nhập kết quả để tiếp tục đăng nhập.</small></label>}{message && <div className="login-message" role="alert">{message}</div>}<button disabled={busy || status === 'checking'}><LockKeyhole size={15}/>{busy ? 'Đang kiểm tra…' : 'Đăng nhập'}<ArrowRight size={15}/></button></form>}
    <div className="login-foot"><Shield size={14}/> Phiên truy cập tự hết hạn sau 12 giờ <span>·</span> COOKIE HTTPONLY</div></div>
  </div><div className="login-corner login-corner-a" aria-hidden="true">SECURITY OPERATIONS / ACCESS CONTROL</div><div className="login-protected-by" aria-label="Protected by Cloudflare"><span>Protected by</span><svg viewBox="0 0 64 40" aria-hidden="true" focusable="false"><path fill="currentColor" d="M51.4 17.1a14.8 14.8 0 0 0-28.5-3.7 11.3 11.3 0 0 0-2.5-.3A11.4 11.4 0 0 0 9 24.5c0 .5 0 1 .1 1.5H5.3A5.3 5.3 0 0 0 0 31.3a5.3 5.3 0 0 0 5.3 5.3h42.5a10.7 10.7 0 0 0 3.6-19.5ZM47.8 32H14a7.6 7.6 0 0 1-7.5-7.5 7.6 7.6 0 0 1 12.8-5.6l1.9 1.8.8-2.5a11 11 0 0 1 21.3 2.4l.2 1.7 1.7.1a5 5 0 0 1 2.6 9.6Z"/><path fill="currentColor" d="M56.4 23.4a7.6 7.6 0 0 0-1.9.2 9 9 0 0 1-6.7 10.8h9a5.5 5.5 0 0 0-.4-11Z"/></svg><strong>Cloudflare</strong></div></main>;
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

function SolutionDetailPage({ entry, area, profile, sourceOnly, relatedItems, onOpenEntry, onOpenSolution, onOpenDocument, onLogout }) {
  const [documents, setDocuments] = useState([]);
  const [documentState, setDocumentState] = useState(entry ? 'loading' : 'idle');
  const details = area || sourceOnly || {};
  const title = entry?.name || sourceOnly?.title || 'Giải pháp';
  const summary = entry?.desc || profile?.summary || sourceOnly?.summary || details.summary;
  const sourceUrl = entry?.sourceUrl ?? details.sourceUrl;
  const partners = entry?.partners || profile?.partners || details.partners || [];
  const capabilities = profile?.capabilities || details.capabilities || [];
  const reviewQuestions = profile?.questions || [
    ['Bài toán cần xử lý', 'Hệ thống, dữ liệu hoặc quy trình nào đang cần được bảo vệ hay cải thiện?'],
    ['Phạm vi áp dụng', 'Giải pháp cần bao phủ những môi trường, nhóm người dùng và đơn vị vận hành nào?'],
    ['Khả năng tích hợp', 'Cần trao đổi dữ liệu với nền tảng, công cụ hoặc quy trình hiện có nào?'],
    ['Tiêu chí nghiệm thu', 'Kết quả nào sẽ cho thấy thử nghiệm đáp ứng yêu cầu của đội ngũ?'],
  ];
  const productScreenshots = documents.filter(doc => ['png', 'jpg', 'jpeg', 'webp'].includes(fileExtension(doc)) && /screenshot|screen|dashboard|giao diện|interface/i.test(doc.name || '')).slice(0, 3);

  useEffect(() => {
    if (!entry) { setDocuments([]); setDocumentState('idle'); return undefined; }
    const controller = new AbortController();
    setDocumentState('loading');
    fetch(apiUrl(`/api/documents?entryId=${encodeURIComponent(entry.id)}`), { credentials: 'include', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Không tải được danh sách tài liệu.');
        const data = await response.json();
        setDocuments(data.documents || []);
        setDocumentState('ready');
      })
      .catch(() => { if (!controller.signal.aborted) setDocumentState('error'); });
    return () => controller.abort();
  }, [entry?.id]);

  return <div className="solution-detail-shell">
    <header className="solution-detail-topbar">
      <a className="detail-brand" href="#top"><span className="brand-mark"><ShieldCheck size={20}/></span><span><b>GIẢI PHÁP</b><small>AN NINH MẠNG</small></span></a>
      <span className="detail-access"><i/> THƯ VIỆN NỘI BỘ <b>/</b> THÔNG TIN GIẢI PHÁP <button className="detail-logout" onClick={onLogout}>Đăng xuất</button></span>
    </header>
    <main className="solution-detail-container">
      <a className="detail-back-link" href="#catalog"><ArrowLeft size={15}/> Về thư viện giải pháp</a>
      <section className="solution-detail-hero">
        <div className="detail-hero-grid"/>
        <div className="solution-detail-eyebrow"><span><i/>{details.label || details.groupLabel || 'GIẢI PHÁP'}</span><code>ASIC / SOLUTIONS</code></div>
        <div className={`solution-detail-body ${productScreenshots.length ? 'has-screenshots' : ''}`}>
          <div className="solution-detail-copy">
            <div className="solution-detail-heading">
              {entry ? <BrandMark item={entry}/> : <div className={'solution-detail-mark ' + (entry?.tone || 'cyan')}><ShieldCheck size={21}/></div>}
              <div><span className="solution-detail-overline">{area?.label || sourceOnly?.groupLabel || 'GIẢI PHÁP TỪ ASIC'}</span><h1>{title}</h1></div>
            </div>
            <p className="solution-detail-lead">{summary}</p>
            {entry?.tags?.length > 0 && <div className="detail-hero-tags">{entry.tags.map(tag => <span key={tag}>{tag}</span>)}</div>}
            <div className="solution-detail-hero-actions">
              {entry && <button className="detail-primary-action" onClick={() => onOpenEntry(entry)}><FileText size={15}/> Mở tài liệu trong thư viện <ArrowRight size={15}/></button>}
              {sourceUrl && <a className="detail-source-action" href={sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Bài giới thiệu trên ASIC</a>}
            </div>
          </div>
          {productScreenshots.length > 0 && <div className="detail-product-gallery" aria-label={`Ảnh giao diện ${title}`}>
            {productScreenshots.map((doc, index) => <figure className="detail-product-shot" key={doc.id || doc.name}>
              <img src={inlineUrl(doc)} alt={`Giao diện ${title} · ảnh ${index + 1}`} loading="lazy"/>
              <figcaption><i/><span>{doc.name}</span></figcaption>
            </figure>)}
          </div>}
        </div>
      </section>

      <div className="solution-detail-columns">
        <div className="solution-detail-main">
          {entry?.body !== undefined ? <section className="detail-content-panel" id="tong-quan"><Article body={entry.body}/></section> : <><section className="detail-content-panel" id="tong-quan">
            <div className="detail-section-label"><span>01</span> TỔNG QUAN</div>
            <h2>{profile?.headline || details.headline || 'Giải pháp này có vai trò gì?'}</h2>
            {(profile?.intro || [details.summary]).filter(Boolean).map((paragraph, index) => <p className="detail-area-copy" key={index}>{paragraph}</p>)}
            {details.internalOnly && <p className="detail-source-note">Phần mô tả này lấy từ danh mục tài liệu nội bộ. Trang giải pháp ASIC được liên kết hiện chưa có mô tả riêng cho nhóm này.</p>}
            <div className="detail-context-row"><span><b>{entry?.documentCount ?? '—'}</b><small>TÀI LIỆU TRONG THƯ VIỆN</small></span><span><b>{partners.length.toString().padStart(2, '0')}</b><small>HÃNG ĐƯỢC ĐỀ CẬP</small></span><span><b>{capabilities.length.toString().padStart(2, '0')}</b><small>NĂNG LỰC LIÊN QUAN</small></span></div>
          </section>

          <section className="detail-story-panel" id="nang-luc">
            <div className="detail-section-label"><span>02</span> NĂNG LỰC & PHẠM VI</div>
            <h2>{entry ? `Điểm cần tìm hiểu về ${title}` : 'Các thành phần của giải pháp'}</h2>
            <p className="detail-story-intro">{profile?.capabilityIntro || 'Các nội dung dưới đây được biên soạn theo tài liệu giải pháp hiện có. Phạm vi triển khai cụ thể cần đối chiếu với môi trường và nhu cầu thực tế.'}</p>
            <div className="detail-capability-grid">{capabilities.map((capability, index) => <article className="detail-capability" key={capability.title}><span className="capability-index">0{index + 1}</span><h3>{capability.title}</h3><p>{capability.text}</p></article>)}</div>
            {profile?.useCases?.length > 0 && <div className="detail-usecases"><h3>Phù hợp để xem xét khi</h3><ul>{profile.useCases.map(item => <li key={item}>{item}</li>)}</ul></div>}
            {entry?.tags?.length > 0 && <div className="detail-topic-tags"><span>Chủ đề liên quan</span>{entry.tags.map(tag => <b key={tag}>{tag}</b>)}</div>}
          </section>

          <section className="detail-story-panel detail-evaluation-panel" id="danh-gia">
            <div className="detail-section-label"><span>03</span> GỢI Ý ĐÁNH GIÁ</div>
            <h2>Những câu hỏi nên làm rõ trước khi lựa chọn</h2>
            <p className="detail-story-intro">Dùng các câu hỏi này để bắt đầu buổi trao đổi hoặc chuẩn bị một đợt thử nghiệm phù hợp.</p>
            <div className="detail-review-list">
              {reviewQuestions.map(([title, text], index) => <article key={title}><span>0{index + 1}</span><div><b>{title}</b><p>{text}</p></div></article>)}
            </div>
            <p className="detail-editorial-note">Đây là bộ câu hỏi tham khảo để đánh giá nhu cầu; không thay thế tài liệu kỹ thuật hoặc xác nhận tính năng từ hãng.</p>
          </section>

          </>}
          <section className="detail-story-panel detail-documents-panel" id="tai-lieu">
            <div className="detail-section-label"><span>04</span> ĐỌC TIẾP TRONG THƯ VIỆN</div>
            <div className="detail-related-heading"><div><h2>Tài liệu của {title}</h2><p>Mở xem trước ngay trong thư viện hoặc mở file bằng ứng dụng phù hợp.</p></div><span>{entry?.documentCount ?? 0}</span></div>
            {documentState === 'loading' && <p className="detail-doc-state">Đang tải danh sách tài liệu…</p>}
            {documentState === 'error' && <p className="detail-doc-state">Chưa kết nối được máy chủ tài liệu. Bạn vẫn có thể mở danh sách đầy đủ.</p>}
            {documentState === 'ready' && documents.length === 0 && <p className="detail-doc-state">Chưa có tài liệu trong thư mục này.</p>}
            {documents.slice(0, 5).map(doc => <button className="detail-document-row" key={doc.id} onClick={() => onOpenDocument(doc)}><span className="detail-document-type">{doc.extension || 'FILE'}</span><span><b>{doc.name}</b><small>{doc.folder || 'Thư mục gốc'}{doc.size ? ` · ${formatSize(doc.size)}` : ''}</small></span><Eye size={16}/></button>)}
            {entry && <button className="detail-all-documents" onClick={() => onOpenEntry(entry)}>{documents.length > 5 ? `Xem toàn bộ ${entry.documentCount || documents.length} tài liệu` : 'Mở thư mục tài liệu'} <ArrowRight size={15}/></button>}
          </section>

          {relatedItems.length > 0 && <section className="detail-related-section" id="lien-quan">
            <div className="detail-section-label"><span>05</span> CÙNG LĨNH VỰC</div>
            <div className="detail-related-heading"><div><h2>Các giải pháp liên quan</h2><p>Mở trang riêng để xem giới thiệu và tài liệu của từng giải pháp.</p></div><span>{relatedItems.length.toString().padStart(2, '0')}</span></div>
            <div className="detail-related-grid">{relatedItems.map(item => <button className="detail-related-card" key={item.id} onClick={() => onOpenSolution(item)}><span className={'detail-related-mark ' + item.tone}>{item.mark}</span><span className="detail-related-info"><b>{item.name}</b><small>{item.desc}</small></span><ArrowUpRight size={16}/></button>)}</div>
          </section>}
        </div>

        <aside className="solution-detail-aside">
          <nav className="detail-toc" aria-label="Mục lục bài viết"><b>TRONG BÀI VIẾT</b><a href="#tong-quan">Tổng quan</a>{entry?.body === undefined && <><a href="#nang-luc">Năng lực & phạm vi</a><a href="#danh-gia">Gợi ý đánh giá</a></>}<a href="#tai-lieu">Tài liệu trong thư viện</a>{relatedItems.length > 0 && <a href="#lien-quan">Giải pháp liên quan</a>}</nav>
          <section className="detail-aside-panel">
            <div className="detail-section-label"><span>06</span> HÃNG ĐƯỢC ĐỀ CẬP</div>
            <h2>Các hãng trong danh mục</h2>
            <p>{details.internalOnly ? 'Có trong danh mục tài liệu nội bộ.' : 'Được nêu trong phần giải pháp tương ứng trên trang ASIC.'}</p>
            <div className="detail-partner-list">{partners.map((partner, index) => <div className="detail-partner" key={partner}><span>{String(index + 1).padStart(2, '0')}</span><b>{partner}</b><i/></div>)}</div>
          </section>
          <section className="detail-library-panel">
            <span className="library-panel-icon"><FolderOpen size={18}/></span>
            <b>{entry ? 'Tài liệu trong thư viện' : 'Giới thiệu giải pháp'}</b>
            <p>{entry ? 'Mở thư mục để xem trước tài liệu hoặc tải file về.' : 'Giải pháp này được ASIC liệt kê trên trang tổng hợp.'}</p>
            {entry && <button onClick={() => onOpenEntry(entry)}>Mở thư mục tài liệu <ArrowRight size={14}/></button>}
            {sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer">Đọc đầy đủ trên asiccybersecurity.vn <ExternalLink size={13}/></a>}
            {sourceOnly && <small>Thư mục tài liệu cho giải pháp này chưa nằm trong danh mục Solutions đang có.</small>}
          </section>
          <div className="detail-page-note"><ShieldCheck size={15}/><span>Nội dung được biên soạn lại từ nguồn ASIC và danh mục tài liệu nội bộ.</span></div>
        </aside>
      </div>
      <footer className="detail-page-footer"><span>THƯ VIỆN GIẢI PHÁP <i>·</i> DÀNH CHO THÀNH VIÊN</span><a href="#catalog">Quay lại danh mục <ArrowLeft size={13}/></a></footer>
    </main>
  </div>;
}
function App() {
  const searchInputRef = useRef(null);
  const [authStatus, setAuthStatus] = useState('checking');
  const [currentUser, setCurrentUser] = useState(null);
  const [active, setActive] = useState('all');
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState(() => {
    try {
      const value = JSON.parse(window.localStorage.getItem('tonghop.saved-solutions') || '[]');
      return Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];
    } catch { return []; }
  });
  const [showSaved, setShowSaved] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.localStorage.getItem('tonghop.sidebar-collapsed') === 'true');
  const [sort, setSort] = useState('A–Z');
  const [apiOnline, setApiOnline] = useState(false);
  const [remoteEntries, setRemoteEntries] = useState([]);
  const [indexedAt, setIndexedAt] = useState('');
  const [documentMatches, setDocumentMatches] = useState([]);
  const [documentSearchStatus, setDocumentSearchStatus] = useState('idle');
  const [showAllDocumentMatches, setShowAllDocumentMatches] = useState(false);
  const [detailEntry, setDetailEntry] = useState(null);
  const [solutionPageId, setSolutionPageId] = useState(readSolutionRoute);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [detailDocuments, setDetailDocuments] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    const syncSolutionRoute = () => setSolutionPageId(readSolutionRoute());
    window.addEventListener('hashchange', syncSolutionRoute);
    window.addEventListener('popstate', syncSolutionRoute);
    return () => {
      window.removeEventListener('hashchange', syncSolutionRoute);
      window.removeEventListener('popstate', syncSolutionRoute);
    };
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem('tonghop.saved-solutions', JSON.stringify(saved)); } catch {}
  }, [saved]);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl('/api/auth/session'), { credentials: 'include' }).then(response => response.json())
      .then(data => { if (!cancelled) { setCurrentUser(data.user || null); setAuthStatus(!data.configured ? 'unconfigured' : data.authenticated ? 'authenticated' : 'login'); } })
      .catch(() => { if (!cancelled) setAuthStatus('unavailable'); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (authStatus !== 'authenticated') { setApiOnline(false); setRemoteEntries([]); return undefined; }
    let cancelled = false;
    fetch(apiUrl('/api/catalog'), { credentials: 'include' }).then(response => { if (!response.ok) throw new Error('API unavailable'); return response.json(); })
      .then(data => { if (!cancelled) { setRemoteEntries(data.entries || []); setIndexedAt(data.indexedAt || ''); setApiOnline(true); } })
      .catch(() => { if (!cancelled) setApiOnline(false); });
    return () => { cancelled = true; };
  }, [authStatus]);

  useEffect(() => {
    const handleShortcut = event => {
      const typing = event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]');
      if (((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') || (event.key === '/' && !typing)) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      if (event.key === 'Escape') { setPreviewDoc(null); setDetailEntry(null); }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const allSolutions = useMemo(() => remoteEntries.filter(item => item.kind === 'solution' && !item.featured), [remoteEntries]);
  const allCollections = useMemo(() => remoteEntries.filter(item => item.kind === 'collection'), [remoteEntries]);
  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('vi');
    return allSolutions.filter(item => (active === 'all' || item.group === active) && (!showSaved || saved.includes(item.id)) && (!q || `${item.name} ${item.desc} ${item.tags.join(' ')}`.toLocaleLowerCase('vi').includes(q)))
      .sort((a,b) => sort === 'A–Z' ? a.name.localeCompare(b.name, 'vi') : b.name.localeCompare(a.name, 'vi'));
  }, [active, query, sort, allSolutions, showSaved, saved]);
  const selectedGroup = groups.find(group => group.id === active);
  const totalDocuments = remoteEntries.reduce((sum, entry) => sum + entry.documentCount, 0);

  useEffect(() => {
    setShowAllDocumentMatches(false);
    if (authStatus !== 'authenticated') { setDocumentMatches([]); setDocumentSearchStatus('idle'); return; }
    if (query.trim().length < 2) { setDocumentMatches([]); setDocumentSearchStatus('idle'); return; }
    if (!apiOnline) { setDocumentMatches([]); setDocumentSearchStatus('offline'); return; }
    const controller = new AbortController();
    setDocumentMatches([]);
    setDocumentSearchStatus('loading');
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(apiUrl(`/api/search?q=${encodeURIComponent(query.trim())}`), { signal: controller.signal, credentials: 'include' });
        if (!response.ok) throw new Error('Không tìm được tài liệu lúc này.');
        const data = await response.json();
        if (!controller.signal.aborted) { setDocumentMatches(data.results || []); setDocumentSearchStatus('ready'); }
      } catch {
        if (!controller.signal.aborted) setDocumentSearchStatus('error');
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, apiOnline, authStatus]);

  async function logout() {
    try { await fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' }); } catch {}
    setCurrentUser(null); setAuthStatus('login'); setApiOnline(false); setRemoteEntries([]); setPreviewDoc(null); setDetailEntry(null);
  }

  async function openEntry(entry) {
    setDetailEntry(entry); setDetailDocuments([]); setDetailError(''); setDetailLoading(apiOnline);
    if (!apiOnline) { setDetailError('Máy chủ tài liệu chưa kết nối. Hãy chạy API nội bộ để mở danh sách file.'); return; }
    try {
      const response = await fetch(apiUrl(`/api/documents?entryId=${encodeURIComponent(entry.id)}`), { credentials: 'include' });
      if (!response.ok) throw new Error('Không tải được danh sách tài liệu.');
      const data = await response.json(); setDetailDocuments(data.documents || []);
    } catch { setDetailError('Chưa tải được danh sách tài liệu. Kiểm tra kết nối máy chủ rồi thử lại.'); }
    finally { setDetailLoading(false); }
  }

  function openEntryFromSolution(entry) {
    setSolutionPageId('');
    if (window.location.hash !== '#catalog') window.location.hash = '#catalog';
    openEntry(entry);
  }

  function openSolutionPage(entryOrId) {
    const id = typeof entryOrId === 'string' ? entryOrId : entryOrId?.id;
    if (!id) return;
    const nextHash = '#/giai-phap/' + encodeURIComponent(id);
    if (window.location.hash !== nextHash) window.location.hash = nextHash;
    setSolutionPageId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function selectMapGroup(groupId) {
    setActive(groupId);
    setShowSaved(false);
    setQuery('');
    requestAnimationFrame(() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function selectCatalogGroup(groupId) {
    setActive(groupId);
    setShowSaved(false);
    setQuery('');
    setMobileOpen(false);
    requestAnimationFrame(() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function toggleSave(name) { setSaved(previous => previous.includes(name) ? previous.filter(item => item !== name) : [...previous, name]); }
  const fileResult = (doc, compact = false) => <button type="button" className={`document-result ${compact ? 'compact' : ''}`} onClick={() => setPreviewDoc(doc)} key={doc.id}>
    <span className="file-type">{doc.extension || 'FILE'}</span><span className="file-info"><b>{doc.name}</b><small>{doc.entryName ? `${doc.entryName} · ` : ''}{doc.folder || 'Thư mục gốc'}{doc.size ? ` · ${formatSize(doc.size)}` : ''}</small></span><Eye size={16}/>
  </button>;

  const detailSolutionEntry = remoteEntries.find(item => item.id === solutionPageId);
  const detailSourceOnly = null;
  const detailArea = detailSolutionEntry ? { ...(detailSolutionEntry.area || {}), label: groups.find(g => g.id === detailSolutionEntry.group)?.short } : null;
  const relatedDetailItems = detailSolutionEntry ? allSolutions.filter(item => item.group === detailSolutionEntry.group && item.id !== detailSolutionEntry.id).slice(0, 6) : [];

  if (authStatus !== 'authenticated') return <LoginScreen status={authStatus} adminMode={window.location.pathname.replace(/\/$/, '') === '/admin'} onLogin={user => { setCurrentUser(user); setAuthStatus('authenticated'); }}/>;
  if (window.location.pathname.replace(/\/$/, '') === '/admin') return <Admin user={currentUser} onLogout={logout}/>;
  if (solutionPageId && (detailSolutionEntry || detailSourceOnly)) return <SolutionDetailPage entry={detailSolutionEntry} area={detailArea} profile={detailSolutionEntry?.profile} sourceOnly={detailSourceOnly} relatedItems={relatedDetailItems} onOpenEntry={openEntryFromSolution} onOpenDocument={doc => { setSolutionPageId(''); window.location.hash='#catalog'; setPreviewDoc(doc); }} onOpenSolution={openSolutionPage} onLogout={logout}/>;

  function toggleSidebar() { setSidebarCollapsed(value => { const next = !value; window.localStorage.setItem('tonghop.sidebar-collapsed', String(next)); return next; }); }
  return <div className={`app-shell ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
      <a className="brand brand-asic" href="#top" onClick={() => setMobileOpen(false)}><span className="brand-asic-logo"><img src="/logos/logo-ASIC.png" alt="ASIC CyberSecurity"/></span></a>
      <div className="workspace"><span className="workspace-icon workspace-asic-icon"><img src="/logos/logo-ASIC.png" alt="ASIC"/></span><span><b>ASIC Library</b><small>Kho tài liệu nội bộ</small></span></div>
      <div className="side-label">DANH MỤC</div>
      <nav className="nav-list">{groups.map(group => { const Icon = icons[group.icon] || Shield; return <button title={group.short} className={`nav-item ${active === group.id && !showSaved ? 'selected' : ''}`} key={group.id} onClick={() => selectCatalogGroup(group.id)}><Icon size={16}/><span>{group.short}</span>{group.id === 'all' && <small>{allSolutions.length}</small>}</button>; })}<button title="Đã lưu" className={`nav-item ${showSaved ? 'selected' : ''}`} onClick={() => { setActive('all'); setShowSaved(true); setMobileOpen(false); requestAnimationFrame(() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }}><Bookmark size={16}/><span>Đã lưu</span><small>{saved.length}</small></button></nav>
      <div className="sidebar-spacer"/>{['admin','editor'].includes(currentUser?.role) && <a className="nav-item" href="/admin"><ShieldCheck size={16}/> Quản trị thư viện</a>}
      <div className="side-note"><div className="note-icon"><FolderOpen size={16}/></div><b>{apiOnline ? `${totalDocuments} tài liệu đã lập chỉ mục` : 'Thư mục tài liệu'}</b><p>{apiOnline ? `Lần quét gần nhất ${new Date(indexedAt).toLocaleTimeString('vi-VN', {hour:'2-digit',minute:'2-digit'})}.` : 'Kết nối máy chủ để tìm và mở file trong Solutions.'}</p><span className={`api-state ${apiOnline ? 'online' : ''}`}><i/>{apiOnline ? 'API ĐANG KẾT NỐI' : 'API CHƯA KẾT NỐI'}</span></div>
      {(() => { const access = accessLevels[currentUser?.role] || accessLevels.member; return <div className={`profile profile-${access.tone}`}><div className="avatar">{(currentUser?.displayName || 'P').slice(0,1).toUpperCase()}</div><span><b>{currentUser?.displayName || 'Thành viên'}</b><small>{access.caption}</small></span><span className="profile-level">{access.label}</span><span className="online-dot"/></div>; })()}
    </aside>
    {mobileOpen && <button className="scrim" aria-label="Đóng menu" onClick={() => setMobileOpen(false)}/>}
    <main id="top" className="main-area">
      <header className="topbar"><button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Mở menu"><Menu size={19}/></button><button className="sidebar-toggle" onClick={toggleSidebar} aria-label={sidebarCollapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'} title={sidebarCollapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}>{sidebarCollapsed ? <PanelLeftOpen size={17}/> : <PanelLeftClose size={17}/>}</button><div className="crumb">THƯ VIỆN <span>/</span> <b>{active === 'all' ? 'TỔNG QUAN' : selectedGroup?.short.toUpperCase()}</b></div><div className="top-actions"><span className="secure-status"><i/> DÀNH CHO THÀNH VIÊN</span><button className="logout-button" onClick={logout}>Đăng xuất</button></div></header>
      <div className="content-wrap">
        <section className="hero"><div className="hero-grid"/><div className="hero-content"><div className="eyebrow"><i className="pulse"/> THƯ VIỆN NỘI BỘ <span className="eyebrow-line"/> AN NINH MẠNG</div><h1>Giải pháp an ninh mạng,<br/><em>tra cứu trong một nơi.</em></h1><p>Tìm hiểu từng giải pháp, xem tài liệu liên quan và mở bản xem trước ngay trong thư viện.</p><div className="hero-actions"><button onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}>Khám phá giải pháp <ArrowDownRight size={16}/></button><span>{allSolutions.length} giải pháp <i/> {allCollections.length} bộ tài liệu dùng chung</span></div><div className="hero-meta"><span><ShieldCheck size={14}/> Dành cho thành viên</span><i className="meta-divider"/><span><i className="live-dot"/> {apiOnline ? 'Đã kết nối thư mục tài liệu' : 'Thư mục tài liệu chưa kết nối'}</span></div></div><div className="hero-visual"><NetworkMap active={active} onSelect={selectMapGroup}/></div></section>
        <section className="search-section"><div className="search-box"><Search size={19}/><input ref={searchInputRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm giải pháp, hãng hoặc tên tài liệu…" aria-label="Tìm trong thư viện"/><kbd><Command size={12}/> K</kbd><button className="search-submit" aria-label="Đến danh mục kết quả" onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}><ArrowUpRight size={18}/></button></div><div className="quick-hints"><span>TÌM NHANH:</span>{['SIEM','Zero Trust','OSINT','Blancco'].map(term => <button key={term} onClick={() => setQuery(term)}>{term}</button>)}</div>
          {documentSearchStatus !== 'idle' && <div className="document-search"><div className="document-search-title"><span>{documentSearchStatus === 'loading' ? 'ĐANG TÌM TÀI LIỆU' : documentSearchStatus === 'error' ? 'CHƯA THỂ TÌM KIẾM' : documentSearchStatus === 'offline' ? 'MÁY CHỦ CHƯA KẾT NỐI' : 'TÀI LIỆU TRÙNG KHỚP'}</span><small>{documentSearchStatus === 'ready' ? documentMatches.length + ' kết quả' : ''}</small></div>{documentSearchStatus === 'error' && <div className="document-search-message">Máy chủ chưa trả lời. Thử lại sau ít phút nhé.</div>}{documentSearchStatus === 'offline' && <div className="document-search-message">Máy chủ tài liệu chưa kết nối. Từ khóa giải pháp vẫn có thể tìm trong danh mục.</div>}{documentSearchStatus === 'ready' && documentMatches.length === 0 && <div className="document-search-message">Chưa tìm thấy tài liệu khớp với từ khóa này.</div>}{documentMatches.slice(0, showAllDocumentMatches ? documentMatches.length : 6).map(doc => fileResult(doc, true))}{documentSearchStatus === 'ready' && documentMatches.length > 6 && <button type="button" className="document-search-more" onClick={() => setShowAllDocumentMatches(value => !value)}>{showAllDocumentMatches ? 'Thu gọn danh sách' : 'Xem thêm ' + (documentMatches.length - 6) + ' tài liệu'}</button>}</div>}
        </section>
        <section className="metrics"><div className="metric"><span className="metric-icon"><Grid2X2 size={15}/></span><span><b>{allSolutions.length.toString().padStart(2,'0')}</b><small>GIẢI PHÁP</small></span></div><i className="metric-separator"/><div className="metric"><span className="metric-icon"><Shield size={15}/></span><span><b>{groups.length-1}</b><small>NHÓM CHUYÊN MÔN</small></span></div><i className="metric-separator"/><div className="metric"><span className="metric-icon"><FileText size={15}/></span><span><b>{apiOnline ? totalDocuments : '—'}</b><small>TÀI LIỆU TRONG THƯ MỤC</small></span></div><div className="metrics-note"><Activity size={14}/>{apiOnline ? 'Danh mục đồng bộ từ Solutions' : 'Cần kết nối API để tra cứu file thật'}</div></section>
        <section id="catalog" className="catalog"><div className="section-heading"><div><div className="section-kicker">DANH MỤC GIẢI PHÁP <i/></div><h2>{active === 'all' ? (showSaved ? 'Giải pháp đã lưu' : 'Khám phá theo lĩnh vực') : selectedGroup?.name}<span className="result-count">{visible.length.toString().padStart(2,'0')}</span></h2><p>{showSaved ? 'Những giải pháp bạn đã đánh dấu để xem lại.' : 'Chọn lĩnh vực để xem các giải pháp đang có trong thư viện.'}</p></div><label className="sort-control"><span>SẮP XẾP</span><select value={sort} onChange={event => setSort(event.target.value)}><option>A–Z</option><option>Z–A</option></select><ChevronDown size={13}/></label></div>
          <div className="category-strip">{groups.slice(1).map(group => { const Icon = icons[group.icon] || Shield; const count = allSolutions.filter(item => item.group === group.id).length; return <button key={group.id} className={`category-chip ${active === group.id ? 'active' : ''}`} onClick={() => selectCatalogGroup(active === group.id ? 'all' : group.id)}><Icon size={13}/>{group.short}<span>{count}</span></button>; })}</div>
          {remoteEntries.filter(item => item.featured).map(item => <a key={item.id} className="source-area-link" href={'#/giai-phap/' + item.id}><span className="source-area-icon"><Radar size={16}/></span><span><b>{item.name}</b><small>{item.desc}</small></span><ArrowUpRight size={16}/></a>)}
          {visible.length ? <div className="solution-grid">{visible.map((item,index) => <article className="solution-card" tabIndex={0} aria-label={`Xem chi tiết ${item.name}`} onClick={event => { if (event.target.closest('button, a')) return; openSolutionPage(item); }} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openSolutionPage(item); } }} key={item.id} style={{'--delay':`${Math.min(index*18,200)}ms`}}>
            <div className="card-meta"><span>{groups.find(group => group.id === item.group)?.short}</span><code>MÃ / {String(index+1).padStart(2,'0')}</code></div>
            <div className="card-top"><BrandMark item={item}/><button className={`save-button ${saved.includes(item.id)?'saved':''}`} onClick={() => toggleSave(item.id)} aria-label={saved.includes(item.id) ? 'Bỏ lưu giải pháp' : 'Lưu giải pháp'} aria-pressed={saved.includes(item.id)}><Bookmark size={15} fill={saved.includes(item.id) ? 'currentColor' : 'none'}/></button></div>
            <h3>{item.name}</h3><p>{item.desc}</p><div className="tag-row">{item.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
            <div className="card-footer"><span><FileText size={12}/>{apiOnline ? (item.documentCount || 0) + ' tài liệu' : 'Tài liệu trong Solutions'}</span><div className="card-actions"><button className="card-documents" aria-label={`Xem tài liệu ${item.name}`} onClick={() => openEntry(item)}><FileText size={13}/>Xem tài liệu</button></div></div>
          </article>)}</div> : <div className="empty-state"><Search size={26}/><h3>{showSaved ? 'Chưa lưu giải pháp nào' : 'Chưa tìm thấy giải pháp phù hợp'}</h3><p>{showSaved ? 'Bấm biểu tượng dấu trang trên một thẻ giải pháp để lưu lại.' : 'Thử từ khóa khác hoặc bỏ bộ lọc nhóm.'}</p><button onClick={() => {setQuery('');setActive('all');setShowSaved(false);}}>Xem toàn bộ danh mục <ArrowRight size={14}/></button></div>}
          <div className="catalog-foot"><span>HIỂN THỊ <b>{visible.length}</b> / {allSolutions.length} GIẢI PHÁP</span><span><i/> {apiOnline ? 'ĐỒNG BỘ TỪ SOLUTIONS' : 'DANH MỤC CÓ SẴN'}</span></div>
        </section>
        <section className="collections-section"><div className="section-heading compact-heading"><div><div className="section-kicker">TÀI LIỆU DÙNG CHUNG <i/></div><h2>Tài liệu tham khảo</h2><p>Tài liệu tổng quan, bộ trình bày và nội dung dùng chung trong đội ngũ.</p></div></div><div className="collection-grid">{allCollections.map(item => <button className="collection-card" key={item.id} onClick={() => openEntry(item)}><span className="collection-icon"><FolderOpen size={17}/></span><span className="collection-info"><b>{item.name}</b><small>{item.desc}</small></span><span className="collection-count">{apiOnline ? item.documentCount || 0 : '—'}<small>TÀI LIỆU</small></span><ArrowRight size={15}/></button>)}</div></section>
        <footer><span>THƯ VIỆN GIẢI PHÁP <i>·</i> DÀNH CHO THÀNH VIÊN</span><span>Tìm nhanh, làm việc gọn.</span></footer>
      </div>
    </main>

    {previewDoc && (() => {
      const kind = previewType(previewDoc);
      
      const previewSource = inlineUrl(previewDoc);
      return <div className="modal-backdrop preview-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setPreviewDoc(null); }}>
        <section className="preview-modal" role="dialog" aria-modal="true" aria-labelledby="preview-title">
          <header className="preview-header">
            <div className="preview-title-wrap"><span className="detail-kicker">{previewDoc.extension?.replace('.', '').toUpperCase() || 'TÀI LIỆU'} · {previewDoc.entryName || detailEntry?.name || 'THƯ VIỆN'}</span><h2 id="preview-title">{previewDoc.name}</h2><p>{previewDoc.folder || 'Thư mục gốc'} · {formatSize(previewDoc.size || 0)}</p></div>
            <div className="preview-actions"><a className="preview-download" href={fileUrl(previewDoc.url)} download><Download size={16}/> Tải xuống</a><button className="preview-close" onClick={() => setPreviewDoc(null)} aria-label="Đóng xem trước"><X size={18}/></button></div>
          </header>
          <div className={`preview-body preview-${kind}`}>
            {kind === 'pdf' && <iframe src={previewSource} title={`Xem trước ${previewDoc.name}`} />}
            {kind === 'image' && <img src={previewSource} alt={previewDoc.name} />}
            {kind === 'video' && <video controls playsInline preload="metadata"><source src={previewSource} type={videoTypes[fileExtension(previewDoc)]}/></video>}
            {kind === 'text' && <iframe src={previewSource} title={`Nội dung ${previewDoc.name}`} />}
            {kind === 'docx' && <DocxPreview key={previewDoc.id} source={previewSource} title={previewDoc.name}/>}
              {kind === 'office' && <OfficePreview key={previewDoc.id} document={previewDoc}/>}
              {kind === 'other' && <div className="preview-unavailable"><span className="preview-file-icon"><FileText size={28}/></span><h3>File này chưa xem trực tiếp được</h3><p>Tải file về để mở bằng ứng dụng phù hợp trên thiết bị của bạn.</p></div>}
          </div>
        </section>
      </div>;
    })()}
    {detailEntry && <div className="modal-backdrop" onMouseDown={event => {if(event.target === event.currentTarget) setDetailEntry(null);}}><section className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title"><header className="detail-header"><div><span className="detail-kicker">{detailEntry.kind === 'collection' ? 'THƯ VIỆN DÙNG CHUNG' : groups.find(group => group.id === detailEntry.group)?.short.toUpperCase()}</span><h2 id="detail-title">{detailEntry.name}</h2><p>{detailEntry.desc}</p></div><button onClick={() => setDetailEntry(null)} aria-label="Đóng"><X size={18}/></button></header><div className="detail-toolbar"><span><FileText size={14}/> {detailLoading ? 'Đang đọc danh mục…' : `${detailDocuments.length} tài liệu`}</span><span>{apiOnline ? 'ĐỌC TỪ SOLUTIONS' : 'API CHƯA KẾT NỐI'}</span></div><div className="detail-list">{detailLoading && <div className="detail-empty">Đang tải danh sách tài liệu…</div>}{detailError && <div className="detail-empty">{detailError}</div>}{!detailLoading && !detailError && detailDocuments.length === 0 && <div className="detail-empty">Thư mục này chưa có tài liệu được lập chỉ mục.</div>}{detailDocuments.map(doc => fileResult(doc))}</div><div className="detail-footer"><span>{detailDocuments.length} FILES · {apiOnline ? `INDEX ${new Date(indexedAt).toLocaleDateString('vi-VN')}` : 'LOCAL'}</span><button onClick={() => setDetailEntry(null)}>Đóng thư mục</button></div></section></div>}
  </div>;
}

export default App;







