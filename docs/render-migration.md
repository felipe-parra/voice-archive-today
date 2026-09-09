# Migrating `voice-archive-today` off Supabase to a containerized backend on Render

> **Status:** PLAN ONLY — not yet implemented. Tracked for a later cycle.
> **Author:** Constanza swarm (recon + architecture agents), 2026-09-09.
> **Context:** The Supabase project (`fdqgvjgcoidqwvemavaa`) is down. The frontend is a static
> Vite SPA on Vercel and can stay there. The goal is an *easy to operate, controlled* backend:
> a single container on Render, managed Postgres, and S3-compatible object storage.

---

## 1. Current backend surface (the entire migration scope)

### 1.1 Client

`src/integrations/supabase/client.ts` — Supabase URL and the **anon JWT are hardcoded and
committed to this public repo**. No `import.meta.env.*` anywhere. Treat that key as burned;
rotation is tracked separately.

### 1.2 Database (`src/integrations/supabase/types.ts` — there is **no `supabase/migrations/`**, so this generated type file plus the live-but-down project are the only schema record)

| Table | Columns | Notes |
|---|---|---|
| `voice_notes` | `id` uuid, `user_id` uuid, `title`, `description`, `audio_url`, `duration` int, `tags` text[], `transcript`, `created_at` | Core entity. `duration` is always inserted as `0`. |
| `documents` | `id` uuid, `user_id` uuid, `voice_note_id` fk→voice_notes, `title`, `content`, `markdown_url`, `created_at`, `updated_at` | Markdown doc generated from a note. |
| `transcripts` | `id`, `user_id`, `voice_note_id` fk, `text_content`, `created_at`, `updated_at` | **Defined but unused by the frontend** — the app reads/writes `voice_notes.transcript` directly. Candidate to drop. |
| `profiles` | `id` uuid (= auth user id), `full_name`, `gender`, `birthdate` date, `avatar_url`, `updated_at` | 1:1 with the auth user. A signup trigger creates the row (the frontend never inserts it). |

**RLS:** not in the repo. The frontend depends on it — `VoiceNote.tsx` runs
`supabase.from('voice_notes').select('*').order('created_at')` with **no `user_id` filter**;
`documents` inserts never set `user_id`. The replacement API must enforce
`where user_id = session.userId` on every read and set `user_id` from the session on every insert.

### 1.3 Storage (both buckets used with `getPublicUrl` → public, no signed URLs today)

- `voice_notes` — audio blobs. Keys: `${userId}/recording-${Date.now()}.webm` (`RecordingControls.tsx`), `${userId}/upload-${Date.now()}.${ext}` (`AudioFileUpload.tsx`).
- `markdown_files` — keys `${userId}/${voiceNoteId}/${title}.md`, `upsert: true` (`DocumentEditor.tsx`).

### 1.4 Edge Functions (`supabase/functions/`, Deno)

| Function | Trigger / body | External calls | Secrets | DB writes |
|---|---|---|---|---|
| `create-transcript` (`verify_jwt = true`) | `{ voiceNoteId }` | Storage download (service role) → OpenAI **Whisper `whisper-1`** | `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `voice_notes.transcript` |
| `transcribe-audio` | `{ audioUrl, voiceNoteId }` | `fetch(audioUrl)` → OpenAI Whisper | same | `voice_notes.transcript` |
| `summarize-transcript` | `{ transcript }` | OpenAI **chat `gpt-4o-mini`** | `OPENAI_API_KEY` | none — returns `{ summary }` |
| `send-markdown-email` | `{ documentId, to, from }` | **Resend** `notifications@xilo.pro` | `RESEND_API_KEY`, service role | none (reads `documents`) |

`create-transcript` and `transcribe-audio` are duplicates — **collapse into one route**.

### 1.5 Auth

`@supabase/auth-ui-react` `<Auth>` widget on `Login.tsx` / `Register.tsx`, **`providers={[]}`**
(email/password only — Google OAuth is not wired in the client today). Session checks via
`supabase.auth.getSession()` / `getUser()` / `onAuthStateChange()` across `Index`, `Account`,
`VoiceNoteDetail`, `VoiceNote`, `Login`, `Register`; `signOut()` in `Index` / `Login`.
`Login.tsx` also hand-stashes `session.access_token` in `localStorage` (dead code).
`@supabase/auth-helpers-react` is a dependency but imported nowhere.

**No realtime, no `.channel()`, no `.rpc()`.**

### 1.6 Call-site inventory (everything that changes)

| File | Supabase calls |
|---|---|
| `src/integrations/supabase/client.ts` | client init (delete) |
| `src/pages/Login.tsx` | `<Auth>`, `getSession`, `signOut`, `onAuthStateChange` |
| `src/pages/Register.tsx` | `<Auth>`, `getSession`, `onAuthStateChange` |
| `src/pages/Index.tsx` | `getSession`, `onAuthStateChange`, `signOut` |
| `src/pages/Account.tsx` | `getSession`, `from('profiles').select().eq('id')`, `onAuthStateChange` |
| `src/pages/VoiceNoteDetail.tsx` | `getSession` |
| `src/hooks/useVoiceNoteData.ts` | `voice_notes` by id, `documents` by `voice_note_id` |
| `src/components/VoiceNote.tsx` | `getSession`, `voice_notes` list |
| `src/components/RecordingControls.tsx` | `getUser`, Storage `voice_notes` upload + `getPublicUrl`, `voice_notes` insert |
| `src/components/AudioFileUpload.tsx` | `getUser`, Storage `voice_notes` upload + `getPublicUrl`, `voice_notes` insert |
| `src/components/EditVoiceNoteForm.tsx` | `voice_notes` update |
| `src/components/VoiceNoteList.tsx` | `voice_notes` delete, `functions.invoke('transcribe-audio')`, plays `audio_url` |
| `src/components/ProfileForm.tsx` | `getSession`, `profiles` update |
| `src/components/DocumentEditor.tsx` | `documents` select×3, `getUser`, Storage `markdown_files` upload + `getPublicUrl`, `documents` insert/update |
| `src/components/voice-note/TranscriptDisplay.tsx` | `functions.invoke('create-transcript')` |
| `src/components/voice-note/SummarizeButton.tsx` | `functions.invoke('summarize-transcript')`, `documents` insert/update |
| `src/components/voice-note/DocumentActions.tsx` | `getUser`, `functions.invoke('send-markdown-email')`, fetches `markdownUrl` |
| `src/components/voice-note/AudioPlayer.tsx` | none directly (receives `audioUrl` prop) |

---

## 2. Target architecture on Render

```
                         ┌────────────────────────────────────────┐
  Vercel (unchanged)     │  Render                                 │
  ┌───────────────┐      │  ┌──────────────────────────────┐       │
  │ Vite SPA      │─────▶│  │ Web Service (Docker)         │       │
  │ app.<domain>  │ HTTPS│  │ Node 20 + Hono API           │       │
  └───────────────┘ CORS │  │ api.<domain>  /api/*         │       │
                         │  └──────┬───────────────┬───────┘       │
                         │         │               │               │
                         │  ┌──────▼──────┐   ┌────▼──────────┐    │
                         │  │ Render      │   │ OpenAI, Resend│    │
                         │  │ PostgreSQL  │   └───────────────┘    │
                         │  │ (managed)   │                        │
                         │  └─────────────┘                        │
                         └────────────────────────────────────────┘
                                   │
                          ┌────────▼─────────┐
                          │ Cloudflare R2    │  audio + markdown (S3-compatible)
                          └──────────────────┘
```

**Decision: 1 Render web service (Docker) + Render Managed PostgreSQL + Cloudflare R2.**
No object storage on Render disks, no Postgres-in-a-container, no separate worker for v1.

| Piece | Choice | Why |
|---|---|---|
| API | **One Docker web service** running Hono | Replaces the 4 edge functions *and* direct browser→DB/Storage access with one deployable unit — one thing to build, log, roll back. Docker (not Render native Node) because the Founder asked for "containerized", local == prod, and it stays portable. |
| Database | **Render Managed PostgreSQL** (~$6/mo Basic) | Automated daily backups, 7-day retention, zero operator effort. Postgres-in-a-container means you own `pg_dump` cron and restore drills. |
| Object storage | **Cloudflare R2** (free ≤10 GB, **$0 egress**, S3-compatible) | Render Disks pin the service to a single instance and aren't CDN-backed. Audio playback bandwidth never touches — or bills — the container. Backblaze B2 is an equivalent alternative. |
| Background worker | **None for v1** | Transcription (Whisper) is the only slow task; run it synchronously with a generous timeout. Add a worker + `jobs` table only if UX demands it. |

---

## 3. API layer

**Framework: Hono** (`@hono/node-server`) — smallest surface with first-class TS types,
middleware (CORS, cookies, logger, error boundary), trivial to containerize, handlers are plain
testable functions. Fastify/Express are heavier for an API this small.

Supporting libs: `zod` (already a frontend dep — share it), `drizzle-orm` + `drizzle-kit`,
`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, `arctic` + `@oslojs/*` (auth/sessions),
`@node-rs/argon2` + `bcryptjs` (verify imported Supabase hashes), `resend`, `openai`.

### Route list (1:1 from current usage) — all under `/api`, all but `auth/*` + `health` require a session cookie, all data routes scoped to `session.userId`

**Auth** — replaces `supabase.auth.*` + the `<Auth>` widget
| Method | Path | Replaces |
|---|---|---|
| POST | `/api/auth/register` | `<Auth>` sign_up — sets cookie, creates `profiles` row |
| POST | `/api/auth/login` | `<Auth>` sign_in |
| POST | `/api/auth/logout` | `signOut()` |
| GET | `/api/auth/session` | `getSession()` / `getUser()` |
| GET | `/api/auth/google` + `/callback` | *(only if Google login is actually wanted)* |

**Profile** — `GET /api/profile`, `PATCH /api/profile`

**Voice notes**
| Method | Path | Replaces |
|---|---|---|
| GET | `/api/voice-notes` | `VoiceNote.tsx` list |
| GET | `/api/voice-notes/:id` | `useVoiceNoteData` |
| POST | `/api/voice-notes` | `RecordingControls` / `AudioFileUpload` — `multipart/form-data`, uploads to R2 |
| PATCH | `/api/voice-notes/:id` | `EditVoiceNoteForm` |
| DELETE | `/api/voice-notes/:id` | `VoiceNoteList` — also deletes R2 audio + child documents |
| GET | `/api/voice-notes/:id/audio` | `302` → short-lived R2 presigned GET URL |
| POST | `/api/voice-notes/:id/transcribe` | `create-transcript` + `transcribe-audio` (merged) |
| POST | `/api/voice-notes/:id/summary` | `summarize-transcript` + the doc upsert in `SummarizeButton` |

**Documents** — `GET /api/voice-notes/:id/document`, `GET /api/documents/:id`,
`POST /api/documents`, `PATCH /api/documents/:id`, `GET /api/documents/:id/markdown` (`302` presigned),
`POST /api/documents/:id/email` (Resend)

**Ops** — `GET /api/health` for the Render health check

~22 handlers, most 5–15 lines. Layout: `apps/api/src/routes/{auth,profile,voiceNotes,documents}.ts`
over a thin `repositories/` layer (every function takes `userId`).

---

## 4. Auth

**Recommendation: self-hosted, Postgres-backed session cookies** (Lucia v3 patterns via
`@oslojs/*` + `arctic`). Email + password now; Google OAuth as a later add-on.
`httpOnly; Secure; SameSite=Lax` cookie, session rows in Postgres, 30-day sliding expiry.

| Option | Verdict |
|---|---|
| **Self-host sessions** ✅ | Zero third parties, zero marginal cost, all data in the one Postgres you already back up. Cookie sessions skip the JWT access/refresh dance. ~1 file of session logic + 2 small shadcn forms (the `<Auth>` widget is deleted either way). This is the "controlled" the Founder asked for. |
| Clerk / WorkOS free tier | Fastest to build (handles Google/verification/reset, 10k MAU free) but re-introduces the kind of external dependency this migration exists to remove. Reasonable *fallback* if the Founder wants zero auth code. |
| Keep Supabase Auth only | Rejected — Supabase being down is the whole reason for the migration. |

**Cross-origin cookies (the one fiddly part):** use sub-domains of one registrable domain —
`app.<domain>` (Vercel) + `api.<domain>` (Render). Same-site ⇒ `Domain=.<domain>; SameSite=Lax`
just works; all `fetch` calls use `credentials: 'include'`; CORS `Access-Control-Allow-Credentials: true`
with an explicit origin allow-list. Without a custom domain: `SameSite=None; Secure` + CORS origin
pinned to the exact `*.vercel.app` URL plus a preview-deploy regex — workable, messier.

**Password portability:** Supabase stores bcrypt hashes in `auth.users.encrypted_password`. Verify
bcrypt *and* argon2, rehash to argon2 on next login → import existing users with **no forced reset**
(needs dashboard access to `auth.users`; otherwise a one-time "set a new password" email).

---

## 5. Data layer

**ORM: Drizzle** + `drizzle-kit` migrations — SQL-first (porting a known schema), generated TS
types with no codegen daemon, migrations as plain reviewable `.sql` committed to the repo (which
also *fixes* the current "schema exists nowhere in version control" problem).

### Ported schema (`apps/api/src/db/schema.ts`)

```
users          id uuid pk default gen_random_uuid()
               email citext unique not null
               hashed_password text            -- null for OAuth-only
               name text
               created_at timestamptz default now()

oauth_accounts provider text, provider_user_id text
               user_id uuid fk users
               primary key (provider, provider_user_id)

sessions       id text pk
               user_id uuid fk users on delete cascade
               expires_at timestamptz not null

profiles       user_id uuid pk fk users on delete cascade   -- was profiles.id
               full_name text, gender text, birthdate date
               avatar_url text, updated_at timestamptz

voice_notes    id uuid pk default gen_random_uuid()
               user_id uuid fk users on delete cascade, indexed
               title text, description text
               audio_key text            -- R2 object key (was audio_url)
               duration integer default 0
               tags text[] default '{}'
               transcript text
               created_at timestamptz default now()  -- index (user_id, created_at desc)

documents      id uuid pk default gen_random_uuid()
               user_id uuid fk users on delete cascade
               voice_note_id uuid fk voice_notes on delete cascade
               title text, content text
               markdown_key text          -- R2 object key (was markdown_url)
               created_at, updated_at timestamptz
```

- **Drop `transcripts`** (unused) — Founder yes/no.
- Rename `audio_url`/`markdown_url` → `audio_key`/`markdown_key` internally, but keep an
  `audio_url` field in API responses (a presigned/proxied URL) so the frontend types barely change.
- `citext` extension for case-insensitive email; `gen_random_uuid()` needs `pgcrypto` (built-in on Render PG).
- `updated_at` via trigger or Drizzle `$onUpdate`.

**RLS → application authz:** every repository function is `(userId, …)`; every query carries
`eq(table.userId, userId)`; inserts set `user_id` from the session, never the body. One integration
test per table asserting cross-user access → 404.

**Getting the real schema:** `types.ts` gives columns and FKs but not defaults, `NOT NULL`,
checks, or triggers. When Supabase is reachable:
`pg_dump --schema-only --schema=public "$SUPABASE_DB_URL" > supabase-schema.sql` and reconcile.

---

## 6. File storage flow

**v1: upload through the API** (simplest to operate; webm blobs are small).

- **Upload:** browser `FormData` (`audio` blob + `title`, `duration`) → `POST /api/voice-notes`
  with `credentials:'include'` → API validates session, size (≤25 MB, Whisper's ceiling), MIME
  (`audio/*`) → `PutObject` to R2 key `audio/{userId}/{noteId}.webm` → insert row → return note
  with `audio_url = /api/voice-notes/{id}/audio`.
- **Playback:** `GET /api/voice-notes/:id/audio` → ownership check → `302` to R2 presigned GET URL
  (TTL ~1 h). No audio bytes through the container, no egress cost.
- **Markdown:** on `POST/PATCH /api/documents` the API renders `content` to `.md` and `PutObject`
  to `md/{userId}/{voiceNoteId}.md`; `GET /api/documents/:id/markdown` → `302` presigned.

**Security upgrade:** today both buckets are fully public. Presigned URLs make audio + docs
private by default. A public R2 bucket + custom domain is even less code if privacy doesn't matter —
default to presigned.

**v2 (noted):** presigned `PUT` direct browser→R2 to offload upload bandwidth — needs R2 CORS +
a two-step frontend flow. Skip for now.

---

## 7. Frontend changes

- **New `src/lib/api.ts`** — ~40-line typed `fetch` wrapper: base URL from `import.meta.env.VITE_API_URL`,
  `credentials:'include'`, JSON in/out, typed errors, a `postForm` helper for multipart.
- **Dependency changes** — remove `@supabase/supabase-js`, `@supabase/auth-helpers-react`,
  `@supabase/auth-ui-react`, `@supabase/auth-ui-shared`; add nothing mandatory (native `fetch` +
  existing `zod` / `react-hook-form` / `@tanstack/react-query`); delete `src/integrations/supabase/`
  (keep a trimmed `VoiceNote` / `Document` type in `src/types/`).
- **New `src/hooks/useAuth.tsx`** — `useQuery(['session'], () => api.get('/auth/session'))`,
  exposes `user` / `isLoading` / `login` / `register` / `logout`. A `<RequireAuth>` wrapper replaces
  the copy-pasted `checkAuth` effects in `Index` / `Account` / `VoiceNoteDetail` / `VoiceNote`.

### Per-file change list

| File | Change |
|---|---|
| `integrations/supabase/client.ts` | delete |
| `App.tsx` | wrap routes in `<AuthProvider>`; `<RequireAuth>` on `/`, `/account`, `/voice-note/:id` |
| `pages/Login.tsx` | delete `<Auth>` → shadcn `react-hook-form` form → `useAuth().login`; drop `localStorage` hack |
| `pages/Register.tsx` | same → `useAuth().register` |
| `pages/Index.tsx` | drop auth effects; `handleLogout` → `useAuth().logout` |
| `pages/Account.tsx` | `getSession` → `useAuth()`; profiles fetch → `api.get('/profile')` |
| `pages/VoiceNoteDetail.tsx` | drop `getSession` effect |
| `hooks/useVoiceNoteData.ts` | 2 queries → `api.get('/voice-notes/:id')`, `api.get('/voice-notes/:id/document')` |
| `components/VoiceNote.tsx` | `loadRecordings` → `api.get('/voice-notes')` (consider `useQuery`) |
| `components/RecordingControls.tsx` | upload+insert → one `api.postForm('/voice-notes', fd)` |
| `components/AudioFileUpload.tsx` | same |
| `components/EditVoiceNoteForm.tsx` | `api.patch('/voice-notes/:id', …)` |
| `components/VoiceNoteList.tsx` | delete → `api.delete`; transcribe → `api.post('/voice-notes/:id/transcribe')`; play → `/api/voice-notes/:id/audio` |
| `components/ProfileForm.tsx` | `api.patch('/profile', …)` |
| `components/DocumentEditor.tsx` | fetches → `api.get('/documents/:id')`; save → `api.post`/`api.patch`; **remove** client-side markdown upload (server renders it) |
| `components/voice-note/SummarizeButton.tsx` | one call → `api.post('/voice-notes/:id/summary')` |
| `components/voice-note/DocumentActions.tsx` | download → `/api/documents/:id/markdown`; email → `api.post('/documents/:id/email', {to})` |
| `components/voice-note/TranscriptDisplay.tsx` | `api.post('/voice-notes/:id/transcribe')` |
| `components/voice-note/AudioPlayer.tsx` | prop `audioUrl` → `noteId` (or keep `audioUrl` = the `/api/...` path) |

Net ~18 files, all mechanical — same data shapes, no routing/UI change.

**Env:** `VITE_API_URL` (Vercel Production/Preview/Dev + `.env.local`) — the only new frontend var.

**CORS:** origin allow-list (`https://app.<domain>`, `http://localhost:8080`, a
`voice-archive-today-*.vercel.app` predicate), `credentials: true`, methods `GET POST PATCH DELETE OPTIONS`,
`allowHeaders: Content-Type`, preflight cached 24 h. `vercel.json` unchanged.

---

## 8. Local dev + deploy

### Repo layout — pnpm workspace

```
pnpm-workspace.yaml         packages: ["apps/*", "packages/*"]
apps/
  web/        ← current app moved here (set Vercel "Root Directory" = apps/web)
  api/        ← new Hono service
    Dockerfile
    src/{index.ts, routes/, repositories/, db/{schema.ts,migrate.ts}, lib/{r2,auth,openai,email}.ts}
    drizzle/  ← generated .sql migrations
packages/
  shared-types/  ← API response types imported by both
docker-compose.yml
render.yaml
```

Moving `web` is the only structural churn. To avoid even that: keep the SPA at repo root, put the
API in `/server` with its own `package.json` (no workspace). Workspace is cleaner for sharing types.

### `docker-compose.yml` (local) — see the committed stub

Postgres 16 + MinIO (R2 stand-in) + a one-shot bucket-create. API runs on the host via
`pnpm --filter api dev` (tsx watch) against `localhost:5432` / `localhost:9000`.

### `apps/api/Dockerfile`

Multi-stage: `node:20-slim` → pnpm install (frozen lockfile, `--filter api`) → `tsup` build →
runtime stage copies `dist` + prod `node_modules`, `USER node`, `CMD ["node","dist/index.js"]`,
`EXPOSE 8787`. Entrypoint runs `node dist/db/migrate.js` (idempotent) then starts Hono.

### `render.yaml` — see the committed stub

Managed Postgres 16 (`plan: basic-256mb`) + a Docker web service (`healthCheckPath: /api/health`,
`autoDeploy: true`), `DATABASE_URL` from the DB, `SESSION_SECRET` generated, the rest `sync: false`.

### Secrets inventory

| Secret | Consumer | Source |
|---|---|---|
| `DATABASE_URL` | API | Render (auto) |
| `SESSION_SECRET` | API session signing | Render `generateValue` |
| `OPENAI_API_KEY` | transcribe + summary | existing (**rotate**) |
| `RESEND_API_KEY` | doc email | existing (**rotate**) |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` | storage | new (Cloudflare) |
| `GOOGLE_CLIENT_ID` / `_SECRET` | OAuth (optional) | new (Google Cloud) |
| `VITE_API_URL` | frontend build | Vercel |

Retire `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`.

### Vercel → Render wiring

Set `VITE_API_URL` in Vercel (all environments). `api.<domain>` custom domain on the Render service,
`app.<domain>` (or apex) on Vercel — same registrable domain ⇒ `SameSite=Lax` cookies. Redeploy Vercel.

---

## 9. Migration sequencing

Supabase is down and the app has ~no active users, so a clean cutover is acceptable — but build
the API to full parity before flipping the frontend.

- **Phase 0 — Scaffolding** (no user-visible change): pnpm workspace; move app to `apps/web`;
  create `apps/api` (Hono + Drizzle); `docker-compose` (pg + minio) local; draft Drizzle schema
  from `types.ts` + `db:push`; create Render PG + web service via `render.yaml`; create R2 bucket.
- **Phase 1 — Auth:** `sessions`/`users`/`oauth_accounts`; `/api/auth/*`; cookie middleware; CORS.
  Frontend: `api.ts`, `useAuth`, `<RequireAuth>`, rewrite `Login`/`Register`. Ship to a Vercel
  *preview* pointed at the Render API; verify signup→login→session→logout.
- **Phase 2 — Voice notes + storage:** `voice_notes` table + repo; CRUD + `/audio`; R2 client.
  Frontend: `useVoiceNoteData`, `VoiceNote`, `RecordingControls`, `AudioFileUpload`,
  `EditVoiceNoteForm`, `VoiceNoteList`, `AudioPlayer`, `Account`/`ProfileForm`.
- **Phase 3 — AI + documents + email:** `/transcribe` (Whisper), `/summary` (gpt-4o-mini + doc
  upsert + markdown render), `/documents/*`, `/documents/:id/email` (Resend). Frontend:
  `TranscriptDisplay`, `SummarizeButton`, `DocumentEditor`, `DocumentActions`.
- **Phase 4 — Cutover:** remove `@supabase/*` + `src/integrations/supabase/`; tag
  `pre-render-cutover`; set production `VITE_API_URL`; point custom domains; deploy web; smoke test.
- **Phase 5 — Data migration** (whenever Supabase returns; can trail launch):
  1. `pg_dump --data-only` (or per-table CSV) for `voice_notes`, `documents`, `profiles`.
  2. Export `auth.users` → `id, email, encrypted_password, created_at`; import into `users`
     keeping the **same UUIDs** so all FKs stay valid; bcrypt verify → no password reset.
  3. Storage: pull both buckets via Supabase's S3-compatible endpoint, `rclone` into R2 under the
     new key scheme; rewrite `audio_key` / `markdown_key`.
  4. Load order `users → profiles → voice_notes → documents`. Script:
     `apps/api/scripts/migrate-from-supabase.ts`.
  5. Reconcile row counts; spot-check audio playback + a document.

**Rollback:** pre-Phase-4 — revert the Vercel env var / redeploy (frontend still has the Supabase
client on `main`). Post-Phase-4 — `git revert` to `pre-render-cutover`, redeploy Vercel; keep the
Supabase project **paused, not deleted**, ≥30 days. API/DB reproducible from `render.yaml` + migrations.

---

## 10. Cost on Render (2026 pricing)

| Component | Free | Realistic paid | What forces paid |
|---|---|---|---|
| Web service (Docker) | $0 — **spins down after ~15 min idle**, ~30–60 s cold start | **Starter $7/mo** — always-on | Cold starts on a login page; synchronous Whisper on a cold, memory-limited instance is fragile |
| PostgreSQL | $0 — 1 GB — **deleted 30 days after creation** | **Basic-256mb ≈ $6/mo** — daily backups | Free PG is not viable for anything persistent |
| Object storage (R2) | 10 GB, 1M writes, 10M reads/mo, **$0 egress** | $0 until ~10 GB | Large audio libraries eventually |
| Email (Resend) | 3k/mo, 100/day | $20/mo at scale | Volume |
| OpenAI | usage-based (unchanged) | — | — |

**Recommended baseline: ~$13/month** (Starter web $7 + Basic-256mb Postgres $6).
**Floor: ~$6/month** (free web with cold starts + Basic Postgres).

---

## 11. Open questions for the Founder

1. **Schema/RLS ground truth** is only in the down Supabase project. Can you get dashboard access
   or a `pg_dump --schema-only` before we finalize the Drizzle schema? If not, we reconstruct from
   behavior and accept minor drift.
2. **Google OAuth** — the client has `providers={[]}` (email/password only). Does Google login
   matter? If not, we skip `arctic` and ship faster.
3. **Existing user passwords** — import `auth.users` bcrypt hashes (no reset, needs dashboard
   access) or send everyone a "set a new password" email?
4. **Custom domain** — is there one for this app? Strongly recommended so session cookies are
   `SameSite=Lax` and preview deploys behave.
5. **`transcripts` table is unused** — OK to drop it in the port?
6. **Audio privacy** — default to presigned (private) URLs, or accept public objects for simplicity?
7. **Long transcription requests** — Whisper on a multi-minute recording can exceed 30–60 s. v1
   does this synchronously. Acceptable, or a Background Worker + `jobs` table + polling from the start?
8. **`duration` is always `0` today** — compute it server-side with `ffprobe` (adds ffmpeg to the
   image) or keep it cosmetic?
9. **Resend `from` domain** — functions send as `notifications@xilo.pro`. Confirm you control
   `xilo.pro` DNS (or pick a new sender domain) for Resend verification in the new account.
10. **Committed secrets** — the Supabase URL + anon JWT are in git history. Rotate OpenAI + Resend
    keys too (they lived in Supabase). Treat the old anon key as burned.
11. **Data loss window** — if Supabase never comes back, is the current data acceptable to lose?
    (~0 paying users, so likely yes — confirm.)
12. **`index.html` loads `cdn.gpteng.co/gptengineer.js`** unconditionally in production — unrelated
    to this migration but worth removing during the frontend pass.
