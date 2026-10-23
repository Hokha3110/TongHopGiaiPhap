export const STAGES = [
  { value:'presale', label:'Pre-sale', hint:'Khảo sát, tư vấn và đề xuất' },
  { value:'onsite', label:'Onsite', hint:'Triển khai, PoC và kiểm chứng' },
  { value:'postsale', label:'Post-sale', hint:'Bàn giao, hỗ trợ và vận hành' },
];
export const STATUSES = [
  { value:'planned', label:'Chưa bắt đầu' }, { value:'active', label:'Đang thực hiện' },
  { value:'blocked', label:'Đang vướng mắc' }, { value:'completed', label:'Hoàn thành' },
  { value:'cancelled', label:'Đã dừng' },
];
export const POC_LABELS = { not_started:'Chưa có PoC', planning:'Chuẩn bị PoC', running:'Đang PoC', passed:'PoC đạt', failed:'PoC chưa đạt', on_hold:'PoC tạm dừng' };
export const POC_STATUSES = Object.entries(POC_LABELS).map(([value,label])=>({value,label}));
export const TASK_STATUSES = [{value:'todo',label:'Chưa làm'},{value:'in_progress',label:'Đang làm'},{value:'blocked',label:'Đang vướng'},{value:'done',label:'Hoàn thành'}];
export const CASE_STATUSES = [{value:'not_run',label:'Chưa chạy'},{value:'passed',label:'Đạt'},{value:'failed',label:'Chưa đạt'},{value:'blocked',label:'Bị chặn'}];
export const makeId = () => crypto.randomUUID();
export const formatDate = value => value ? new Date(`${String(value).slice(0,10)}T12:00:00`).toLocaleDateString('vi-VN') : 'Chưa đặt lịch';
export const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
};
export const isOverdue = project => Boolean(project.endDate && project.endDate < today() && !['completed','cancelled'].includes(project.status));
export const stageLabel = value => STAGES.find(stage => stage.value === value)?.label || value;
export const statusLabel = value => STATUSES.find(status => status.value === value)?.label || value;
export async function worksRequest(path, options = {}) {
  const base = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
  const response = await fetch(base + '/api/' + path, {
    credentials: 'include', ...options,
    headers: { ...(options.body ? { 'Content-Type':'application/json' } : {}), ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || 'Chưa kết nối được máy chủ. Vui lòng thử lại.'), { status:response.status, data });
  return data;
}
