import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { AuthService } from '../application/auth.js';
import { ArchiveService, MAX_AUDIO_BYTES } from '../application/archive.js';
import { AppError, type Repository } from '../domain/ports.js';

const id = z.string().uuid();
const email = z.string().trim().email().max(254);
const title = z.string().trim().min(1).max(200);
const notePatch = z.object({ title: title.optional(), description: z.string().max(5000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).optional(), transcript: z.string().max(100_000).nullable().optional() }).strict();
const documentInput = z.object({ voice_note_id: id, title, content: z.string().max(200_000) }).strict();
const documentPatch = documentInput.omit({ voice_note_id: true }).partial().strict();
const profilePatch = z.object({ full_name: z.string().max(200).nullable().optional(), gender: z.string().max(100).nullable().optional(),
  birthdate: z.string().date().nullable().optional(), avatar_url: z.string().url().max(2000).refine(v => v.startsWith('https://')).nullable().optional() }).strict();

export interface HttpConfig { origins: string[]; secureCookies: boolean; clientKey?: (context: Context) => string }
export function createApp(auth: AuthService, archive: ArchiveService, repo: Repository, config: HttpConfig) {
  const app = new Hono<{ Variables: { userId: string } }>();
  const cookieName = config.secureCookies ? '__Host-va_session' : 'va_session';
  const cookieOptions = { httpOnly: true, secure: config.secureCookies, sameSite: 'Lax' as const, path: '/' };
  // Bounded short-window limits by trusted socket peer; never trust arbitrary forwarded headers.
  // A reverse proxy must additionally enforce per-visitor limits at its edge.
  const budgets = new Map<string, { start: number; count: number }>();
  function limit(key: string, maximum: number) {
    const now = Date.now();
    for (const [k, value] of budgets) if (now - value.start >= 60_000) budgets.delete(k);
    let budget = budgets.get(key);
    if (!budget) {
      if (budgets.size >= 10_000) throw new AppError(429, 'RATE_LIMIT', 'Please try again shortly.');
      budget = { start: now, count: 0 }; budgets.set(key, budget);
    }
    if (++budget.count > maximum) throw new AppError(429, 'RATE_LIMIT', 'Please try again shortly.');
  }
  app.use('/api/*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'no-referrer');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
      const origin = c.req.header('Origin');
      if (!origin || !config.origins.includes(origin)) return c.json({ error: { code: 'ORIGIN_DENIED', message: 'Request origin is not allowed.' } }, 403);
    }
    await next();
  });
  app.use('/api/*', cors({ origin: origin => config.origins.includes(origin) ? origin : undefined,
    credentials: true, allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowHeaders: ['Content-Type'], maxAge: 600 }));
  app.use('/api/*', bodyLimit({ maxSize: MAX_AUDIO_BYTES + 64 * 1024,
    onError: c => c.json({ error: { code: 'BODY_TOO_LARGE', message: 'Request is too large.' } }, 413) }));
  app.onError((error, c) => {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return c.json({ error: { code: 'INVALID_REQUEST', message: 'Check the request fields.' } }, 400);
    if (error instanceof AppError) return c.json({ error: { code: error.code, message: error.message } }, error.status as 400);
    if (error instanceof HTTPException) return c.json({ error: { code: 'INVALID_REQUEST', message: 'Request could not be processed.' } }, error.status);
    // Do not log provider payloads, links, session tokens, audio or transcript content.
    console.error('API operation failed', error instanceof Error ? error.name : 'UnknownError');
    return c.json({ error: { code: 'UNAVAILABLE', message: 'Service temporarily unavailable.' } }, 503);
  });
  app.notFound(c => c.json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } }, 404));
  app.get('/api/health', async c => { await repo.health(); return c.json({ ok: true }); });
  app.post('/api/auth/magic-link', async c => {
    const body = z.object({ email }).strict().parse(await c.req.json());
    limit(`login:${config.clientKey?.(c) ?? 'local-test'}`, 30);
    await auth.requestLink(body.email);
    return c.json({ ok: true }, 202);
  });
  app.post('/api/auth/verify', async c => {
    const body = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict().parse(await c.req.json());
    const result = await auth.verify(body.token);
    setCookie(c, cookieName, result.session, { ...cookieOptions, maxAge: 30 * 86400 });
    return c.json({ user: result.user });
  });
  app.get('/api/auth/session', async c => c.json(await auth.session(getCookie(c, cookieName))));
  app.post('/api/auth/logout', async c => { await auth.logout(getCookie(c, cookieName)); deleteCookie(c, cookieName, cookieOptions); return c.body(null, 204); });
  app.use('/api/*', async (c, next) => {
    const session = await auth.session(getCookie(c, cookieName));
    if (!session) throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
    c.set('userId', session.user.id);
    await next();
  });
  const pathId = (value: string | undefined) => id.parse(value);
  app.get('/api/profile', async c => c.json(await archive.profile(c.get('userId'))));
  app.patch('/api/profile', async c => c.json(await archive.updateProfile(c.get('userId'), profilePatch.parse(await c.req.json()))));
  app.get('/api/voice-notes', async c => c.json(await archive.list(c.get('userId'))));
  app.post('/api/voice-notes', async c => {
    const data = await c.req.formData();
    for (const key of data.keys()) if (!['audio', 'title', 'duration'].includes(key) || data.getAll(key).length !== 1) throw new AppError(400, 'INVALID_REQUEST', 'Unexpected upload field.');
    const audio = data.get('audio');
    if (!(audio instanceof File)) throw new AppError(400, 'MISSING_AUDIO', 'Choose an audio file.');
    return c.json(await archive.upload(c.get('userId'), new Uint8Array(await audio.arrayBuffer()), audio.type,
      title.parse(data.get('title')), z.coerce.number().finite().min(0).max(86400).parse(data.get('duration') ?? 0)), 201);
  });
  app.get('/api/voice-notes/:id', async c => c.json(await archive.get(c.get('userId'), pathId(c.req.param('id')))));
  app.patch('/api/voice-notes/:id', async c => c.json(await archive.update(c.get('userId'), pathId(c.req.param('id')), notePatch.parse(await c.req.json()))));
  app.delete('/api/voice-notes/:id', async c => { await archive.remove(c.get('userId'), pathId(c.req.param('id'))); return c.body(null, 204); });
  app.get('/api/voice-notes/:id/audio', async c => {
    const audio = await archive.audio(c.get('userId'), pathId(c.req.param('id')));
    c.header('Content-Type', audio.contentType);
    c.header('Accept-Ranges', 'bytes');
    c.header('Content-Disposition', 'inline');
    const length = audio.bytes.length;
    const range = c.req.header('Range');
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      let start = 0, end = length - 1;
      if (!match || (!match[1] && !match[2])) { c.header('Content-Range', `bytes */${length}`); return c.body(null, 416); }
      if (!match[1]) start = Math.max(0, length - Number(match[2]));
      else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
      if (start > end || start >= length) { c.header('Content-Range', `bytes */${length}`); return c.body(null, 416); }
      c.header('Content-Range', `bytes ${start}-${end}/${length}`);
      return c.body(Buffer.from(audio.bytes.slice(start, end + 1)), 206);
    }
    return c.body(Buffer.from(audio.bytes));
  });
  app.post('/api/voice-notes/:id/transcribe', async c => { limit(`ai:${c.get('userId')}`, 5); return c.json(await archive.transcribe(c.get('userId'), pathId(c.req.param('id')))); });
  app.post('/api/voice-notes/:id/summary', async c => { limit(`ai:${c.get('userId')}`, 5); return c.json(await archive.summary(c.get('userId'), pathId(c.req.param('id')))); });
  app.get('/api/voice-notes/:id/document', async c => c.json(await archive.noteDocument(c.get('userId'), pathId(c.req.param('id')))));
  app.get('/api/documents/:id', async c => c.json(await archive.document(c.get('userId'), pathId(c.req.param('id')))));
  app.post('/api/documents', async c => c.json(await archive.saveDocument(c.get('userId'), documentInput.parse(await c.req.json())), 201));
  app.patch('/api/documents/:id', async c => c.json(await archive.updateDocument(c.get('userId'), pathId(c.req.param('id')), documentPatch.parse(await c.req.json()))));
  app.get('/api/documents/:id/markdown', async c => {
    const doc = await archive.markdown(c.get('userId'), pathId(c.req.param('id')));
    c.header('Content-Type', 'text/markdown; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="document.md"`);
    return c.body(doc.markdown);
  });
  app.post('/api/documents/:id/email', async c => {
    const body = z.object({ to: email }).strict().parse(await c.req.json());
    limit(`email:${c.get('userId')}`, 5);
    await archive.email(c.get('userId'), pathId(c.req.param('id')), body.to);
    return c.json({ ok: true });
  });
  return app;
}
