import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { createApp } from '../src/http/app.js';
import { AuthService } from '../src/application/auth.js';
import { ArchiveService } from '../src/application/archive.js';
import { PostgresRepository } from '../src/adapters/postgres.js';
import type { Mailer, ObjectStore, Intelligence } from '../src/domain/ports.js';

test('HTTP lifecycle, ownership, validation, cookie security, replay and storage cleanup', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const repository = new PostgresRepository(process.env.TEST_DATABASE_URL!);
  await repository.migrate();
  const objects = new Map<string, {bytes: Uint8Array; contentType: string}>();
  const links: string[] = [];
  let failDelete = false;
  const storage: ObjectStore = {
    async put(key, bytes, contentType) { objects.set(key, {bytes,contentType}); },
    async get(key) { assert.ok(objects.has(key)); return objects.get(key)!; },
    async delete(key) { if (failDelete) throw new Error('storage offline'); objects.delete(key); },
  };
  const mailer: Mailer = { async sendLink(_email, url) { links.push(url); }, async sendDocument() {} };
  const intelligence: Intelligence = { async transcribe() { return 'Remember the contract.'; }, async summarize() { return '## Summary\n\nRemember the contract.'; } };
  const clock = () => new Date();
  const auth = new AuthService(repository, mailer, {create: () => randomBytes(32).toString('base64url'), hash: s => createHash('sha256').update(s).digest('hex')}, clock, 'https://archive.example');
  const archive = new ArchiveService({repository,storage,mailer,intelligence,now:clock}, false);
  const app = createApp(auth,archive,repository,{origins:['https://archive.example'],secureCookies:true});
  const req = (path: string, method = 'GET', body?: object | FormData, cookie?: string, extra: Record<string,string> = {}) => app.request(`/api${path}`, {
    method, headers: {Origin:'https://archive.example',...(cookie ? {Cookie:cookie}:{}),...(body && !(body instanceof FormData) ? {'Content-Type':'application/json'}:{}),...extra},
    ...(body ? {body: body instanceof FormData ? body : JSON.stringify(body)} : {})
  });
  async function login() {
    const email = `${randomUUID()}@example.test`;
    assert.equal((await req('/auth/magic-link','POST',{email})).status,202);
    const count = links.length;
    assert.equal((await req('/auth/magic-link','POST',{email})).status,202);
    assert.equal(links.length,count,'duplicate request must not send another link');
    const token = new URL(links.at(-1)!).hash.slice('#token='.length);
    const response = await req('/auth/verify','POST',{token});
    assert.equal(response.status,200);
    const cookie = response.headers.get('set-cookie')!;
    assert.match(cookie,/__Host-va_session=/);
    assert.match(cookie,/HttpOnly/); assert.match(cookie,/Secure/); assert.match(cookie,/SameSite=Lax/); assert.doesNotMatch(cookie,/Domain=/);
    assert.equal((await req('/auth/verify','POST',{token})).status,400,'link cannot be reused');
    return cookie.split(';')[0];
  }
  try {
    assert.equal((await req('/health')).status,200);
    assert.equal((await req('/voice-notes')).status,401);
    assert.equal((await app.request('/api/auth/magic-link',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"email":"a@example.test"}'})).status,403);
    assert.equal((await req('/auth/magic-link','POST',{email:'invalid'})).status,400);
    const owner = await login(), other = await login();
    assert.equal((await req('/voice-notes','GET',undefined,owner)).headers.get('cache-control'),'no-store');
    const upload = new FormData(); upload.set('audio',new File([new Uint8Array([1,2,3,4,5])],'sample.webm',{type:'audio/webm'})); upload.set('title','A note');
    const response = await req('/voice-notes','POST',upload,owner); assert.equal(response.status,201);
    const note = await response.json(); assert.equal(note.title,'A note'); assert.ok(note.audio_url); assert.equal(note.audio_key,undefined);
    for (const suffix of ['', '/audio', '/document']) assert.equal((await req(`/voice-notes/${note.id}${suffix}`,'GET',undefined,other)).status,404);
    assert.equal((await req(`/voice-notes/${note.id}`,'PATCH',{user_id:'attacker'},owner)).status,400);
    assert.equal((await req(`/voice-notes/${note.id}`,'PATCH',{title:'owned'},other)).status,404);
    assert.equal((await req('/documents','POST',{voice_note_id:note.id,title:'stolen',content:'no'},other)).status,404);
    const range = await req(`/voice-notes/${note.id}/audio`,'GET',undefined,owner,{Range:'bytes=1-3'});
    assert.equal(range.status,206); assert.deepEqual([...new Uint8Array(await range.arrayBuffer())],[2,3,4]);
    assert.equal((await req(`/voice-notes/${note.id}/audio`,'GET',undefined,owner,{Range:'bytes=20-30'})).status,416);
    assert.equal((await req(`/voice-notes/${note.id}/summary`,'POST',undefined,owner)).status,400);
    assert.equal((await req(`/voice-notes/${note.id}/transcribe`,'POST',undefined,owner)).status,200);
    const docResponse = await req(`/voice-notes/${note.id}/summary`,'POST',undefined,owner); assert.equal(docResponse.status,200);
    const doc = await docResponse.json(); assert.match(doc.content,/Summary/);
    assert.equal((await req(`/documents/${doc.id}`,'GET',undefined,other)).status,404);
    assert.equal((await req(`/documents/${doc.id}/markdown`,'GET',undefined,other)).status,404);
    assert.equal((await req(`/documents/${doc.id}/email`,'POST',{to:'reader@example.test'},owner)).status,503);
    assert.equal((await req(`/documents/${doc.id}`,'PATCH',{content:'Edited'},owner)).status,200);
    assert.match(await (await req(`/documents/${doc.id}/markdown`,'GET',undefined,owner)).text(),/Edited/);
    assert.equal((await req('/profile','PATCH',{full_name:'Test person'},owner)).status,200);
    failDelete = true;
    assert.equal((await req(`/voice-notes/${note.id}`,'DELETE',undefined,owner)).status,204);
    assert.equal(objects.size,1,'failed storage delete must remain for retry');
    assert.equal((await req(`/documents/${doc.id}`,'GET',undefined,owner)).status,404);
    failDelete = false; await archive.cleanup(); assert.equal(objects.size,0);
    assert.equal((await req('/auth/logout','POST',undefined,owner)).status,204);
    assert.equal((await req('/auth/session','GET',undefined,owner)).status,200);
    assert.equal(await (await req('/auth/session','GET',undefined,owner)).json(),null);
    assert.equal((await req('/voice-notes','GET',undefined,owner)).status,401);
  } finally { await repository.close(); }
});
