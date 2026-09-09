import { randomBytes, createHash } from 'node:crypto';
import { serve } from '@hono/node-server';
import { getConnInfo } from '@hono/node-server/conninfo';
import { z } from 'zod';
import { AuthService } from './application/auth.js';
import { ArchiveService } from './application/archive.js';
import { createApp } from './http/app.js';
import { PostgresRepository } from './adapters/postgres.js';
import { S3ObjectStore } from './adapters/s3.js';
import { OpenAIIntelligence } from './adapters/openai.js';
import { DevelopmentMailer, ResendMailer } from './adapters/mailer.js';

const env = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().min(1), WEB_URL: z.string().url(), ALLOWED_ORIGINS: z.string().min(1),
  S3_ENDPOINT: z.string().url().optional(), S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().min(1), S3_ACCESS_KEY_ID: z.string().min(1), S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('false'),
  OPENAI_API_KEY: z.string().optional(), RESEND_API_KEY: z.string().optional(), MAIL_FROM: z.string().optional(),
  MAIL_MODE: z.enum(['resend', 'development']).default('resend'),
  DEV_MAIL_DIRECTORY: z.string().default('/tmp/voice-archive-mail'),
  DOCUMENT_EMAIL_ENABLED: z.enum(['true', 'false']).default('false'),
}).parse(process.env);
const web = new URL(env.WEB_URL);
if (web.pathname !== '/' || web.search || web.hash || web.username || web.password) throw new Error('WEB_URL must be an origin');
const origins = env.ALLOWED_ORIGINS.split(',').map(s => s.trim());
if (origins.some(origin => new URL(origin).origin !== origin) || !origins.includes(web.origin)) throw new Error('Configure exact allowed origins including WEB_URL');
if (env.NODE_ENV === 'production' && (web.protocol !== 'https:' || origins.some(o => !o.startsWith('https://')) || env.MAIL_MODE !== 'resend')) throw new Error('Production requires HTTPS origins and verified email delivery');
if (env.MAIL_MODE === 'resend' && (!env.RESEND_API_KEY || !env.MAIL_FROM)) throw new Error('Resend key and verified MAIL_FROM required');
const repository = new PostgresRepository(env.DATABASE_URL);
await repository.migrate();
const mailer = env.MAIL_MODE === 'development' ? new DevelopmentMailer(env.DEV_MAIL_DIRECTORY) : new ResendMailer({ apiKey: env.RESEND_API_KEY!, from: env.MAIL_FROM! });
const storage = new S3ObjectStore({ endpoint: env.S3_ENDPOINT, region: env.S3_REGION, bucket: env.S3_BUCKET,
  accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY, forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true' });
const intelligence = new OpenAIIntelligence({ apiKey: env.OPENAI_API_KEY ?? '' });
const now = () => new Date();
const auth = new AuthService(repository, mailer, { create: () => randomBytes(32).toString('base64url'), hash: value => createHash('sha256').update(value).digest('hex') }, now, web.origin);
const archive = new ArchiveService({ repository, storage, intelligence, mailer, now }, env.DOCUMENT_EMAIL_ENABLED === 'true');
const app = createApp(auth, archive, repository, { origins, secureCookies: env.NODE_ENV === 'production', clientKey: c => getConnInfo(c).remote.address ?? 'unknown-peer' });
const server = serve({ fetch: app.fetch, port: env.PORT });
// A single API process retries its durable deletion outbox; no separate worker service.
let cleaning = false;
const cleanup = setInterval(async () => {
  if (cleaning) return;
  cleaning = true;
  try { await archive.cleanup(); } catch { console.error('Storage cleanup pending'); } finally { cleaning = false; }
}, 60_000);
cleanup.unref();
console.log(`Voice Archive API listening on port ${env.PORT}`);
let stopping = false;
const shutdown = () => {
  if (stopping) return;
  stopping = true;
  clearInterval(cleanup);
  server.close(async () => { await repository.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
