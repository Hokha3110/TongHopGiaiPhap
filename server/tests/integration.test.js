import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

test('PostgreSQL library and API integration', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'tonghop-admin-test-'));
  process.env.SOLUTIONS_ROOT = path.join(root,'Solutions');
  process.env.UPLOADS_ROOT = path.join(root,'uploads');
  process.env.NODE_ENV = 'test';
  process.env.COOKIE_SECURE = 'false';
  await mkdir(path.join(process.env.SOLUTIONS_ROOT,'02. Picus'),{recursive:true});
  await writeFile(path.join(process.env.SOLUTIONS_ROOT,'02. Picus','sample.pdf'),'%PDF-1.7 imported');
  const pg = new PGlite();
  const db = { query: async (sql, params) => {
    if (sql.includes('CREATE TABLE')) { const result=await pg.exec(sql); return result.at(-1); }
    const result=await pg.query(sql, params); return {...result,rowCount:result.affectedRows || result.rows.length};
  }, connect: async () => ({query:db.query,release:()=>{}}) };
  const { migrate } = await import('../db.js');
  const { id,hashPassword } = await import('../security.js');
  const { seedEntries,importSolutions } = await import('../library.js');
  const { createApi } = await import('../index.js');
  await migrate(db); await seedEntries(db);
  const adminId=id();
  await db.query("INSERT INTO users(id,username,display_name,password_hash,role) VALUES($1,'admin','Admin',$2,'admin')",[adminId,await hashPassword('Admin-test-password!')]);
  const server=createApi(db);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  async function call(url,method='GET',body,cookie,origin='http://localhost:5173') {
    const res=await fetch(base+'/api/'+url,{method,headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(body && !(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});
    const content=res.headers.get('content-type')?.includes('application/json')?await res.json():await res.text();
    return {status:res.status,body:content,cookie:res.headers.get('set-cookie')?.split(';')[0],headers:res.headers};
  }
  let adminCookie, memberCookie, editorCookie, memberId, entryId, docId;
  try {
    await t.test('login, persistent hashed sessions and anonymous access',async()=>{
      assert.equal((await call('catalog')).status,401);
      assert.equal((await call('auth/login','POST',{username:'admin',password:'bad'})).status,401);
      const result=await call('auth/login','POST',{username:'admin',password:'Admin-test-password!'});
      assert.equal(result.status,200);adminCookie=result.cookie;
      assert.equal(result.body.user.role,'admin');assert.ok(result.headers.get('set-cookie').includes('HttpOnly'));
      assert.equal((await call('auth/session','GET',null,adminCookie)).body.user.id,adminId);
      const stored=(await db.query('SELECT token_hash FROM sessions')).rows[0].token_hash;
      assert.ok(!adminCookie.includes(stored));
      assert.equal((await call('admin/overview','GET',null,adminCookie)).status,200);
    });
    await t.test('CORS rejects cross-site writes and allows PATCH preflight',async()=>{
      assert.equal((await call('admin/users','POST',{},adminCookie,'https://evil.example')).status,403);
      const response=await call('admin/users','OPTIONS',null,adminCookie);
      assert.equal(response.status,204);assert.match(response.headers.get('access-control-allow-methods'),/PATCH/);
    });
    await t.test('create roles and enforce server-side permissions',async()=>{
      for(const role of ['member','editor']) {
        const r=await call('admin/users','POST',{username:role,displayName:role,role,active:true,password:'Member-test-password!'},adminCookie);
        assert.equal(r.status,200);if(role==='member')memberId=r.body.id;
        const logged=await call('auth/login','POST',{username:role,password:'Member-test-password!'});
        if(role==='member')memberCookie=logged.cookie;else editorCookie=logged.cookie;
      }
      assert.equal((await call('admin/entries','GET',null,memberCookie)).status,403);
      assert.equal((await call('admin/users','GET',null,editorCookie)).status,403);
      assert.equal((await call('admin/entries','GET',null,editorCookie)).status,200);
      assert.equal((await call(`admin/users/${adminId}`,'PATCH',{username:'admin',displayName:'Admin',role:'member',active:true},adminCookie)).status,400);
    });
    await t.test('draft editing preserves published snapshot and rejects stale saves',async()=>{
      const data={name:'New solution',kind:'solution',group:'soc',desc:'Published description',tags:['SIEM'],body:'## Intro\n\nBody',logoUrl:'',publish:true};
      const created=await call('admin/entries','POST',data,editorCookie);assert.equal(created.status,200);entryId=created.body.id;
      assert.ok((await call('catalog','GET',null,memberCookie)).body.entries.some(e=>e.id===entryId));
      assert.equal((await call(`admin/entries/${entryId}`,'PUT',{...data,desc:'Draft only',publish:false,revision:1},editorCookie)).status,200);
      assert.equal((await call('catalog','GET',null,memberCookie)).body.entries.find(e=>e.id===entryId).desc,'Published description');
      assert.equal((await call(`admin/entries/${entryId}`,'PUT',{...data,revision:1},editorCookie)).status,409);
      assert.equal((await call(`admin/entries/${entryId}/unpublish`,'POST',{revision:2},editorCookie)).status,200);
      assert.ok(!(await call('catalog','GET',null,memberCookie)).body.entries.some(e=>e.id===entryId));
      assert.equal((await call(`admin/entries/${entryId}`,'PUT',{...data,revision:3,publish:true},editorCookie)).status,200);
    });
    await t.test('idempotent import and existing Solutions files remain in place',async()=>{
      assert.equal((await importSolutions(db)).imported,1);assert.equal((await importSolutions(db)).imported,0);
      const docs=(await call('documents?entryId=02-picus','GET',null,memberCookie)).body.documents;
      assert.equal(docs.length,1);docId=docs[0].id;
      assert.equal((await call('files/'+docId,'GET',null,memberCookie)).body,'%PDF-1.7 imported');
      assert.equal((await call(`admin/documents/${docId}/trash`,'POST',{},editorCookie)).status,200);
      await importSolutions(db);
      assert.equal((await call('files/'+docId,'GET',null,memberCookie)).status,404);
      assert.equal(await readFile(path.join(process.env.SOLUTIONS_ROOT,'02. Picus','sample.pdf'),'utf8'),'%PDF-1.7 imported');
      await call(`admin/documents/${docId}/restore`,'POST',{},editorCookie);
    });
    await t.test('upload, replace and restore earlier version; disallow executable files',async()=>{
      let form=new FormData();form.append('file',new Blob(['%PDF-1.7 uploaded']),'new.pdf');
      const uploaded=await call(`admin/documents?entryId=${entryId}`,'POST',form,editorCookie);
      assert.equal(uploaded.status,200,JSON.stringify(uploaded.body));
      const fileId=uploaded.body.id;
      assert.equal((await call('files/'+fileId,'GET',null,memberCookie)).body,'%PDF-1.7 uploaded');
      form=new FormData();form.append('file',new Blob(['version 2']),'next.pdf');
      assert.equal((await call(`admin/documents/${fileId}/upload`,'POST',form,editorCookie)).status,200);
      const versions=(await call(`admin/documents/${fileId}/versions`,'GET',null,editorCookie)).body.items;
      assert.equal(versions.length,2);
      assert.equal((await call(`admin/documents/${fileId}/version`,'POST',{version:versions[1].id},editorCookie)).status,200);
      assert.equal((await call('files/'+fileId,'GET',null,memberCookie)).body,'%PDF-1.7 uploaded');
      form=new FormData();form.append('file',new Blob(['<script>alert(1)</script>']),'bad.html');
      assert.equal((await call(`admin/documents?entryId=${entryId}`,'POST',form,editorCookie)).status,400);
      form=new FormData();form.append('file',new Blob(['one']),'one.pdf');form.append('file',new Blob(['two']),'two.pdf');
      assert.equal((await call(`admin/documents?entryId=${entryId}`,'POST',form,editorCookie)).status,400);
      const trash=await call(`admin/entries/${entryId}/trash`,'POST',{revision:4},editorCookie);assert.equal(trash.status,200);
      assert.equal((await call('files/'+fileId,'GET',null,memberCookie)).status,404);
      await call(`admin/entries/${entryId}/restore`,'POST',{revision:5},editorCookie);
      assert.equal((await call('files/'+fileId,'GET',null,memberCookie)).status,200);
    });
    await t.test('password reset and account lock invalidate existing sessions',async()=>{
      let r=await call(`admin/users/${memberId}`,'PATCH',{username:'member',displayName:'Member',role:'member',active:true,password:'Reset-password-test!'},adminCookie);
      assert.equal(r.status,200);
      assert.equal((await call('catalog','GET',null,memberCookie)).status,401);
      assert.equal((await call('auth/login','POST',{username:'member',password:'Member-test-password!'})).status,401);
      r=await call('auth/login','POST',{username:'member',password:'Reset-password-test!'});assert.equal(r.status,200);memberCookie=r.cookie;
      await call(`admin/users/${memberId}`,'PATCH',{username:'member',displayName:'Member',role:'member',active:false},adminCookie);
      assert.equal((await call('catalog','GET',null,memberCookie)).status,401);
      assert.equal((await call('auth/login','POST',{username:'member',password:'Reset-password-test!'})).status,401);
      const logs=(await call('admin/audit','GET',null,adminCookie)).body.items;
      assert.ok(logs.some(l=>l.action==='document.replace'));
      assert.ok(!JSON.stringify(logs).includes('Reset-password-test!'));
    });
    await t.test('session remains usable through a new API instance',async()=>{
      const second=createApi(db);await new Promise(resolve=>second.listen(0,'127.0.0.1',resolve));
      try { const res=await fetch(`http://127.0.0.1:${second.address().port}/api/auth/session`,{headers:{Cookie:adminCookie}});assert.equal((await res.json()).user.id,adminId); }
      finally { second.closeAllConnections();await new Promise(resolve=>second.close(resolve)); }
    });
    await t.test('login throttling, duplicate users and invalid content validation',async()=>{
      for(let i=0;i<10;i++) assert.equal((await call('auth/login','POST',{username:'missing',password:'bad'})).status,401);
      assert.equal((await call('auth/login','POST',{username:'missing',password:'bad'})).status,429);
      assert.equal((await call('admin/users','POST',{username:'admin',displayName:'Duplicate',role:'admin',active:true,password:'Another-password!'},adminCookie)).status,409);
      assert.equal((await call('admin/entries','POST',{name:'Bad image',kind:'solution',group:'soc',desc:'test',tags:[],body:'text',logoUrl:'javascript:alert(1)'},adminCookie)).status,400);
      const anonymous=await call('auth/session');assert.equal(anonymous.body.authenticated,false);
    });
  } finally {
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await pg.close();await rm(root,{recursive:true,force:true});
  }
});
