import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Shield, ShieldCheck } from 'lucide-react';
import { apiUrl } from './lib/libraryApi.js';

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

export default function LoginScreen({ status, onLogin, adminMode = false }) {
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
