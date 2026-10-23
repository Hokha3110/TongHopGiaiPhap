import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { PGlite } from '@electric-sql/pglite';

test('Private project workspaces persist data and enforce access', async t => {
  process.env.NODE_ENV = 'test';
  const { handleProjects } = await import('../projects.js');
  const pg = new PGlite();
  const schema = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');
  await pg.exec(schema);
  const db = { query: async (sql, params) => {
    const result = await pg.query(sql, params);
    return { ...result, rowCount: result.affectedRows || result.rows.length };
  }, connect: async () => ({ query: db.query, release() {} }) };
  const users = {
    owner: { id: '1'.repeat(28), username: 'owner', displayName: 'Chủ dự án', role: 'member', active: true },
    editor: { id: '2'.repeat(28), username: 'collaborator', displayName: 'Thành viên biên tập', role: 'member', active: true },
    viewer: { id: '3'.repeat(28), username: 'reader', displayName: 'Thành viên xem', role: 'member', active: true },
    outsider: { id: '4'.repeat(28), username: 'outsider', displayName: 'Biên tập viên thư viện', role: 'editor', active: true },
    admin: { id: '5'.repeat(28), username: 'administrator', displayName: 'Admin', role: 'admin', active: true },
    inactive: { id: '6'.repeat(28), username: 'disabled', displayName: 'Tài khoản khóa', role: 'member', active: false },
  };
  for (const user of Object.values(users)) await db.query('INSERT INTO users(id,username,display_name,password_hash,role,active) VALUES($1,$2,$3,$4,$5,$6)', [user.id, user.username, user.displayName, 'test-only-hash', user.role, user.active]);
  async function call(suffix = '', method = 'GET', body, user = users.owner) {
    const request = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
    request.method = method;
    return handleProjects(db, request, new URL('http://localhost/api/projects' + suffix), user);
  }
  const create = (body = {}, user = users.owner) => call('', 'POST', { name: 'Thử nghiệm giải pháp', ...body }, user).then(result => result.project);
  const rejected = (status, job) => assert.rejects(job, error => error.statusCode === status);
  const shared = [{ userId: users.editor.id, role: 'editor' }, { userId: users.viewer.id, role: 'viewer' }];

  try {
    await t.test('migration is idempotent and records version 2', async () => {
      await pg.exec(schema);
      assert.deepEqual((await db.query('SELECT version FROM schema_migrations ORDER BY version')).rows.map(row => row.version), [1, 2]);
    });
    await t.test('create, read, partial update and stale revision preserve structured project data', async () => {
      const project = await create({ customer: 'ASIC', stage: 'onsite', status: 'active', progress: 35,
        startDate: '2026-01-01', endDate: '2026-03-01', reason: 'Nhu cầu khách hàng', objective: 'Đánh giá khả năng', input: 'Phạm vi đã chốt', output: 'Báo cáo',
        poc: { status: 'running', startDate: '2026-01-05', endDate: '2026-01-20', scope: 'Môi trường lab' },
        tasks: [{ title: 'Chuẩn bị', status: 'done', stage: 'presale', why: 'Sẵn sàng triển khai', output: 'Checklist' }],
        testCases: [{ title: 'Đăng nhập', steps: 'Mở trang', expected: 'Đăng nhập thành công', actual: 'Đạt', status: 'passed' }],
        updates: [{ date: '2026-01-10', text: 'Đã hoàn tất chuẩn bị', blocker: '', nextStep: 'Chạy PoC', progress: 35 }],
        ownerId: users.outsider.id, canManage: false });
      assert.equal(project.ownerId, users.owner.id);
      assert.equal(project.revision, 1);
      assert.equal(project.canManage, true);
      assert.equal(project.tasks.length, 1);
      assert.match(project.tasks[0].id, /^[a-f0-9]{28}$/);
      assert.equal(project.testCases[0].actual, 'Đạt');
      assert.equal(project.updates[0].nextStep, 'Chạy PoC');
      const updated = (await call('/' + project.id, 'PATCH', { revision: 1, progress: 60, poc: { status: 'passed' } })).project;
      assert.equal(updated.revision, 2);
      assert.equal(updated.progress, 60);
      assert.equal(updated.poc.scope, 'Môi trường lab');
      assert.equal(updated.poc.status, 'passed');
      assert.equal(updated.tasks[0].id, project.tasks[0].id);
      assert.equal((await call('/' + project.id)).project.output, 'Báo cáo');
      await rejected(409, () => call('/' + project.id, 'PATCH', { revision: 1, progress: 99 }));
      await rejected(400, () => call('/' + project.id, 'PATCH', { progress: 99 }));
      assert.equal((await call('/' + project.id)).project.progress, 60);
    });
    await t.test('owner and project roles govern access independently of library editor role', async () => {
      const project = await create({ members: shared });
      await rejected(401, () => call('', 'GET', undefined, null));
      await rejected(401, () => call('', 'POST', { name: 'Blocked' }, users.inactive));
      await rejected(404, () => call('/' + project.id, 'GET', undefined, users.outsider));
      await rejected(404, () => call('/' + project.id, 'PATCH', { revision: 1, description: 'Forbidden' }, users.outsider));
      const editor = (await call('/' + project.id, 'GET', undefined, users.editor)).project;
      const viewer = (await call('/' + project.id, 'GET', undefined, users.viewer)).project;
      assert.equal(editor.canEdit, true); assert.equal(editor.canManage, false);
      assert.equal(viewer.canEdit, false); assert.equal(viewer.canManage, false);
      await rejected(403, () => call('/' + project.id, 'PATCH', { revision: 1, progress: 50 }, users.viewer));
      await rejected(403, () => call('/' + project.id, 'PATCH', { revision: 1, archived: true }, users.editor));
      await rejected(403, () => call('/' + project.id, 'PATCH', { revision: 1, members: [] }, users.editor));
      const changed = (await call('/' + project.id, 'PATCH', { revision: 1, progress: 20, ownerId: users.editor.id, canManage: true, members: editor.members }, users.editor)).project;
      assert.equal(changed.ownerId, users.owner.id); assert.equal(changed.canManage, false); assert.equal(changed.progress, 20);
      assert.equal((await call('/' + project.id, 'GET', undefined, users.admin)).project.canManage, true);
      const removed = (await call('/' + project.id, 'PATCH', { revision: changed.revision, members: [{ userId: users.viewer.id, role: 'editor' }] })).project;
      assert.equal(removed.members.length, 1);
      await rejected(404, () => call('/' + project.id, 'GET', undefined, users.editor));
      assert.equal((await call('/' + project.id, 'GET', undefined, users.viewer)).project.canEdit, true);
      await rejected(405, () => call('/' + project.id, 'DELETE'));
      await rejected(404, () => call('/' + project.id + '/members', 'POST', {}));
    });
    await t.test('member validation rolls back changes and revision atomically', async () => {
      const project = await create({ members: shared });
      for (const members of [
        [{ userId: users.inactive.id, role: 'viewer' }], [{ userId: 'missing', role: 'editor' }],
        [{ userId: users.owner.id, role: 'editor' }], [{ userId: users.viewer.id, role: 'admin' }],
        [{ userId: users.viewer.id, role: 'viewer' }, { userId: users.viewer.id, role: 'editor' }],
      ]) await rejected(400, () => call('/' + project.id, 'PATCH', { revision: 1, progress: 80, members }));
      const unchanged = (await call('/' + project.id)).project;
      assert.equal(unchanged.progress, 0); assert.equal(unchanged.revision, 1); assert.equal(unchanged.members.length, 2);
      assert.equal(Number((await db.query("SELECT count(*) FROM audit_log WHERE target_id=$1 AND action<>'project.create'", [project.id])).rows[0].count), 0);
    });
    await t.test('archiving is reversible, restricted and read-only until restored', async () => {
      let project = await create({ members: shared, customer: 'Archive customer' });
      project = (await call('/' + project.id, 'PATCH', { revision: 1, archived: true })).project;
      assert.equal(project.archived, true); assert.equal(project.canEdit, false); assert.equal(project.canManage, true);
      assert.ok(!(await call('?q=Archive')).items.some(item => item.id === project.id));
      assert.ok((await call('?q=Archive&archived=true')).items.some(item => item.id === project.id));
      assert.equal((await call('/' + project.id, 'GET', undefined, users.viewer)).project.archived, true);
      await rejected(403, () => call('/' + project.id, 'PATCH', { revision: 2, description: 'No' }, users.editor));
      await rejected(409, () => call('/' + project.id, 'PATCH', { revision: 2, name: 'No' }));
      project = (await call('/' + project.id, 'PATCH', { revision: 2, archived: false }, users.admin)).project;
      assert.equal(project.archived, false); assert.equal(project.canEdit, true);
      const logs = (await db.query('SELECT action FROM audit_log WHERE target_id=$1 ORDER BY id', [project.id])).rows;
      assert.deepEqual(logs.map(log => log.action), ['project.create', 'project.archive', 'project.restore']);
    });
    await t.test('list filters, compact counters, paging and stats never expose another owner', async () => {
      const before = (await call()).stats;
      const first = await create({ name: 'Filtering Project One', customer: 'Filter Client', stage: 'presale', status: 'active', endDate: '2020-01-01',
        tasks: [{ title: 'Done', status: 'done' }, { title: 'Todo' }], testCases: [{ title: 'Passed', status: 'passed' }] });
      const second = await create({ name: 'Filtering Project Two', stage: 'onsite', status: 'blocked' });
      const secret = await create({ name: 'Filtering Secret', status: 'blocked', endDate: '2020-01-01' }, users.outsider);
      const list = await call('?q=Filtering&limit=1&page=1');
      assert.equal(list.total, 2); assert.equal(list.items.length, 1); assert.equal(list.limit, 1);
      assert.equal((await call('?q=Filtering&limit=1&page=2')).items.length, 1);
      assert.equal((await call('?q=Filtering&limit=1&page=3')).items.length, 0);
      assert.equal(list.stats.total, before.total + 2);
      assert.equal(list.stats.active, before.active + 1);
      assert.equal(list.stats.blocked, before.blocked + 1);
      assert.equal(list.stats.overdue, before.overdue + 1);
      assert.ok(!JSON.stringify(list).includes(secret.id));
      assert.deepEqual((await call('?q=Filtering&stage=onsite&status=blocked')).items.map(item => item.id), [second.id]);
      const summary = (await call('?q=Filtering&stage=presale')).items[0];
      assert.equal(summary.id, first.id); assert.equal(summary.tasksTotal, 2); assert.equal(summary.tasksDone, 1);
      assert.equal(summary.testCasesTotal, 1); assert.equal(summary.testCasesPassed, 1);
      assert.equal(summary.tasks, undefined); assert.equal(summary.testCases, undefined); assert.equal(summary.updates, undefined);
      assert.ok((await call('?q=Filtering', 'GET', undefined, users.admin)).items.some(item => item.id === secret.id));
      assert.equal((await call('?limit=999&page=-8')).limit, 50);
      assert.equal((await call('?limit=999&page=-8')).page, 1);
      assert.equal((await call('?q=%25')).total, 0);
      assert.equal((await call('?q=%27%20OR%20true%20--')).total, 0);
      await rejected(400, () => call('?stage=unknown'));
      await rejected(400, () => call('?archived=all'));
    });
    await t.test('people lookup needs two characters, only matches prefix, hides inactive and limits directory disclosure', async () => {
      assert.deepEqual(await call('/people'), { items: [] });
      assert.deepEqual(await call('/people?q=o'), { items: [] });
      const own = await call('/people?q=ow');
      assert.equal(own.items[0].id, users.owner.id);
      assert.deepEqual(Object.keys(own.items[0]).sort(), ['displayName', 'id', 'username']);
      assert.deepEqual(await call('/people?q=wner'), { items: [] });
      assert.deepEqual(await call('/people?q=disabled'), { items: [] });
      assert.deepEqual(await call('/people?q=%25%25'), { items: [] });
      for (let n = 0; n < 24; n++) await db.query("INSERT INTO users(id,username,display_name,password_hash,role) VALUES($1,$2,$3,'test','member')", ['a'.repeat(24) + String(n).padStart(4, '0'), 'team' + n, 'Team member ' + n]);
      assert.equal((await call('/people?q=team')).items.length, 20);
      await rejected(401, () => call('/people?q=team', 'GET', undefined, null));
      await rejected(405, () => call('/people', 'POST', {}));
    });
    await t.test('strict dates, values, collection bounds and request size reject invalid payloads', async () => {
      for (const body of [
        { name: '' }, { name: 'x'.repeat(181) }, { stage: 'admin' }, { status: 'done' }, { progress: 101 }, { progress: '20' },
        { startDate: '2026-02-30' }, { startDate: '2026-03-01', endDate: '2026-02-01' },
        { poc: { status: 'done' } }, { poc: { startDate: '2026-02-01', endDate: '2026-01-01' } },
        { tasks: [{ id: 'same', title: 'One' }, { id: 'same', title: 'Two' }] },
        { tasks: Array.from({ length: 201 }, () => ({ title: 'Task' })) },
        { testCases: Array.from({ length: 201 }, () => ({ title: 'Test' })) },
        { updates: Array.from({ length: 101 }, () => ({ text: 'Update' })) },
        { tasks: [{ title: 'Task', status: 'complete' }] }, { testCases: [{ title: 'Test', status: 'done' }] },
        { updates: [{ text: 'Update', progress: -1 }] }, { archived: 'true' },
      ]) await rejected(400, () => create(body));
      await rejected(413, () => create({ description: 'x'.repeat(1024 * 1024) }));
    });
    await t.test('removing an account preserves project history and member access', async () => {
      const temporary = { id: 'b'.repeat(28), username: 'temporary', displayName: 'Former owner', role: 'member', active: true };
      await db.query("INSERT INTO users(id,username,display_name,password_hash,role) VALUES($1,$2,$3,'test','member')", [temporary.id, temporary.username, temporary.displayName]);
      const project = await create({ members: [{ userId: users.viewer.id, role: 'viewer' }] }, temporary);
      // Match the existing admin account-removal sequence, retaining audit text.
      await db.query('UPDATE audit_log SET actor_id=NULL WHERE actor_id=$1', [temporary.id]);
      await db.query('DELETE FROM users WHERE id=$1', [temporary.id]);
      const orphan = (await call('/' + project.id, 'GET', undefined, users.admin)).project;
      assert.equal(orphan.ownerId, null); assert.equal(orphan.ownerName, 'Former owner'); assert.equal(orphan.canManage, true);
      assert.equal((await call('/' + project.id, 'GET', undefined, users.viewer)).project.canManage, false);
      await rejected(404, () => call('/' + project.id, 'GET', undefined, users.outsider));
      assert.equal(Number((await db.query('SELECT count(*) FROM audit_log WHERE target_id=$1', [project.id])).rows[0].count), 1);
    });
  } finally { await pg.close(); }
});
