import { transaction, fail, audit } from './db.js';
import { id } from './security.js';
import { readJson } from './admin.js';

const stages = ['presale', 'onsite', 'postsale'];
const statuses = ['planned', 'active', 'blocked', 'completed', 'cancelled'];
const pocStatuses = ['not_started', 'planning', 'running', 'passed', 'failed', 'on_hold'];
const taskStatuses = ['todo', 'in_progress', 'blocked', 'done'];
const testStatuses = ['not_run', 'passed', 'failed', 'blocked'];
const textFields = ['reason', 'objective', 'input', 'output', 'description', 'nextStep'];
const owns = (value, field) => Object.hasOwn(value, field);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const pick = (body, previous, field, fallback = '') => owns(body, field) ? body[field] : previous?.[field] ?? fallback;
const string = (value, max, label, required = false) => {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw fail(400, `${label} không hợp lệ.`);
  return value.trim();
};
const choice = (value, allowed, label) => {
  if (!allowed.includes(value)) throw fail(400, `${label} không hợp lệ.`);
  return value;
};
const progressValue = (value, label = 'Tiến độ') => {
  if (!Number.isInteger(value) || value < 0 || value > 100) throw fail(400, `${label} cần là số từ 0 đến 100.`);
  return value;
};
const dateValue = (value, label) => {
  if (value === '' || value === null) return '';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw fail(400, `${label} cần theo định dạng YYYY-MM-DD.`);
  const parsed = new Date(value + 'T00:00:00.000Z');
  if (!value.startsWith('0000') && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value) return value;
  throw fail(400, `${label} không hợp lệ.`);
};
const dates = (body, previous, label) => {
  const startDate = dateValue(pick(body, previous, 'startDate'), `Ngày bắt đầu ${label}`);
  const endDate = dateValue(pick(body, previous, 'endDate'), `Ngày kết thúc ${label}`);
  if (startDate && endDate && endDate < startDate) throw fail(400, `Ngày kết thúc ${label} không thể trước ngày bắt đầu.`);
  return { startDate, endDate };
};
function recordArray(value, max, label, parse) {
  if (!Array.isArray(value) || value.length > max) throw fail(400, `${label} tối đa ${max} mục.`);
  const seen = new Set();
  return value.map(item => {
    if (!object(item)) throw fail(400, `${label} không hợp lệ.`);
    const itemId = item.id === undefined || item.id === '' ? id() : item.id;
    if (typeof itemId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(itemId) || seen.has(itemId)) throw fail(400, `Mã trong ${label.toLowerCase()} không hợp lệ hoặc bị trùng.`);
    seen.add(itemId);
    return { id: itemId, ...parse(item) };
  });
}
const iso = value => value instanceof Date ? value.toISOString() : value;
const dateString = value => value ? iso(value).slice(0, 10) : '';
const literalPattern = value => value.replace(/[\\%_]/g, '\\$&');

function projectData(body, previous = {}) {
  const result = {
    name: string(pick(body, previous, 'name'), 180, 'Tên dự án', true),
    customer: string(pick(body, previous, 'customer'), 240, 'Khách hàng'),
    stage: choice(pick(body, previous, 'stage', 'presale'), stages, 'Giai đoạn'),
    status: choice(pick(body, previous, 'status', 'planned'), statuses, 'Trạng thái'),
    progress: progressValue(pick(body, previous, 'progress', 0)),
    ...dates(body, previous, 'dự án'),
  };
  for (const field of textFields) result[field] = string(pick(body, previous, field), 12000, field);
  const poc = owns(body, 'poc') ? body.poc : {};
  if (!object(poc)) throw fail(400, 'Thông tin PoC không hợp lệ.');
  result.poc = { status: choice(pick(poc, previous.poc, 'status', 'not_started'), pocStatuses, 'Trạng thái PoC'), ...dates(poc, previous.poc, 'PoC') };
  for (const field of ['objective', 'scope', 'environment', 'input', 'output', 'conclusion']) result.poc[field] = string(pick(poc, previous.poc, field), 12000, `PoC ${field}`);
  result.tasks = recordArray(pick(body, previous, 'tasks', []), 200, 'Công việc', task => ({
    title: string(task.title, 240, 'Tên công việc', true),
    stage: choice(task.stage ?? 'presale', stages, 'Giai đoạn công việc'),
    status: choice(task.status ?? 'todo', taskStatuses, 'Trạng thái công việc'),
    why: string(task.why ?? '', 4000, 'Mục đích công việc'),
    input: string(task.input ?? '', 4000, 'Đầu vào công việc'),
    output: string(task.output ?? '', 4000, 'Đầu ra công việc'),
    result: string(task.result ?? '', 8000, 'Kết quả công việc'),
    owner: string(task.owner ?? '', 180, 'Người phụ trách'),
    dueDate: dateValue(task.dueDate ?? '', 'Hạn công việc'),
  }));
  result.testCases = recordArray(pick(body, previous, 'testCases', []), 200, 'Ca kiểm thử', item => ({
    title: string(item.title, 240, 'Tên ca kiểm thử', true),
    steps: string(item.steps ?? '', 10000, 'Các bước kiểm thử'),
    expected: string(item.expected ?? '', 8000, 'Kết quả mong đợi'),
    actual: string(item.actual ?? '', 8000, 'Kết quả thực tế'),
    evidence: string(item.evidence ?? '', 4000, 'Minh chứng kiểm thử'),
    status: choice(item.status ?? 'not_run', testStatuses, 'Trạng thái ca kiểm thử'),
  }));
  result.updates = recordArray(pick(body, previous, 'updates', []), 100, 'Nhật ký cập nhật', item => ({
    date: dateValue(item.date ?? '', 'Ngày cập nhật'),
    text: string(item.text ?? '', 8000, 'Nội dung cập nhật', true),
    blocker: string(item.blocker ?? '', 4000, 'Vướng mắc'),
    nextStep: string(item.nextStep ?? '', 4000, 'Bước tiếp theo'),
    progress: progressValue(item.progress ?? result.progress, 'Tiến độ cập nhật'),
  }));
  return result;
}
function memberData(value, ownerId) {
  if (!Array.isArray(value) || value.length > 50) throw fail(400, 'Dự án tối đa 50 thành viên.');
  const seen = new Set();
  return value.map(member => {
    if (!object(member)) throw fail(400, 'Thành viên không hợp lệ.');
    const userId = string(member.userId, 100, 'Tài khoản thành viên', true);
    if (seen.has(userId) || userId === ownerId) throw fail(400, 'Thành viên bị trùng hoặc đã là chủ dự án.');
    seen.add(userId);
    return { userId, role: choice(member.role, ['editor', 'viewer'], 'Quyền thành viên') };
  });
}
const memberSignature = members => members.map(member => `${member.userId}:${member.role}`).sort().join('|');
function columns(data) {
  const { name, customer, startDate, endDate, stage, status, progress, ...content } = data;
  return [name, customer, startDate || null, endDate || null, stage, status, progress, JSON.stringify(content)];
}

const baseSelect = `SELECT p.*, COALESCE(ou.display_name,p.owner_name) AS current_owner_name
  FROM projects p LEFT JOIN users ou ON ou.id=p.owner_id`;
const visibleSql = (userParameter = '$1', adminParameter = '$2') => `(p.owner_id=${userParameter} OR ${adminParameter}::boolean OR EXISTS(SELECT 1 FROM project_members acl WHERE acl.project_id=p.id AND acl.user_id=${userParameter}))`;
async function getMembers(db, projectIds) {
  if (!projectIds.length) return new Map();
  const { rows } = await db.query(`SELECT pm.project_id,pm.user_id,pm.role,u.display_name
    FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=ANY($1::text[])
    ORDER BY u.display_name,pm.user_id`, [projectIds]);
  const result = new Map();
  for (const row of rows) {
    if (!result.has(row.project_id)) result.set(row.project_id, []);
    result.get(row.project_id).push({ userId: row.user_id, displayName: row.display_name, role: row.role });
  }
  return result;
}
function access(row, user, members) {
  const canManage = user.role === 'admin' || row.owner_id === user.id;
  const membership = members.find(member => member.userId === user.id);
  const canWrite = canManage || membership?.role === 'editor';
  return { allowed: canManage || Boolean(membership), canManage, canWrite, canEdit: !row.archived && canWrite };
}
function dto(row, user, members = [], summary = false) {
  const permissions = access(row, user, members);
  const result = {
    id: row.id, revision: row.revision, ownerId: row.owner_id, ownerName: row.current_owner_name || row.owner_name,
    createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), archived: row.archived,
    name: row.name, customer: row.customer, startDate: dateString(row.start_date), endDate: dateString(row.end_date),
    stage: row.stage, status: row.status, progress: row.progress, members,
    canManage: permissions.canManage, canEdit: permissions.canEdit,
  };
  if (!summary) return { ...result, ...row.content };
  return { ...result, description: row.description || '', nextStep: row.next_step || '',
    pocStatus: row.poc_status || 'not_started', poc: { status: row.poc_status || 'not_started' },
    tasksTotal: Number(row.tasks_total) || 0, tasksDone: Number(row.tasks_done) || 0,
    testCasesTotal: Number(row.tests_total) || 0, testCasesPassed: Number(row.tests_passed) || 0 };
}
async function replaceMembers(db, projectId, members) {
  if (members.length) {
    const found = await db.query('SELECT id FROM users WHERE id=ANY($1::text[]) AND active=true FOR SHARE', [members.map(member => member.userId)]);
    if (found.rows.length !== members.length) throw fail(400, 'Chỉ thêm được tài khoản đang hoạt động.');
  }
  await db.query('DELETE FROM project_members WHERE project_id=$1', [projectId]);
  if (members.length) await db.query(`INSERT INTO project_members(project_id,user_id,role)
    SELECT $1,u,r FROM unnest($2::text[],$3::text[]) AS members(u,r)`, [projectId, members.map(member => member.userId), members.map(member => member.role)]);
}

async function listProjects(db, url, user) {
  const page = Math.max(1, Math.min(100000, Math.floor(Number(url.searchParams.get('page')) || 1)));
  const limit = Math.max(1, Math.min(50, Math.floor(Number(url.searchParams.get('limit')) || 24)));
  const q = (url.searchParams.get('q') || '').trim().slice(0, 200);
  const stage = url.searchParams.get('stage') || '';
  const status = url.searchParams.get('status') || '';
  const archived = url.searchParams.get('archived') || 'false';
  if (stage && !stages.includes(stage) || status && !statuses.includes(status) || !['true', 'false'].includes(archived)) throw fail(400, 'Bộ lọc dự án không hợp lệ.');
  const params = [user.id, user.role === 'admin', '%' + literalPattern(q) + '%', stage, status, archived === 'true'];
  const filterSql = `(p.name ILIKE $3 OR p.customer ILIKE $3) AND ($4='' OR p.stage=$4) AND ($5='' OR p.status=$5) AND p.archived=$6`;
  const counts = (await db.query(`SELECT count(*) FILTER(WHERE ${filterSql}) AS filtered_total,
    count(*) FILTER(WHERE p.archived=false) AS total,
    count(*) FILTER(WHERE p.archived=false AND p.status='active') AS active,
    count(*) FILTER(WHERE p.archived=false AND p.status='blocked') AS blocked,
    count(*) FILTER(WHERE p.archived=false AND p.status='completed') AS completed,
    count(*) FILTER(WHERE p.archived=false AND p.end_date<CURRENT_DATE AND p.status NOT IN('completed','cancelled')) AS overdue
    FROM projects p WHERE ${visibleSql()}`, params)).rows[0];
  const { rows } = await db.query(`SELECT p.id,p.owner_id,p.owner_name,COALESCE(ou.display_name,p.owner_name) AS current_owner_name,
    p.revision,p.archived,p.name,p.customer,p.start_date,p.end_date,p.stage,p.status,p.progress,p.created_at,p.updated_at,
    p.content->>'description' AS description,p.content->>'nextStep' AS next_step,p.content->'poc'->>'status' AS poc_status,
    jsonb_array_length(COALESCE(p.content->'tasks','[]'::jsonb)) AS tasks_total,
    (SELECT count(*) FROM jsonb_array_elements(COALESCE(p.content->'tasks','[]'::jsonb)) task WHERE task->>'status'='done') AS tasks_done,
    jsonb_array_length(COALESCE(p.content->'testCases','[]'::jsonb)) AS tests_total,
    (SELECT count(*) FROM jsonb_array_elements(COALESCE(p.content->'testCases','[]'::jsonb)) tc WHERE tc->>'status'='passed') AS tests_passed
    FROM projects p LEFT JOIN users ou ON ou.id=p.owner_id WHERE ${visibleSql()} AND ${filterSql}
    ORDER BY p.updated_at DESC,p.id DESC LIMIT $7 OFFSET $8`, [...params, limit, (page - 1) * limit]);
  const members = await getMembers(db, rows.map(row => row.id));
  return { items: rows.map(row => dto(row, user, members.get(row.id), true)), total: Number(counts.filtered_total), page, limit,
    stats: Object.fromEntries(['total', 'active', 'blocked', 'completed', 'overdue'].map(key => [key, Number(counts[key])])) };
}

export async function handleProjects(db, request, url, user) {
  if (!user?.id || user.active === false) throw fail(401, 'Vui lòng đăng nhập để truy cập dự án.');
  const parts = url.pathname.replace(/\/+$/, '').split('/').slice(3);
  const target = parts[0];
  if (parts.length > 1 || !/^\/api\/projects(?:\/|$)/.test(url.pathname)) throw fail(404, 'Không tìm thấy dự án.');
  if (target === 'people') {
    if (request.method !== 'GET') throw fail(405, 'Phương thức không hỗ trợ.');
    const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
    if (q.length < 2) return { items: [] };
    const { rows } = await db.query(`SELECT id,display_name,username FROM users WHERE active=true
      AND (display_name ILIKE $1 OR username ILIKE $1) ORDER BY display_name,id LIMIT 20`, [literalPattern(q) + '%']);
    return { items: rows.map(row => ({ id: row.id, displayName: row.display_name, username: row.username })) };
  }
  if (!target && request.method === 'GET') return listProjects(db, url, user);
  if (!target && request.method === 'POST') {
    const body = await readJson(request);
    const data = projectData(body);
    const members = memberData(body.members ?? [], user.id);
    if (owns(body, 'archived') && typeof body.archived !== 'boolean') throw fail(400, 'Trạng thái lưu trữ không hợp lệ.');
    return transaction(db, async client => {
      const projectId = id();
      await client.query(`INSERT INTO projects(id,owner_id,owner_name,name,customer,start_date,end_date,stage,status,progress,content,archived)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [projectId, user.id, user.displayName || 'Thành viên', ...columns(data), body.archived === true]);
      await replaceMembers(client, projectId, members);
      await audit(client, user, 'project.create', projectId, { stage: data.stage, status: data.status });
      const row = (await client.query(`${baseSelect} WHERE p.id=$1`, [projectId])).rows[0];
      return { project: dto(row, user, (await getMembers(client, [projectId])).get(projectId)) };
    });
  }
  if (!target || !/^[a-f0-9]{28}$/.test(target)) throw fail(404, 'Không tìm thấy dự án.');
  if (!['GET', 'PATCH'].includes(request.method)) throw fail(405, 'Phương thức không hỗ trợ.');
  if (request.method === 'GET') {
    const row = (await db.query(`${baseSelect} WHERE p.id=$1 AND ${visibleSql('$2', '$3')}`, [target, user.id, user.role === 'admin'])).rows[0];
    if (!row) throw fail(404, 'Không tìm thấy dự án.');
    return { project: dto(row, user, (await getMembers(db, [target])).get(target)) };
  }
  return updateProject(db, request, target, user);
}

async function updateProject(db, request, target, user) {
  const body = await readJson(request);
  return transaction(db, async client => {
    const row = (await client.query('SELECT * FROM projects WHERE id=$1 FOR UPDATE', [target])).rows[0];
    if (!row) throw fail(404, 'Không tìm thấy dự án.');
    const members = (await getMembers(client, [target])).get(target) || [];
    const permissions = access(row, user, members);
    if (!permissions.allowed) throw fail(404, 'Không tìm thấy dự án.');
    if (!permissions.canWrite) throw fail(403, 'Bạn chỉ có quyền xem dự án này.');
    if (!Number.isInteger(body.revision) || body.revision < 1) throw fail(400, 'Cần phiên bản hiện tại của dự án trước khi lưu.');
    if (body.revision !== row.revision) throw fail(409, 'Dự án đã được người khác sửa. Tải lại trước khi lưu.');
    const previous = { ...row.content, name: row.name, customer: row.customer, startDate: dateString(row.start_date), endDate: dateString(row.end_date), stage: row.stage, status: row.status, progress: row.progress };
    const data = projectData(body, previous);
    const nextMembers = owns(body, 'members') ? memberData(body.members, row.owner_id) : members;
    const membersChanged = memberSignature(nextMembers) !== memberSignature(members);
    const archived = owns(body, 'archived') ? body.archived : row.archived;
    if (typeof archived !== 'boolean') throw fail(400, 'Trạng thái lưu trữ không hợp lệ.');
    if (!permissions.canManage && (membersChanged || archived !== row.archived)) throw fail(403, 'Chỉ chủ dự án hoặc quản trị viên được quản lý thành viên và lưu trữ.');
    if (row.archived && !permissions.canManage) throw fail(403, 'Dự án đã lưu trữ, bạn chỉ có quyền xem.');
    if (row.archived && archived && JSON.stringify(data) !== JSON.stringify(projectData({}, previous))) throw fail(409, 'Khôi phục dự án trước khi chỉnh sửa nội dung.');
    await client.query(`UPDATE projects SET name=$1,customer=$2,start_date=$3,end_date=$4,stage=$5,status=$6,progress=$7,content=$8,
      archived=$9,revision=revision+1,updated_at=now() WHERE id=$10`, [...columns(data), archived, target]);
    if (membersChanged) await replaceMembers(client, target, nextMembers);
    const action = archived !== row.archived ? archived ? 'project.archive' : 'project.restore' : membersChanged ? 'project.members' : 'project.update';
    await audit(client, user, action, target, { revision: row.revision + 1, stage: data.stage, status: data.status, membersChanged });
    const updated = (await client.query(`${baseSelect} WHERE p.id=$1`, [target])).rows[0];
    return { project: dto(updated, user, (await getMembers(client, [target])).get(target)) };
  });
}
