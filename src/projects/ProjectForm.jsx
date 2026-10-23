import { useId, useState } from 'react';
import { ArrowRight, CalendarDays, FileText, Save, Target, X } from 'lucide-react';
import { STAGES, STATUSES } from './model.js';

const initialFields = project => ({
  name:project?.name || '', customer:project?.customer || '', startDate:project?.startDate || '', endDate:project?.endDate || '',
  stage:project?.stage || 'presale', status:project?.status || 'planned', progress:project?.progress ?? 0,
  reason:project?.reason || '', objective:project?.objective || '', input:project?.input || '', output:project?.output || '',
  description:project?.description || '', nextStep:project?.nextStep || '',
});

export default function ProjectForm({ project, onSubmit, onCancel, busy=false, error='' }) {
  const id=useId();
  const [fields,setFields]=useState(()=>initialFields(project));
  const [localError,setLocalError]=useState('');
  const [submitting,setSubmitting]=useState(false);
  const disabled=busy || submitting;
  const change=(name,value)=>setFields(previous=>({...previous,[name]:value}));
  async function submit(event) {
    event.preventDefault(); if(disabled)return; setLocalError('');
    if(fields.startDate && fields.endDate && fields.endDate<fields.startDate){setLocalError('Ngày kết thúc cần bằng hoặc sau ngày bắt đầu.');return;}
    setSubmitting(true);
    try{await onSubmit({...fields,name:fields.name.trim(),customer:fields.customer.trim(),progress:Number(fields.progress)});}
    catch(failure){setLocalError(failure.message || 'Chưa lưu được dự án. Vui lòng thử lại.');}
    finally{setSubmitting(false);}
  }
  return <form className="wp-form" onSubmit={submit} aria-labelledby={`${id}-heading`}>
    <div className="wp-section-heading"><span className="wp-section-icon"><FileText size={20}/></span><div><span className="wp-eyebrow">PROJECT BRIEF</span><h2 id={`${id}-heading`}>{project?'Chỉnh sửa thông tin dự án':'Một dự án mới, một mục tiêu rõ ràng.'}</h2><p>Ghi rõ lý do triển khai, đầu vào và kết quả cần bàn giao để cả nhóm cùng theo dõi.</p></div></div>
    {(localError || error)&&<div className="wp-error" role="alert">{localError || error}</div>}
    <fieldset disabled={disabled} className="wp-form-fieldset">
      <section className="wp-form-section"><h3><FileText size={16}/>Thông tin chung</h3><div className="wp-fields">
        <label className="wp-field wp-field-wide"><span>Tên dự án <b aria-hidden="true">*</b></span><input autoFocus={!project} value={fields.name} onChange={event=>change('name',event.target.value)} required maxLength={180} placeholder="Tên giải pháp hoặc dự án triển khai" autoComplete="off"/></label>
        <label className="wp-field wp-field-wide"><span>Khách hàng / Đơn vị</span><input value={fields.customer} onChange={event=>change('customer',event.target.value)} maxLength={180} placeholder="Đơn vị sử dụng hoặc khách hàng" autoComplete="organization"/></label>
        <label className="wp-field"><span>Giai đoạn</span><select value={fields.stage} onChange={event=>change('stage',event.target.value)}>{STAGES.map(item=><option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
        <label className="wp-field"><span>Trạng thái</span><select value={fields.status} onChange={event=>change('status',event.target.value)}>{STATUSES.map(item=><option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
        <label className="wp-field"><span><CalendarDays size={13}/>Ngày bắt đầu</span><input type="date" value={fields.startDate} max={fields.endDate || undefined} onChange={event=>change('startDate',event.target.value)}/></label>
        <label className="wp-field"><span><CalendarDays size={13}/>Ngày dự kiến kết thúc</span><input type="date" value={fields.endDate} min={fields.startDate || undefined} onChange={event=>change('endDate',event.target.value)}/></label>
        <label className="wp-field wp-field-wide"><span>Tiến độ hiện tại <strong>{fields.progress}%</strong></span><div className="wp-progress-input"><input type="range" min="0" max="100" step="1" value={fields.progress} onChange={event=>change('progress',event.target.value)} aria-label="Tiến độ dự án"/><input type="number" min="0" max="100" step="1" value={fields.progress} onChange={event=>change('progress',event.target.value)} required aria-label="Tiến độ dự án theo phần trăm"/></div></label>
      </div></section>
      <section className="wp-form-section"><h3><Target size={16}/>Vì sao thực hiện & kết quả cần đạt</h3><div className="wp-fields">
        <label className="wp-field wp-field-wide"><span>Lý do / Bài toán cần giải quyết</span><textarea rows="3" value={fields.reason} onChange={event=>change('reason',event.target.value)} maxLength={10000} placeholder="Vì sao cần thực hiện? Khó khăn hoặc nhu cầu hiện tại là gì?"/></label>
        <label className="wp-field wp-field-wide"><span>Mục tiêu dự án</span><textarea rows="3" value={fields.objective} onChange={event=>change('objective',event.target.value)} maxLength={10000} placeholder="Kết quả có thể kiểm chứng sau khi hoàn thành"/></label>
        <label className="wp-field"><span>Đầu vào cần chuẩn bị</span><textarea rows="4" value={fields.input} onChange={event=>change('input',event.target.value)} maxLength={10000} placeholder="Dữ liệu, quyền truy cập, hạ tầng, tài liệu và nguồn lực…"/></label>
        <label className="wp-field"><span>Đầu ra / Hạng mục bàn giao</span><textarea rows="4" value={fields.output} onChange={event=>change('output',event.target.value)} maxLength={10000} placeholder="Báo cáo, cấu hình, tài liệu, kết quả test hoặc biên bản…"/></label>
        <label className="wp-field wp-field-wide"><span>Mô tả / Phạm vi công việc</span><textarea rows="4" value={fields.description} onChange={event=>change('description',event.target.value)} maxLength={12000} placeholder="Phạm vi, thông tin nền và những điểm cả nhóm cần biết"/></label>
        <label className="wp-field wp-field-wide"><span>Bước tiếp theo</span><textarea rows="2" value={fields.nextStep} onChange={event=>change('nextStep',event.target.value)} maxLength={10000} placeholder="Việc cần làm ngay sau khi tạo hoặc cập nhật dự án"/></label>
      </div></section>
      <div className="wp-actions wp-form-actions"><button className="wp-button wp-button-secondary" type="button" onClick={onCancel}><X size={16}/>Hủy</button><button className="wp-button wp-button-primary" type="submit"><Save size={16}/>{disabled?'Đang lưu…':project?'Lưu thay đổi':'Tạo dự án'}<ArrowRight size={15}/></button></div>
    </fieldset>
  </form>;
}
