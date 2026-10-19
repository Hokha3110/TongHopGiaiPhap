import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, Check, Clock3, ExternalLink, Eye, FileText, FolderOpen, Layers3, LogOut, RefreshCw, Share2, ShieldCheck } from 'lucide-react';
import BrandMark from './ui/BrandMark.jsx';
import { mediaUrl, fileExtension, formatSize, inlineUrl } from './lib/libraryApi.js';
import { entryBrandLogo } from './data/brandAssets.js';
import './solution-page.css';

const Article = lazy(() => import('./Article.jsx'));
const reviewDefaults = [
  ['Bài toán cần xử lý', 'Hệ thống, dữ liệu hoặc quy trình nào đang cần được bảo vệ hay cải thiện?'],
  ['Phạm vi áp dụng', 'Giải pháp cần bao phủ những môi trường, nhóm người dùng và đơn vị vận hành nào?'],
  ['Khả năng tích hợp', 'Cần trao đổi dữ liệu với nền tảng, công cụ hoặc quy trình hiện có nào?'],
  ['Tiêu chí nghiệm thu', 'Kết quả nào sẽ cho thấy thử nghiệm đáp ứng yêu cầu của đội ngũ?'],
];

export default function SolutionDetailPage({
  entry, area, profile, sourceOnly, relatedItems = [], onOpenEntry, onOpenSolution,
  onOpenDocument, onLogout, saved = false, onToggleSave, onShare, onBack, loadDocuments,
}) {
  const [documentResult, setDocumentResult] = useState({ entryId: '', status: 'loading', items: [] });
  const [retry, setRetry] = useState(0);
  const [activeSection, setActiveSection] = useState('tong-quan');
  const [watermarkFailed, setWatermarkFailed] = useState('');
  const details = area || sourceOnly || {};
  const title = entry?.name || sourceOnly?.title || 'Giải pháp';
  const summary = entry?.desc || profile?.summary || sourceOnly?.summary || details.summary || '';
  const sourceUrl = entry?.sourceUrl ?? details.sourceUrl;
  const partners = entry?.partners || profile?.partners || details.partners || [];
  const capabilities = profile?.capabilities || details.capabilities || [];
  const reviewQuestions = profile?.questions?.length ? profile.questions : reviewDefaults;
  const isManagedArticle = entry?.body !== undefined;
  const body = entry?.body || '';
  const logo = mediaUrl(entryBrandLogo(entry || {}));
  const documents = documentResult.entryId === entry?.id ? documentResult.items : [];
  const documentState = !entry ? 'idle' : documentResult.entryId === entry.id ? documentResult.status : 'loading';
  const productScreenshots = useMemo(() => documents.filter(doc => ['png', 'jpg', 'jpeg', 'webp'].includes(fileExtension(doc)) && /screenshot|screen|dashboard|giao diện|interface/i.test(doc.name || '')).slice(0, 3), [documents]);
  const readingWords = [summary, body, ...(profile?.intro || []), ...capabilities.map(item => item.text || '')].join(' ').trim().split(/\s+/).filter(Boolean).length;
  const readingMinutes = Math.max(1, Math.ceil(readingWords / 220));
  const sections = useMemo(() => [
    { id: 'tong-quan', label: 'Tổng quan' },
    ...(!isManagedArticle ? [{ id: 'nang-luc', label: 'Năng lực & phạm vi' }, { id: 'danh-gia', label: 'Gợi ý đánh giá' }] : []),
    { id: 'tai-lieu', label: 'Tài liệu trong thư viện' },
    ...(relatedItems.length ? [{ id: 'lien-quan', label: 'Giải pháp liên quan' }] : []),
  ], [isManagedArticle, relatedItems.length]);

  useEffect(() => {
    let active = true;
    setDocumentResult({ entryId: entry?.id || '', status: entry ? 'loading' : 'idle', items: [] });
    if (!entry) return () => { active = false; };
    Promise.resolve().then(() => loadDocuments(entry.id)).then(items => {
      if (active) setDocumentResult({ entryId: entry.id, status: 'ready', items: Array.isArray(items) ? items : [] });
    }).catch(() => {
      if (active) setDocumentResult({ entryId: entry.id, status: 'error', items: [] });
    });
    return () => { active = false; };
  }, [entry?.id, loadDocuments, retry]);

  useEffect(() => {
    setActiveSection('tong-quan');
    if (!('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver(items => {
      const visible = items.filter(item => item.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActiveSection(visible[0].target.id);
    }, { rootMargin: '-12% 0px -65% 0px', threshold: 0 });
    sections.forEach(section => { const node = document.getElementById(section.id); if (node) observer.observe(node); });
    return () => observer.disconnect();
  }, [entry?.id, sourceOnly?.id, sections]);

  function goToSection(event, id) {
    event.preventDefault();
    const node = document.getElementById(id);
    if (!node) return;
    setActiveSection(id);
    node.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    node.focus({ preventScroll: true });
  }

  function goBack(event) {
    if (onBack) { event.preventDefault(); onBack(); }
  }

  return <div className="solution-detail-shell">
    <header className="solution-detail-topbar">
      <a className="detail-brand" href="#catalog" onClick={goBack} aria-label="ASIC CyberSecurity · Về thư viện"><img src="/logos/logo-ASIC.png" width="116" height="43" alt="ASIC CyberSecurity"/><span>LIBRARY<small>THƯ VIỆN GIẢI PHÁP</small></span></a>
      <div className="detail-header-actions"><span className="detail-member-status"><ShieldCheck size={14}/> Khu vực thành viên</span>{onLogout && <button className="detail-icon-button" type="button" onClick={onLogout} aria-label="Đăng xuất" title="Đăng xuất"><LogOut size={17}/></button>}</div>
    </header>
    <main className="solution-detail-container">
      <div className="detail-path-row"><a className="detail-back-link" href="#catalog" onClick={goBack}><ArrowLeft size={15}/> Thư viện giải pháp</a><span>/</span><span>{title}</span></div>
      <section className="solution-detail-hero" aria-labelledby="solution-title">
        <div className="detail-hero-grid" aria-hidden="true"/>
        {logo && watermarkFailed !== logo && <img className="detail-hero-watermark" src={logo} alt="" width="460" height="230" decoding="async" onError={() => setWatermarkFailed(logo)}/>}
        <div className="solution-detail-eyebrow"><span><i/>{details.label || details.groupLabel || 'GIẢI PHÁP AN NINH MẠNG'}</span><code>ASIC KNOWLEDGE / SOLUTION</code></div>
        <div className="solution-detail-heading"><div className="detail-vendor-logo">{entry ? <BrandMark item={entry}/> : <ShieldCheck size={32}/>}</div><div><span className="solution-detail-overline">{area?.label || sourceOnly?.groupLabel || 'KHÁM PHÁ GIẢI PHÁP'}</span><h1 id="solution-title">{title}</h1></div></div>
        {summary && <p className="solution-detail-lead">{summary}</p>}
        {!!entry?.tags?.length && <div className="detail-hero-tags">{entry.tags.map(tag => <span key={tag}>{tag}</span>)}</div>}
        <div className="detail-hero-bottom"><div className="detail-reading-meta"><span><Clock3 size={15}/>{readingMinutes} phút đọc</span><span><FolderOpen size={15}/>{documentState === 'ready' ? documents.length : entry?.documentCount ?? '—'} tài liệu</span></div><div className="detail-tools">{entry && onToggleSave && <button type="button" className={saved ? 'is-saved' : ''} aria-pressed={saved} onClick={() => onToggleSave(entry.id)}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'}/>{saved ? 'Đã lưu' : 'Lưu giải pháp'}</button>}{onShare && <button type="button" onClick={() => onShare(entry || sourceOnly)}><Share2 size={16}/>Chia sẻ</button>}</div></div>
      </section>

      <div className="solution-detail-columns">
        <div className="solution-detail-main">
          <section className="detail-content-panel" id="tong-quan" tabIndex="-1">
            <div className="detail-section-label"><span>01</span> TỔNG QUAN GIẢI PHÁP</div>
            {isManagedArticle ? body.trim() ? <Suspense fallback={<div className="detail-article-loading" role="status">Đang mở bài viết…</div>}><Article body={body}/></Suspense> : <div className="detail-article-empty"><h2>Tìm hiểu về {title}</h2><p>{summary || 'Bài viết giới thiệu đang được cập nhật. Bạn có thể tìm hiểu thêm qua tài liệu trong thư viện.'}</p>{entry && <button className="detail-text-action" type="button" onClick={() => onOpenEntry(entry)}>Khám phá tài liệu <ArrowRight size={15}/></button>}</div> : <>
              <h2>{profile?.headline || details.headline || 'Giải pháp này có vai trò gì?'}</h2>
              {(profile?.intro || [details.summary || summary]).filter(Boolean).map((paragraph, index) => <p className="detail-area-copy" key={index}>{paragraph}</p>)}
              {details.internalOnly && <p className="detail-source-note">Mô tả được tổng hợp từ danh mục tài liệu nội bộ.</p>}
            </>}
          </section>

          {!isManagedArticle && <><section className="detail-story-panel" id="nang-luc" tabIndex="-1">
            <div className="detail-section-label"><span>02</span> NĂNG LỰC & PHẠM VI</div><h2>{entry ? `Điểm cần tìm hiểu về ${title}` : 'Các thành phần của giải pháp'}</h2>
            <p className="detail-story-intro">{profile?.capabilityIntro || 'Đối chiếu các năng lực dưới đây với nhu cầu triển khai và môi trường thực tế của bạn.'}</p>
            {!!capabilities.length && <div className="detail-capability-grid">{capabilities.map((capability, index) => <article className="detail-capability" key={capability.title}><span className="capability-index">{String(index + 1).padStart(2, '0')}</span><h3>{capability.title}</h3><p>{capability.text}</p></article>)}</div>}
            {!!profile?.useCases?.length && <div className="detail-usecases"><h3>Phù hợp để xem xét khi</h3><ul>{profile.useCases.map(item => <li key={item}><Check size={15}/><span>{item}</span></li>)}</ul></div>}
          </section><section className="detail-story-panel detail-evaluation-panel" id="danh-gia" tabIndex="-1"><div className="detail-section-label"><span>03</span> GỢI Ý ĐÁNH GIÁ</div><h2>Bắt đầu từ đúng câu hỏi</h2><p className="detail-story-intro">Chuẩn bị cho buổi trao đổi hoặc đợt thử nghiệm tiếp theo.</p><div className="detail-review-list">{reviewQuestions.map(([question, text], index) => <article key={question}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{question}</h3><p>{text}</p></div></article>)}</div></section></>}

          {!!productScreenshots.length && <section className="detail-story-panel detail-gallery-panel" aria-label={`Hình ảnh giao diện ${title}`}><div className="detail-section-label"><Layers3 size={14}/> GÓC NHÌN SẢN PHẨM</div><div className="detail-product-gallery">{productScreenshots.map(doc => <button className="detail-product-shot" key={doc.id || doc.name} onClick={() => onOpenDocument(doc)} type="button"><img src={inlineUrl(doc)} alt={`Giao diện ${title}: ${doc.name}`} width="960" height="600" loading="lazy" decoding="async"/><span>{doc.name}<ArrowUpRight size={15}/></span></button>)}</div></section>}

          <section className="detail-story-panel detail-documents-panel" id="tai-lieu" tabIndex="-1">
            <div className="detail-section-label"><span>{isManagedArticle ? '02' : '04'}</span> TÀI NGUYÊN LIÊN QUAN</div><div className="detail-related-heading"><div><h2>Tài liệu trong thư viện</h2><p>Xem trước tài liệu, bản giới thiệu và hướng dẫn của {title}.</p></div>{documentState === 'ready' && <span>{documents.length}</span>}</div>
            {documentState === 'loading' && <div className="detail-doc-state" role="status"><FileText size={20}/><span>Đang tải tài liệu…</span></div>}
            {documentState === 'error' && <div className="detail-doc-state" role="status"><FileText size={23}/><span>Chưa tải được danh sách tài liệu.</span><button type="button" onClick={() => setRetry(value => value + 1)}><RefreshCw size={14}/>Thử lại</button></div>}
            {(documentState === 'ready' && !documents.length || documentState === 'idle') && <div className="detail-doc-state"><FolderOpen size={24}/><span>Thư mục này chưa có tài liệu.</span></div>}
            {documents.slice(0, 5).map(doc => <button className="detail-document-row" key={doc.id} type="button" onClick={() => onOpenDocument(doc)}><span className={`detail-document-type type-${fileExtension(doc)}`}>{fileExtension(doc).toUpperCase() || 'FILE'}</span><span><b>{doc.name}</b><small>{doc.folder || 'Thư mục gốc'}{doc.size ? ` · ${formatSize(doc.size)}` : ''}</small></span><Eye size={17}/></button>)}
            {entry && <button type="button" className="detail-all-documents" onClick={() => onOpenEntry(entry)}>{documents.length > 5 ? `Xem toàn bộ ${documents.length} tài liệu` : 'Mở thư mục tài liệu'}<ArrowRight size={15}/></button>}
          </section>

          {!!relatedItems.length && <section className="detail-related-section" id="lien-quan" tabIndex="-1"><div className="detail-section-label"><span>{isManagedArticle ? '03' : '05'}</span> TIẾP TỤC KHÁM PHÁ</div><div className="detail-related-heading"><div><h2>Cùng lĩnh vực, thêm góc nhìn</h2><p>Tìm hiểu các giải pháp liên quan trong thư viện.</p></div></div><div className="detail-related-grid">{relatedItems.map(item => <button className="detail-related-card" key={item.id} type="button" onClick={() => onOpenSolution(item)}><BrandMark item={item}/><span className="detail-related-info"><b>{item.name}</b><small>{item.desc}</small></span><ArrowUpRight size={17}/></button>)}</div></section>}
        </div>

        <aside className="solution-detail-aside">
          <nav className="detail-toc" aria-label="Mục lục bài viết"><span className="detail-rail-label">TRONG TRANG NÀY</span>{sections.map((section, index) => <a href={`#${section.id}`} onClick={event => goToSection(event, section.id)} className={activeSection === section.id ? 'active' : ''} aria-current={activeSection === section.id ? 'location' : undefined} key={section.id}><span>{String(index + 1).padStart(2, '0')}</span>{section.label}</a>)}</nav>
          {!!partners.length && <section className="detail-aside-panel"><span className="detail-rail-label">HÃNG ĐƯỢC ĐỀ CẬP</span><div className="detail-partner-list">{partners.map(partner => <div className="detail-partner" key={partner}><ShieldCheck size={15}/><b>{partner}</b></div>)}</div></section>}
          <section className="detail-library-panel"><span className="library-panel-icon"><FolderOpen size={22}/></span><h2>Từ giới thiệu đến triển khai.</h2><p>{entry ? 'Tìm tài liệu chuyên sâu và mở bản xem trước ngay trong thư viện.' : 'Xem thêm nội dung giới thiệu từ ASIC CyberSecurity.'}</p>{entry && <button type="button" onClick={() => onOpenEntry(entry)}>Khám phá tài liệu<ArrowRight size={15}/></button>}{sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer">Nguồn giới thiệu từ ASIC<ExternalLink size={14}/></a>}</section>
          <div className="detail-page-note"><ShieldCheck size={16}/><span>Thư viện nội bộ ASIC CyberSecurity.</span></div>
        </aside>
      </div>
      <footer className="detail-page-footer"><span>ASIC CYBERSECURITY <i>·</i> KNOWLEDGE LIBRARY</span><a href="#catalog" onClick={goBack}><ArrowLeft size={14}/>Về danh mục giải pháp</a></footer>
    </main>
  </div>;
}
