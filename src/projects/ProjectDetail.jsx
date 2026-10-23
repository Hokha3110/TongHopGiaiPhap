import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Archive, ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, ClipboardCheck, Copy, FileText, Flag, FlaskConical, History, Layers3, ListChecks, MessageSquarePlus, Pencil, Plus, RotateCcw, Save, Search, ShieldCheck, Target, Trash2, UserPlus, Users, X } from 'lucide-react';
import ProjectForm from './ProjectForm.jsx';
import { STAGES, STATUSES, POC_STATUSES, TASK_STATUSES, CASE_STATUSES, formatDate, today, makeId } from './model.js';

const optionLabel=(options,value)=>options.find(item=>item.value===value)?.label || value;
const filled=value=>String(value??'').trim() || 'Chưa cập nhật';
const tabs=[['overview','Tổng quan',Layers3],['tasks','Công việc',ListChecks],['poc','PoC & test case',FlaskConical],['updates','Cập nhật',History]];
const projectFields=project=>({
  name:project.name || '',customer:project.customer || '',startDate:project.startDate || '',endDate:project.endDate || '',stage:project.stage || 'presale',status:project.status || 'planned',progress:Number(project.progress)||0,
  reason:project.reason || '',objective:project.objective || '',input:project.input || '',output:project.output || '',description:project.description || '',nextStep:project.nextStep || '',
  poc:project.poc || {},tasks:project.tasks || [],testCases:project.testCases || [],updates:project.updates || [],members:project.members || [],archived:!!project.archived,
});
const schemas={
  task:[['title','Tên công việc','text',true],['stage','Giai đoạn','select',STAGES],['status','Trạng thái','select',TASK_STATUSES],['owner','Người phụ trách','text'],['dueDate','Hạn hoàn thành','date'],['why','Mục đích / Vì sao cần làm?','textarea'],['input','Đầu vào cần chuẩn bị','textarea'],['output','Đầu ra / Kết quả cần bàn giao','textarea'],['result','Kết quả thực tế','textarea']],
  testCase:[['title','Tên test case','text',true],['status','Kết quả','select',CASE_STATUSES],['steps','Các bước thực hiện','textarea'],['expected','Kết quả mong đợi / Tiêu chí đạt','textarea'],['actual','Kết quả thực tế','textarea'],['evidence','Minh chứng · liên kết hoặc ghi chú','textarea']],
  update:[['date','Ngày cập nhật','date',true],['progress','Tiến độ dự án (%)','number',true],['text','Nội dung cập nhật / Việc đã hoàn thành','textarea',true],['blocker','Vướng mắc / Cần hỗ trợ','textarea'],['nextStep','Bước tiếp theo','textarea']],
  poc:[['status','Trạng thái PoC','select',POC_STATUSES],['startDate','Ngày bắt đầu','date'],['endDate','Ngày kết thúc dự kiến','date'],['objective','Mục tiêu / Tiêu chí đánh giá','textarea'],['scope','Phạm vi thử nghiệm','textarea'],['environment','Môi trường / Phiên bản / Cấu hình','textarea'],['input','Đầu vào cần chuẩn bị','textarea'],['output','Đầu ra cần bàn giao','textarea'],['conclusion','Kết luận / Đề xuất sau PoC','textarea']],
};
const textLimit=(type,key)=>type==='task'?(key==='result'?8000:4000):type==='testCase'?(key==='steps'?10000:key==='evidence'?4000:8000):type==='update'?(key==='text'?8000:4000):12000;
function FieldSummary({label,children,wide=false}) {
  return <div className={'wp-detail-note'+(wide?' wp-detail-note-wide':'')}><dt>{label}</dt><dd>{children || <span className="wp-muted">Chưa cập nhật</span>}</dd></div>;
}
function RecordForm({type,value,title,busy,onSubmit,onCancel,error}) {
  const [draft,setDraft]=useState(value); const [validation,setValidation]=useState(''); const id=useId();
  const change=(key,next)=>setDraft(previous=>({...previous,[key]:next}));
  return <form className="wp-inline-form" aria-labelledby={`${id}-title`} onSubmit={event=>{event.preventDefault();if(busy)return;if(draft.startDate&&draft.endDate&&draft.endDate<draft.startDate){setValidation('Ngày kết thúc cần bằng hoặc sau ngày bắt đầu.');return;}setValidation('');onSubmit({...draft,...(type==='update'?{progress:Number(draft.progress)}:{})});}}>
    <div className="wp-section-heading"><div><span className="wp-eyebrow">CHỈNH SỬA</span><h3 id={`${id}-title`}>{title}</h3></div><button className="wp-icon-button" type="button" disabled={busy} onClick={onCancel} aria-label="Đóng biểu mẫu"><X size={17}/></button></div>
    {(validation||error)&&<div className="wp-error" role="alert">{validation||error}</div>}
    <fieldset className="wp-form-fieldset" disabled={busy}><div className="wp-fields">{schemas[type].map(([key,label,control,extra])=><label className={'wp-field'+(control==='textarea'||key==='title'?' wp-field-wide':'')} key={key}><span>{label}{extra===true&&<b aria-hidden="true"> *</b>}</span>{control==='select'?<select value={draft[key]||''} onChange={event=>change(key,event.target.value)}>{extra.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>:control==='textarea'?<textarea value={draft[key]||''} onChange={event=>change(key,event.target.value)} rows={key==='steps'?5:3} maxLength={textLimit(type,key)} required={extra===true}/>:<input type={control} value={draft[key]??''} onChange={event=>change(key,event.target.value)} required={extra===true} maxLength={key==='title'?240:180} min={control==='number'?0:undefined} max={control==='number'?100:undefined} step={control==='number'?1:undefined}/>}</label>)}</div>
    {type==='update'&&!value.id&&<p className="wp-form-hint">Tiến độ và bước tiếp theo của bản cập nhật mới sẽ được áp dụng vào dự án.</p>}
    <div className="wp-actions"><button className="wp-button wp-button-secondary" type="button" onClick={onCancel}>Hủy</button><button className="wp-button wp-button-primary" type="submit"><Save size={15}/>{busy?'Đang lưu…':'Lưu thay đổi'}</button></div></fieldset>
  </form>;
}
function EmptySection({Icon,title,text,action,onAction}) {
  return <div className="wp-empty"><span className="wp-empty-icon"><Icon size={27}/></span><h3>{title}</h3><p>{text}</p>{onAction&&<button className="wp-button wp-button-primary" type="button" onClick={onAction}><Plus size={15}/>{action}</button>}</div>;
}

export default function ProjectDetail({project,onSave,onBack,busy=false,error='',onSearchPeople}) {
  const [tab,setTab]=useState('overview'); const [editing,setEditing]=useState(null); const [overviewEdit,setOverviewEdit]=useState(false);
  const [localError,setLocalError]=useState(''); const [saving,setSaving]=useState(false); const [notice,setNotice]=useState('');
  const [archiveConfirm,setArchiveConfirm]=useState(false); const [removeConfirm,setRemoveConfirm]=useState(''); const [reportFallback,setReportFallback]=useState('');
  const reportRef=useRef(null); const sectionId=useId();
  const canEdit=!!project.canEdit&&!project.archived, canManage=!!project.canManage, disabled=busy||saving;
  const tasks=project.tasks||[], testCases=project.testCases||[], updates=project.updates||[], members=project.members||[], poc=project.poc||{};
  const doneTasks=tasks.filter(task=>task.status==='done').length, passedCases=testCases.filter(testCase=>testCase.status==='passed').length;
  const latestUpdate=useMemo(()=>[...updates].sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0],[updates]);
  useEffect(()=>{setTab('overview');setEditing(null);setOverviewEdit(false);setArchiveConfirm(false);setRemoveConfirm('');setLocalError('');setNotice('');setReportFallback('');},[project.id]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),5000);return()=>clearTimeout(timer);},[notice]);
  async function persist(changes) {
    if(disabled)return false; setSaving(true);setLocalError('');setNotice('');
    try{await onSave({...projectFields(project),...changes,revision:project.revision});setNotice('Đã lưu thay đổi.');return true;}
    catch(failure){setLocalError(failure.message||'Chưa lưu được thay đổi. Vui lòng thử lại.');return false;}
    finally{setSaving(false);}
  }
  function chooseTab(next) {
    if((editing||overviewEdit)&&!window.confirm('Bạn đang chỉnh sửa. Bỏ thay đổi chưa lưu và chuyển mục?'))return false;
    setEditing(null);setOverviewEdit(false);setTab(next);setLocalError('');setRemoveConfirm('');return true;
  }
  function editRecord(type,record={}) {
    if(editing&&!window.confirm('Bỏ thay đổi chưa lưu để chỉnh sửa mục khác?'))return;
    setLocalError('');setRemoveConfirm('');
    const defaults=type==='task'?{title:'',stage:project.stage,status:'todo',owner:'',dueDate:'',why:'',input:'',output:'',result:''}:type==='testCase'?{title:'',status:'not_run',steps:'',expected:'',actual:'',evidence:''}:type==='update'?{date:today(),progress:project.progress||0,text:'',blocker:'',nextStep:project.nextStep||''}:{status:'not_started',startDate:'',endDate:'',objective:'',scope:'',environment:'',input:'',output:'',conclusion:''};
    setEditing({type,value:{...defaults,...record}});
  }
  async function saveRecord(record) {
    const {type}=editing;
    if(type==='poc'){if(await persist({poc:record}))setEditing(null);return;}
    const key=type==='task'?'tasks':type==='testCase'?'testCases':'updates', records=project[key]||[], exists=!!record.id;
    const nextRecord={...record,id:record.id||makeId()};
    const next=exists?records.map(item=>item.id===record.id?nextRecord:item):type==='update'?[nextRecord,...records]:[...records,nextRecord];
    const changes={[key]:next};
    if(type==='update'&&!exists){changes.progress=Number(record.progress);if(record.nextStep?.trim())changes.nextStep=record.nextStep.trim();}
    if(await persist(changes))setEditing(null);
  }
  async function removeRecord(key,id){if(await persist({[key]:(project[key]||[]).filter(record=>record.id!==id)}))setRemoveConfirm('');}
  const actions=(type,key,record)=>!canEdit?null:<div className="wp-actions wp-record-actions">{removeConfirm===record.id?<><span className="wp-confirm-label">Xóa mục này?</span><button className="wp-button wp-button-danger" type="button" disabled={disabled} onClick={()=>removeRecord(key,record.id)}>Xóa</button><button className="wp-button wp-button-secondary" type="button" disabled={disabled} onClick={()=>setRemoveConfirm('')}>Hủy</button></>:<><button className="wp-icon-button" type="button" aria-label="Chỉnh sửa" title="Chỉnh sửa" disabled={disabled} onClick={()=>editRecord(type,record)}><Pencil size={15}/></button><button className="wp-icon-button wp-icon-danger" type="button" aria-label="Xóa" title="Xóa" disabled={disabled} onClick={()=>setRemoveConfirm(record.id)}><Trash2 size={15}/></button></>}</div>;
  const formFor=type=>editing?.type===type&&<RecordForm key={`${type}-${editing.value.id||'new'}`} type={type} value={editing.value} title={type==='task'?'Công việc & kết quả bàn giao':type==='testCase'?'Kịch bản kiểm thử':type==='poc'?'Kế hoạch & kết quả PoC':'Ghi nhận tiến độ'} busy={disabled} onSubmit={saveRecord} onCancel={()=>{setEditing(null);setLocalError('');}} error={localError||error}/>;
  async function copyReport() {
    const blocked=tasks.filter(task=>task.status==='blocked').map(task=>task.title);
    const report=[`BÁO CÁO DỰ ÁN · ${project.name}`,`Khách hàng / Đơn vị: ${filled(project.customer)}`,`Giai đoạn: ${optionLabel(STAGES,project.stage)} · ${optionLabel(STATUSES,project.status)}`,`Thời gian: ${formatDate(project.startDate)} → ${formatDate(project.endDate)}`,`Tiến độ: ${project.progress||0}%`,'',`LÝ DO: ${filled(project.reason)}`,`MỤC TIÊU: ${filled(project.objective)}`,`ĐẦU VÀO: ${filled(project.input)}`,`ĐẦU RA: ${filled(project.output)}`,'',`CÔNG VIỆC: ${doneTasks}/${tasks.length} hoàn thành`,...tasks.map(task=>`- [${optionLabel(TASK_STATUSES,task.status)}] ${task.title}${task.owner?' · '+task.owner:''}${task.result?' · Kết quả: '+task.result:''}`),'',`POC: ${optionLabel(POC_STATUSES,poc.status||'not_started')}`,`Mục tiêu PoC: ${filled(poc.objective)}`,`Kết luận: ${filled(poc.conclusion)}`,`Test case: ${passedCases}/${testCases.length} đạt`,'',`CẬP NHẬT GẦN NHẤT: ${latestUpdate?formatDate(latestUpdate.date)+' · '+latestUpdate.text:'Chưa cập nhật'}`,`VƯỚNG MẮC: ${[latestUpdate?.blocker,...blocked].filter(Boolean).join('; ')||'Chưa ghi nhận'}`,`BƯỚC TIẾP THEO: ${filled(project.nextStep)}`,'','ASIC WORKS · Báo cáo từ dữ liệu dự án đã lưu'].join('\n');
    try{await navigator.clipboard.writeText(report);setNotice('Đã sao chép báo cáo dự án.');setReportFallback('');}
    catch{setReportFallback(report);setNotice('Chọn và sao chép nội dung báo cáo bên dưới.');}
  }
  const common={project,canEdit,canManage,disabled,persist,editing,editRecord,formFor,actions,tasks,testCases,updates,members,poc,doneTasks,passedCases};
  return <div className="wp-detail">
    <header className="wp-detail-header"><button className="wp-back" type="button" onClick={onBack}><ArrowLeft size={16}/>Tất cả dự án</button><div className="wp-detail-title"><div><span className="wp-eyebrow">PROJECT WORKSPACE</span><h1>{project.name}</h1><p>{project.customer||'Chưa ghi khách hàng / đơn vị'}</p></div><div className="wp-actions"><button className="wp-button wp-button-secondary" type="button" onClick={copyReport}><Copy size={15}/>Sao chép báo cáo</button>{canEdit&&tab==='overview'&&!overviewEdit&&<button className="wp-button wp-button-primary" type="button" disabled={disabled} onClick={()=>setOverviewEdit(true)}><Pencil size={15}/>Chỉnh sửa dự án</button>}</div></div><div className="wp-badges"><span className={`wp-badge wp-stage-${project.stage}`}>{optionLabel(STAGES,project.stage)}</span><span className={`wp-badge wp-status-${project.status}`}>{optionLabel(STATUSES,project.status)}</span>{project.archived&&<span className="wp-badge"><Archive size={12}/>Đã lưu trữ</span>}<span className="wp-role-note"><ShieldCheck size={13}/>{canManage?'Chủ sở hữu / Quản trị':canEdit?'Được chỉnh sửa':'Chỉ xem'}</span></div></header>
    {(error||localError)&&!editing&&<div className="wp-error" role="alert">{localError||error}</div>}
    {notice&&<div className="wp-notice" role="status"><CheckCircle2 size={16}/>{notice}<button className="wp-icon-button" type="button" onClick={()=>setNotice('')} aria-label="Đóng thông báo"><X size={14}/></button></div>}
    {project.archived&&<div className="wp-readonly-note"><Archive size={16}/><span>Dự án đã lưu trữ. Khôi phục để tiếp tục chỉnh sửa.</span>{canManage&&<button className="wp-button wp-button-secondary" type="button" disabled={disabled} onClick={()=>persist({archived:false})}><RotateCcw size={14}/>Khôi phục dự án</button>}</div>}
    {reportFallback&&<section className="wp-panel wp-report-export"><div className="wp-section-heading"><h2>Báo cáo để sao chép</h2><div className="wp-actions"><button className="wp-button wp-button-secondary" type="button" onClick={()=>{reportRef.current?.focus();reportRef.current?.select();}}>Chọn tất cả</button><button className="wp-icon-button" type="button" onClick={()=>setReportFallback('')} aria-label="Đóng báo cáo"><X size={17}/></button></div></div><textarea ref={reportRef} readOnly value={reportFallback} rows="12" aria-label="Báo cáo dự án"/></section>}
    <div className="wp-detail-tabs" role="tablist" aria-label="Thông tin dự án">{tabs.map(([key,label,Icon])=><button type="button" key={key} role="tab" id={`${sectionId}-${key}-tab`} aria-selected={tab===key} aria-controls={`${sectionId}-${key}-panel`} tabIndex={tab===key?0:-1} onClick={()=>chooseTab(key)} onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const index=tabs.findIndex(item=>item[0]===key);const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length;if(chooseTab(tabs[next][0]))document.getElementById(`${sectionId}-${tabs[next][0]}-tab`)?.focus();}}><Icon size={16}/>{label}{key==='tasks'&&<span>{tasks.length}</span>}{key==='poc'&&<span>{testCases.length}</span>}{key==='updates'&&<span>{updates.length}</span>}</button>)}</div>
    <div className="wp-tab-panel" role="tabpanel" aria-labelledby={`${sectionId}-${tab}-tab`} id={`${sectionId}-${tab}-panel`}>
      {tab==='overview'&&<Overview {...common} overviewEdit={overviewEdit} setOverviewEdit={setOverviewEdit} localError={localError||error} onSearchPeople={onSearchPeople} archiveConfirm={archiveConfirm} setArchiveConfirm={setArchiveConfirm}/>}
      {tab==='tasks'&&<Tasks {...common}/>}{tab==='poc'&&<Poc {...common}/>}{tab==='updates'&&<Updates {...common}/>}
    </div>
  </div>;
}

function Overview({project,canEdit,canManage,disabled,persist,tasks,testCases,doneTasks,passedCases,overviewEdit,setOverviewEdit,localError,onSearchPeople,archiveConfirm,setArchiveConfirm}) {
  return <div className="wp-detail-grid"><div className="wp-detail-main">
    {overviewEdit&&canEdit?<section className="wp-panel"><ProjectForm key={project.id} project={project} busy={disabled} error={localError} onCancel={()=>setOverviewEdit(false)} onSubmit={async changes=>{if(await persist(changes))setOverviewEdit(false);else throw new Error('Chưa lưu được thông tin dự án. Vui lòng kiểm tra và thử lại.');}}/></section>:<>
      <section className="wp-panel"><div className="wp-section-heading"><span className="wp-section-icon"><Target size={20}/></span><div><span className="wp-eyebrow">WHY WE DO THIS</span><h2>Mục đích & kết quả cần đạt</h2></div></div><dl className="wp-description-list"><FieldSummary label="Lý do / Bài toán cần giải quyết" wide>{project.reason}</FieldSummary><FieldSummary label="Mục tiêu dự án" wide>{project.objective}</FieldSummary><FieldSummary label="Đầu vào cần chuẩn bị">{project.input}</FieldSummary><FieldSummary label="Đầu ra / Hạng mục bàn giao">{project.output}</FieldSummary></dl></section>
      <section className="wp-panel"><div className="wp-section-heading"><span className="wp-section-icon"><FileText size={19}/></span><div><span className="wp-eyebrow">PROJECT CONTEXT</span><h2>Phạm vi & bước tiếp theo</h2></div></div><dl className="wp-description-list"><FieldSummary label="Mô tả / Phạm vi công việc" wide>{project.description}</FieldSummary><FieldSummary label="Bước tiếp theo" wide>{project.nextStep}</FieldSummary></dl></section>
    </>}
  </div><aside className="wp-detail-aside">
    <section className="wp-panel wp-progress-panel"><span className="wp-eyebrow">TIẾN ĐỘ DỰ ÁN</span><div className="wp-progress-total"><b>{project.progress||0}<small>%</small></b><span>{optionLabel(STATUSES,project.status)}</span></div><progress value={project.progress||0} max="100" aria-label="Tiến độ dự án"/><div className="wp-progress-counters"><span><CheckCircle2 size={15}/><b>{doneTasks}/{tasks.length}</b> công việc xong</span><span><FlaskConical size={15}/><b>{passedCases}/{testCases.length}</b> test case đạt</span></div><dl className="wp-project-facts"><div><dt><CalendarDays size={14}/>Bắt đầu</dt><dd>{formatDate(project.startDate)}</dd></div><div><dt><Flag size={14}/>Dự kiến kết thúc</dt><dd>{formatDate(project.endDate)}</dd></div><div><dt><Users size={14}/>Chủ sở hữu</dt><dd>{project.ownerName||'Chưa cập nhật'}</dd></div></dl></section>
    <MembersPanel project={project} canManage={canManage&&!project.archived} disabled={disabled} persist={persist} onSearchPeople={onSearchPeople}/>
    {canManage&&!project.archived&&<section className="wp-panel wp-archive-panel"><h3>Lưu trữ dự án</h3><p className="wp-form-hint">Giữ lại thông tin và lịch sử, chuyển dự án sang chế độ chỉ xem.</p>{archiveConfirm?<div className="wp-confirm"><p>Xác nhận lưu trữ “{project.name}”?</p><div className="wp-actions"><button className="wp-button wp-button-secondary" type="button" disabled={disabled} onClick={()=>setArchiveConfirm(false)}>Hủy</button><button className="wp-button wp-button-danger" type="button" disabled={disabled} onClick={async()=>{if(await persist({archived:true}))setArchiveConfirm(false);}}><Archive size={14}/>Lưu trữ</button></div></div>:<button className="wp-button wp-button-secondary" type="button" disabled={disabled} onClick={()=>setArchiveConfirm(true)}><Archive size={15}/>Lưu trữ dự án</button>}</section>}
  </aside></div>;
}

function MembersPanel({project,canManage,disabled,persist,onSearchPeople}) {
  const [query,setQuery]=useState('');const [results,setResults]=useState([]);const [state,setState]=useState('idle');const [error,setError]=useState('');const [role,setRole]=useState('viewer');
  const members=project.members||[];
  useEffect(()=>{
    let active=true;const value=query.trim();setResults([]);setError('');
    if(!canManage||!onSearchPeople||value.length<2){setState('idle');return()=>{active=false;};}
    setState('loading');
    const timer=setTimeout(()=>{Promise.resolve().then(()=>onSearchPeople(value)).then(people=>{
      if(!active)return;const currentIds=new Set([project.ownerId,...members.map(member=>member.userId)].map(String));
      setResults((Array.isArray(people)?people:people?.items||[]).filter(person=>!currentIds.has(String(person.userId||person.id))));setState('ready');
    }).catch(failure=>{if(active){setState('error');setError(failure.message||'Chưa tìm được tài khoản.');}});},300);
    return()=>{active=false;clearTimeout(timer);};
  },[query,canManage,onSearchPeople,project.ownerId,members]);
  return <section className="wp-panel"><div className="wp-section-heading"><div><span className="wp-eyebrow">PRIVATE WORKSPACE</span><h2>Người tham gia</h2></div><Users size={18}/></div><p className="wp-form-hint">Chỉ chủ sở hữu, quản trị viên và các tài khoản được cấp quyền có thể truy cập.</p>
    <div className="wp-member-list"><div className="wp-member"><span className="wp-member-avatar">{(project.ownerName||'C').slice(0,1).toUpperCase()}</span><div className="wp-member-info"><b>{project.ownerName||'Chủ sở hữu'}</b><small>Chủ sở hữu</small></div><ShieldCheck size={15}/></div>{members.filter(member=>String(member.userId)!==String(project.ownerId)).map(member=><div className="wp-member" key={member.userId}><span className="wp-member-avatar">{(member.displayName||'T').slice(0,1).toUpperCase()}</span><div className="wp-member-info"><b>{member.displayName||member.username||'Thành viên'}</b>{canManage?<select value={member.role} aria-label={`Quyền của ${member.displayName||member.username}`} disabled={disabled} onChange={event=>persist({members:members.map(item=>item.userId===member.userId?{...item,role:event.target.value}:item)})}><option value="viewer">Chỉ xem</option><option value="editor">Chỉnh sửa</option></select>:<small>{member.role==='editor'?'Chỉnh sửa':'Chỉ xem'}</small>}</div>{canManage&&<button className="wp-icon-button wp-icon-danger" type="button" aria-label={`Gỡ ${member.displayName||'thành viên'}`} title="Gỡ quyền truy cập" disabled={disabled} onClick={()=>{if(window.confirm(`Gỡ quyền truy cập dự án của ${member.displayName||'thành viên này'}?`))persist({members:members.filter(item=>item.userId!==member.userId)});}}><X size={14}/></button>}</div>)}</div>
    {canManage&&onSearchPeople&&<div className="wp-invite"><label className="wp-field"><span><UserPlus size={14}/>Thêm người tham gia</span><div className="wp-people-search"><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Tìm tên hoặc tài khoản…" maxLength={80} disabled={disabled} autoComplete="off"/></div></label><label className="wp-field"><span>Quyền được cấp</span><select value={role} onChange={event=>setRole(event.target.value)} disabled={disabled}><option value="viewer">Chỉ xem</option><option value="editor">Chỉnh sửa</option></select></label>{state==='loading'&&<p className="wp-form-hint" role="status">Đang tìm tài khoản…</p>}{state==='error'&&<p className="wp-error" role="alert">{error}</p>}{state==='ready'&&!results.length&&<p className="wp-form-hint">Không có tài khoản phù hợp chưa tham gia dự án.</p>}<div className="wp-people-results">{results.slice(0,8).map(person=><button className="wp-person-result" type="button" key={person.userId||person.id} disabled={disabled} onClick={async()=>{if(await persist({members:[...members,{userId:person.userId||person.id,displayName:person.displayName||person.username,role}]})){setQuery('');setResults([]);}}}><span><b>{person.displayName||person.username}</b><small>{person.username}</small></span><Plus size={16}/></button>)}</div></div>}
  </section>;
}

function Tasks({project,canEdit,disabled,persist,editing,editRecord,formFor,actions,tasks}) {
  return <section className="wp-panel"><div className="wp-section-heading"><div><span className="wp-eyebrow">EXECUTION PLAN</span><h2>Công việc & hạng mục bàn giao</h2><p>Mỗi công việc có mục đích rõ ràng, đầu vào cần chuẩn bị và kết quả cần bàn giao.</p></div>{canEdit&&!editing&&<button className="wp-button wp-button-primary" type="button" disabled={disabled} onClick={()=>editRecord('task')}><Plus size={16}/>Thêm công việc</button>}</div>
    {formFor('task')}
    {!tasks.length&&!editing?<EmptySection Icon={ListChecks} title="Chưa có công việc" text="Chia dự án thành các công việc theo từng giai đoạn để theo dõi trách nhiệm và kết quả." action="Thêm công việc đầu tiên" onAction={canEdit?()=>editRecord('task'):undefined}/>:<div className="wp-record-list">{tasks.map(task=><article className="wp-record-card" key={task.id}><div className="wp-record-header"><span className={`wp-record-status wp-status-${task.status}`}><CheckCircle2 size={19}/></span><div className="wp-record-title"><h3>{task.title}</h3><div className="wp-record-meta"><span className={`wp-badge wp-stage-${task.stage}`}>{optionLabel(STAGES,task.stage)}</span><span>{task.owner||'Chưa phân công'}</span>{task.dueDate&&<span><CalendarDays size={12}/>{formatDate(task.dueDate)}</span>}</div></div>{actions('task','tasks',task)}</div>
      <div className="wp-record-status-control">{canEdit?<label><span className="wp-sr-only">Trạng thái công việc {task.title}</span><select value={task.status} disabled={disabled} onChange={event=>persist({tasks:tasks.map(item=>item.id===task.id?{...item,status:event.target.value}:item)})}>{TASK_STATUSES.map(item=><option value={item.value} key={item.value}>{item.label}</option>)}</select></label>:<span className={`wp-badge wp-status-${task.status}`}>{optionLabel(TASK_STATUSES,task.status)}</span>}</div>
      <dl className="wp-record-fields"><FieldSummary label="Mục đích / Vì sao cần làm?" wide>{task.why}</FieldSummary><FieldSummary label="Đầu vào">{task.input}</FieldSummary><FieldSummary label="Đầu ra cần bàn giao">{task.output}</FieldSummary>{task.result&&<FieldSummary label="Kết quả thực tế" wide>{task.result}</FieldSummary>}</dl>
    </article>)}</div>}
  </section>;
}

function Poc({canEdit,disabled,editing,editRecord,formFor,actions,testCases,poc,passedCases}) {
  return <><section className="wp-panel"><div className="wp-section-heading"><div><span className="wp-eyebrow">PROOF OF CONCEPT</span><h2>Kế hoạch & kết quả PoC</h2><p>Phạm vi, môi trường và kết luận của đợt thử nghiệm.</p></div><div className="wp-actions"><span className={`wp-badge wp-status-${poc.status||'not_started'}`}>{optionLabel(POC_STATUSES,poc.status||'not_started')}</span>{canEdit&&!editing&&<button className="wp-button wp-button-secondary" type="button" disabled={disabled} onClick={()=>editRecord('poc',poc)}><Pencil size={15}/>Cập nhật PoC</button>}</div></div>
    {formFor('poc')}
    {editing?.type!=='poc'&&<dl className="wp-description-list"><FieldSummary label="Mục tiêu / Tiêu chí đánh giá" wide>{poc.objective}</FieldSummary><FieldSummary label="Phạm vi thử nghiệm">{poc.scope}</FieldSummary><FieldSummary label="Môi trường / Cấu hình">{poc.environment}</FieldSummary><FieldSummary label="Đầu vào">{poc.input}</FieldSummary><FieldSummary label="Đầu ra cần bàn giao">{poc.output}</FieldSummary><FieldSummary label="Thời gian">{poc.startDate||poc.endDate?`${formatDate(poc.startDate)} → ${formatDate(poc.endDate)}`:''}</FieldSummary><FieldSummary label="Kết luận / Đề xuất sau PoC" wide>{poc.conclusion}</FieldSummary></dl>}
  </section><section className="wp-panel"><div className="wp-section-heading"><div><span className="wp-eyebrow">VALIDATION CHECKLIST</span><h2>Test case & minh chứng</h2><p>{passedCases}/{testCases.length} test case đạt · Đối chiếu tiêu chí đánh giá với kết quả thực tế.</p></div>{canEdit&&!editing&&<button className="wp-button wp-button-primary" type="button" disabled={disabled} onClick={()=>editRecord('testCase')}><Plus size={16}/>Thêm test case</button>}</div>
    {formFor('testCase')}
    {!testCases.length&&!editing?<EmptySection Icon={ClipboardCheck} title="Chưa có test case" text="Xác định kịch bản, các bước thực hiện và kết quả mong đợi trước khi bắt đầu thử nghiệm." action="Tạo test case đầu tiên" onAction={canEdit?()=>editRecord('testCase'):undefined}/>:<div className="wp-record-list">{testCases.map((testCase,index)=><article className="wp-record-card" key={testCase.id}><div className="wp-record-header"><span className="wp-case-number">TC {String(index+1).padStart(2,'0')}</span><div className="wp-record-title"><h3>{testCase.title}</h3><span className={`wp-badge wp-status-${testCase.status}`}>{optionLabel(CASE_STATUSES,testCase.status)}</span></div>{actions('testCase','testCases',testCase)}</div><dl className="wp-record-fields"><FieldSummary label="Các bước thực hiện" wide>{testCase.steps}</FieldSummary><FieldSummary label="Kết quả mong đợi / Tiêu chí đạt">{testCase.expected}</FieldSummary><FieldSummary label="Kết quả thực tế">{testCase.actual}</FieldSummary>{testCase.evidence&&<FieldSummary label="Minh chứng" wide>{/^https?:\/\/\S+$/i.test(testCase.evidence)?<a href={testCase.evidence} target="_blank" rel="noreferrer">{testCase.evidence}<ArrowRight size={13}/></a>:testCase.evidence}</FieldSummary>}</dl></article>)}</div>}
  </section></>;
}

function Updates({canEdit,disabled,editing,editRecord,formFor,actions,updates}) {
  return <section className="wp-panel"><div className="wp-section-heading"><div><span className="wp-eyebrow">PROJECT LOG</span><h2>Nhịp tiến độ của dự án</h2><p>Ghi nhận công việc đã làm, vướng mắc và bước tiếp theo sau mỗi lần làm việc.</p></div>{canEdit&&!editing&&<button className="wp-button wp-button-primary" type="button" disabled={disabled} onClick={()=>editRecord('update')}><MessageSquarePlus size={16}/>Thêm cập nhật</button>}</div>
    {formFor('update')}
    {!updates.length&&!editing?<EmptySection Icon={History} title="Chưa có bản cập nhật" text="Ghi nhận tiến độ đầu tiên để cả nhóm nắm được tình hình và việc cần làm tiếp theo." action="Ghi nhận tiến độ" onAction={canEdit?()=>editRecord('update'):undefined}/>:<div className="wp-timeline">{[...updates].sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(update=><article className="wp-update-card" key={update.id}><div className="wp-record-header"><span className="wp-timeline-dot"/><div className="wp-record-title"><time dateTime={update.date}>{formatDate(update.date)}</time><h3>{update.progress}% tiến độ</h3></div>{actions('update','updates',update)}</div><p className="wp-update-text">{update.text}</p>{update.blocker&&<div className="wp-blocker"><Flag size={15}/><div><b>Vướng mắc / Cần hỗ trợ</b><p>{update.blocker}</p></div></div>}{update.nextStep&&<div className="wp-update-next"><ArrowRight size={15}/><div><b>Bước tiếp theo</b><p>{update.nextStep}</p></div></div>}</article>)}</div>}
  </section>;
}
