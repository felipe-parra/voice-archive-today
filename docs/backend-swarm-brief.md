# `voice-archive-today` Backend — Swarm Execution Brief

> **Companion to [`render-migration.md`](./render-migration.md).** That document is the
> **architecture**. This document is the **execution plan**: how to hand the work to a
> high-capability agent swarm so it lands correctly in parallel.
>
> **Author:** Constanza (session `session_01TeM1wQ4612BcQkgTVj3kao`), 2026-09-09.
> **Status:** Ready to dispatch once the Founder answers § 2.A (5 questions).

---

## 1. How to use this document

1. Founder answers the **5 blocking questions** in § 2.A. The other 7 have safe defaults (§ 2.B).
2. A **coordinator** (human, or `constanza-chief-of-staff` / Orca) dispatches **Block 0** — one
   agent, sequential, blocking. It produces the frozen contract (§ 3).
3. Once the contract is tagged `contract-v1`, the coordinator dispatches **Blocks A–D in parallel**,
   each in its own git worktree (§ 7). They never touch each other's files (§ 6 lists owned paths).
4. **Block E** (integration + cutover) runs after A–D report done. **Block F** (data migration)
   runs whenever Supabase is reachable and can trail launch.
5. Every block has an explicit **Definition of Done** and a **single verification command** the
   agent must run green before reporting complete.

**Non-negotiables for every agent:**
- Stay under **200k context tokens**; checkpoint to `apps/api/PROGRESS.md` and hand off before the cap.
- Only edit files in your block's **owned paths** (§ 6). Need a change outside them → post to the
  coordinator, do not edit.
- The **contract (`packages/shared-types` + `apps/api/CONTRACT.md`) is frozen** after Block 0.
  A contract change is a coordinator decision that re-syncs every block.
- Conventional Commits. Every block ends as an **open PR stacked on `docs/render-migration`**
  (or on `main` once that merges) — no orphan branches.
- No secret values in the repo or in commit messages. `.env.example` only.

---

## 2. Decisions

### 2.A — Blocking (Founder must answer before dispatch)

| # | Question | Why it blocks | If no answer by dispatch |
|---|---|---|---|
| 1 | **Supabase schema access.** Can you get a `pg_dump --schema-only` or dashboard SQL access to `fdqgvjgcoidqwvemavaa`? | Block 0 finalizes the Drizzle schema. `types.ts` gives columns + FKs but not defaults / `NOT NULL` / checks / triggers. | Reconstruct from `types.ts` + frontend behavior, accept minor drift, reconcile in Block F. |
| 2 | **Google OAuth — keep it?** Client today is `providers={[]}` (email/password only). | Block A ships `arctic` + `/api/auth/google/*` or not. Skipping is ~1 day faster. | **Skip.** Email + magic link only for v1 (see § 2.B #2). |
| 3 | **Existing-user passwords.** Import `auth.users` bcrypt hashes (no reset, needs dashboard access) or email everyone a "set a new password" link? | Block F strategy + whether Block A carries a bcrypt-verify path. | **Assume forced re-set** (there are ~0 active users). Block A ships argon2-only. |
| 4 | **Custom domain for the app.** Is there one, or can we point `app.` + `api.` at one registrable domain? | Cross-origin cookie strategy. Same registrable domain ⇒ `SameSite=Lax` "just works"; without ⇒ `SameSite=None; Secure` + exact-origin CORS + preview-deploy regex (messier, still fine). | Ship the `SameSite=None` path; swap to `Lax` later is a 2-line change. |
| 5 | **Data-loss window.** If Supabase never returns, is the current stored data acceptable to lose? | Whether Block F is "nice to have" or "launch blocker". | **Assume acceptable** (~0 paying users) — Block F becomes best-effort, non-blocking. |

### 2.B — Defaulted (proceed unless Founder overrides)

| # | Question | Default |
|---|---|---|
| 5 | `transcripts` table (unused by frontend) | **Drop it.** App reads/writes `voice_notes.transcript` directly. |
| 6 | Audio / markdown privacy | **Presigned (private) URLs.** Today both buckets are fully public — this is a security upgrade. |
| 7 | Long Whisper requests (>30–60 s) | **Synchronous with a 120 s timeout** for v1. `jobs` table + worker is v2, only if UX demands. |
| 8 | `duration` (always `0` today) | **Keep cosmetic** for v1 — do not add `ffmpeg`/`ffprobe` to the image. |
| 9 | Resend `from` domain (`notifications@xilo.pro`) | Founder confirms `xilo.pro` DNS control in the new Resend account, else pick a sender domain. Block C stubs email behind a feature flag until verified. |
| 10 | Committed Supabase anon key / OpenAI / Resend keys | **Rotate all three** (Founder task, tracked separately). Swarm treats them as burned and reads everything from env. |
| 12 | `cdn.gpteng.co/gptengineer.js` in `index.html` | **Remove** during the Block D frontend pass. |
| — | **Auth model** | **Email + magic link** (`signInWithOtp`-style: POST email → 6-digit code or link → session cookie). Passwords are the fallback path, passkeys/WebAuthn are v2. Matches the `src/data/auth.ts` direction comment (Founder, 2026-09-09). |

---

## 3. The frozen contract (Block 0 output)

Block 0 produces and **tags `contract-v1`**. Everything downstream imports from it and may not change it.

| Artifact | Path | Content |
|---|---|---|
| API types | `packages/shared-types/src/*.ts` | Request + response shape for every route in `render-migration.md` § 3. Zod schemas, `z.infer` types re-exported. The frontend and the API both import this package. |
| Route contract | `apps/api/CONTRACT.md` | Frozen table: method, path, auth required?, request schema name, response schema name, status codes, side effects. ~22 rows. |
| DB schema | `apps/api/src/db/schema.ts` | Drizzle schema per `render-migration.md` § 5, plus `sessions` / `auth_codes` tables for magic-link. First migration generated into `apps/api/drizzle/`. |
| Local stack | `docker-compose.yml` | Postgres 16 + MinIO + bucket-init (the committed stub, filled in). |
| Deploy manifests | `render.yaml`, `apps/api/Dockerfile` | The committed stubs, completed. Multi-stage Dockerfile, `/api/health` healthcheck. |
| Workspace | `pnpm-workspace.yaml`, `apps/web/` (moved), `apps/api/` skeleton | App moved to `apps/web` (set Vercel Root Directory = `apps/web`). API skeleton: Hono server, CORS middleware, cookie middleware, error boundary, `/api/health`, empty route files. |
| Mock API | `apps/api/src/mock/` + `pnpm --filter api mock` | Serves the contract with in-memory fixtures so **Block D can build against it before A–C exist**. |
| CI | `.github/workflows/api.yml` | typecheck + lint + `vitest` + `docker build` for `apps/api`. |

**Block 0 DoD:** `docker compose up` healthy; `pnpm -r typecheck` green; `pnpm --filter api mock` serves every route with a stub 200; `pnpm --filter web build` green from the new path; contract tagged.

---

## 4. Work breakdown & dependency DAG

```
          ┌─────────────────────────────────────────────┐
          │  BLOCK 0 — Contract & Scaffolding (1 agent)  │  sequential, blocking
          │  → tag contract-v1                           │
          └───────────────┬─────────────────────────────┘
                          │
        ┌─────────────┬───┴────────┬────────────────┐
        ▼             ▼            ▼                ▼
   ┌─────────┐  ┌───────────┐ ┌──────────┐  ┌──────────────┐
   │ BLOCK A │  │  BLOCK B  │ │ BLOCK C  │  │   BLOCK D    │   parallel
   │  Auth   │  │  Notes +  │ │  AI +    │  │  Frontend    │   (worktrees)
   │ service │  │  storage  │ │ docs +   │  │  migration   │
   │         │  │           │ │ email    │  │ (vs mock API)│
   └────┬────┘  └─────┬─────┘ └────┬─────┘  └──────┬───────┘
        └─────────────┴────────────┴───────────────┘
                          │
                          ▼
              ┌───────────────────────────┐
              │  BLOCK E — Integration,    │  sequential
              │  E2E, cutover, deploy      │
              └───────────┬───────────────┘
                          │
                          ▼
              ┌───────────────────────────┐
              │  BLOCK F — Data migration  │  trails launch, non-blocking
              │  from Supabase (if it     │
              │  returns)                  │
              └───────────────────────────┘
```

Maps to `render-migration.md` § 9 phases: Block 0 = Phase 0; A = Phase 1; B = Phase 2; C = Phase 3;
D spans Phases 1–3 frontend; E = Phase 4; F = Phase 5.

---

## 5. Agent roster & profiles

| Block | Agent profile | Model / effort | Isolation | Tools |
|---|---|---|---|---|
| **0 Contract** | Senior architect. Owns the contract; the rest of the swarm depends on this being right. | **Opus, high reasoning** | worktree `wt-block0` | full read/write, Bash, `gh` |
| **A Auth** | Backend engineer, auth/sessions specialist. | **Opus, high** | worktree `wt-block-a` | full read/write, Bash |
| **B Notes+storage** | Backend engineer, storage/S3 specialist. | **Opus, high** | worktree `wt-block-b` | full read/write, Bash |
| **C AI+docs+email** | Backend engineer, 3rd-party-API integration. | **Opus, high** | worktree `wt-block-c` | full read/write, Bash |
| **D Frontend** | Frontend engineer, React Query + typed fetch. | **Opus, high** | worktree `wt-block-d` | full read/write, Bash |
| **E Integration** | Release engineer. Runs the full stack, E2E, cutover. | **Opus, high** | worktree `wt-block-e` | full read/write, Bash, `gh`, browser (Playwright) |
| **F Data migration** | Data engineer. One-shot import script. | **Opus, medium** | worktree `wt-block-f` | full read/write, Bash |
| **Reviewer** (per PR) | Adversarial review vs the contract + `render-migration.md`. Does not implement. | **Sonnet, high** | read-only | Read, Grep, Bash |
| **Coordinator** | Dispatches, holds the contract, resolves cross-block asks, gates merges. | Opus or human | — | Orca / `constanza-chief-of-staff` |

---

## 6. Per-block briefs

Each brief = **owned paths** (disjoint), **entry criteria**, **the prompt**, **DoD**, **verify command**.

---

### BLOCK 0 — Contract & Scaffolding

**Owned paths:** `pnpm-workspace.yaml`, `apps/` (move `web`, create `api` skeleton), `packages/shared-types/`, `apps/api/CONTRACT.md`, `apps/api/src/{index.ts,db/schema.ts,mock/,lib/cors.ts,lib/cookies.ts,middleware/}`, `apps/api/drizzle/`, `apps/api/Dockerfile`, `docker-compose.yml`, `render.yaml`, `.github/workflows/api.yml`, root `package.json`.

**Entry criteria:** § 2.A answered. Branch from `docs/render-migration`.

**Prompt:**
> You are the architect for the `voice-archive-today` backend migration. Read
> `docs/render-migration.md` in full — it is the architecture and it is correct; do not redesign it.
> Read the § 2 decisions in `docs/backend-swarm-brief.md`.
>
> Deliver the **frozen contract** exactly as listed in § 3 of the brief:
> 1. Convert this repo to a pnpm workspace. Move the current app to `apps/web` (nothing else about
>    it changes). Scaffold `apps/api` as a Hono + `@hono/node-server` service: CORS middleware
>    (origin allow-list from env, `credentials:true`), cookie middleware, a JSON error boundary,
>    request logger, and `GET /api/health`. Empty route files for `auth`, `profile`, `voiceNotes`,
>    `documents`.
> 2. `packages/shared-types` — Zod schema + inferred type for **every** request and response body
>    in `render-migration.md` § 3. This is the single source of truth both apps import.
> 3. `apps/api/CONTRACT.md` — the frozen route table (method, path, auth?, req schema, res schema,
>    status codes, side effects).
> 4. `apps/api/src/db/schema.ts` — Drizzle schema per § 5 of the migration doc. Add `sessions` and
>    `auth_codes` (magic-link: `id`, `user_id`, `code_hash`, `expires_at`, `consumed_at`). Generate
>    the first migration into `apps/api/drizzle/`.
> 5. `docker-compose.yml` (Postgres 16 + MinIO + a one-shot bucket-create) — complete the committed stub.
> 6. `apps/api/Dockerfile` (multi-stage, `node:20-slim`, `USER node`, entrypoint runs
>    `node dist/db/migrate.js` then starts Hono) and `render.yaml` — complete the committed stubs.
> 7. `apps/api/src/mock/` + a `pnpm --filter api mock` script that serves every contract route with
>    in-memory fixture data (reuse `apps/web/src/data/fixtures.ts` shapes) so the frontend block can
>    build before the real API exists.
> 8. `.github/workflows/api.yml` — typecheck, lint, `vitest`, `docker build` for `apps/api`.
> 9. `apps/api/PROGRESS.md` and `apps/api/CONTRACT.md` headers explaining the freeze rule.
>
> Do **not** implement real route logic, auth, DB queries, or storage — that is Blocks A–D.
> When done, open a PR stacked on `docs/render-migration`, and in the PR body list every contract
> decision you made that the migration doc left open.

**DoD:** `docker compose up` → all healthy; `pnpm -r typecheck` + `pnpm -r lint` green;
`pnpm --filter api mock` returns a stub 200 for every route in `CONTRACT.md`; `pnpm --filter web build`
green; migration applies cleanly to the compose Postgres; PR open; branch tagged `contract-v1`.

**Verify:** `pnpm -r typecheck && pnpm --filter web build && docker compose up -d && sleep 5 && curl -sf localhost:8787/api/health && pnpm --filter api test`

---

### BLOCK A — Auth service

**Owned paths:** `apps/api/src/routes/auth.ts`, `apps/api/src/routes/profile.ts`, `apps/api/src/lib/{auth,session,email-otp}.ts`, `apps/api/src/repositories/{users,sessions,profiles}.ts`, `apps/api/src/__tests__/auth.test.ts`, `apps/api/src/db/schema.ts` (only `users`/`sessions`/`auth_codes`/`profiles` — coordinate if you touch shared enums).

**Entry criteria:** `contract-v1` tagged.

**Prompt:**
> You own **auth + profile** for the `voice-archive-today` backend. The contract in
> `packages/shared-types` and `apps/api/CONTRACT.md` is **frozen** — implement to it exactly.
> Read `render-migration.md` § 4 (auth) and § 5 (data layer).
>
> Implement, against the compose Postgres + MinIO:
> - `POST /api/auth/request-code` — body `{ email }`. Upsert `users` row (no password), generate a
>   6-digit code, store `argon2(code)` in `auth_codes` with a 10-minute TTL, email it via the
>   `lib/email-otp` sender (Resend in prod, console in dev). Always return `200` (no user enumeration).
> - `POST /api/auth/verify` — body `{ email, code }`. Constant-time compare, single-use, TTL check.
>   On success: create a `sessions` row, set `httpOnly; Secure; SameSite=<per § 2.A #4>` cookie,
>   create the `profiles` row if absent, return the session user.
> - `POST /api/auth/logout` — delete the session row + clear cookie.
> - `GET /api/auth/session` — resolve cookie → user or `401`.
> - `GET /api/profile`, `PATCH /api/profile` — session-scoped.
> - `requireSession` middleware exported for Blocks B and C to import.
> - Session: 30-day sliding expiry, refresh-on-use, `sessions` cleanup on logout.
> - Password path: ship `POST /api/auth/login` + `/register` behind a `AUTH_PASSWORD_ENABLED` flag,
>   argon2 only (`@node-rs/argon2`). Default flag off.
>
> Tests: one integration test per route against a throwaway Postgres schema; one test proving a
> second user cannot read the first user's profile (→ `404`).
>
> Do not touch frontend, voice-notes, documents, AI, or storage code. Open a PR stacked on Block 0's branch.

**DoD:** all `/api/auth/*` + `/api/profile` routes pass integration tests; `requireSession` exported
and documented; magic-link round-trip works end to end against compose; no route returns another
user's data; `pnpm --filter api test` green.

**Verify:** `pnpm --filter api test -- auth profile && pnpm --filter api typecheck`

---

### BLOCK B — Voice notes + storage

**Owned paths:** `apps/api/src/routes/voiceNotes.ts`, `apps/api/src/lib/r2.ts`, `apps/api/src/repositories/voiceNotes.ts`, `apps/api/src/__tests__/voiceNotes.test.ts`.

**Entry criteria:** `contract-v1` tagged. May start immediately; imports `requireSession` from Block A once available (until then, stub it locally and swap on rebase).

**Prompt:**
> You own **voice notes + object storage**. Contract is frozen. Read `render-migration.md` § 3
> (voice-note routes) and § 6 (file storage flow).
>
> Implement against compose Postgres + MinIO (S3-compatible, `@aws-sdk/client-s3`):
> - `GET /api/voice-notes` — session-scoped list, newest first.
> - `GET /api/voice-notes/:id` — ownership check or `404`.
> - `POST /api/voice-notes` — `multipart/form-data` (`audio` blob + `title`, `duration`). Validate
>   session, size ≤ 25 MB, MIME `audio/*`. `PutObject` to `audio/{userId}/{noteId}.webm`, insert row,
>   return the note with `audio_url = /api/voice-notes/{id}/audio`.
> - `PATCH /api/voice-notes/:id` — title / description / tags / transcript.
> - `DELETE /api/voice-notes/:id` — delete row + R2 audio object + cascade child documents (+ their
>   markdown objects — coordinate the key scheme with Block C via the contract, do not invent one).
> - `GET /api/voice-notes/:id/audio` — ownership check → `302` to a ~1 h presigned GET URL.
> - `lib/r2.ts` — `putObject`, `deleteObject`, `presignGet`, `presignPut` (presignPut unused in v1,
>   ship it). Endpoint/credentials from env; MinIO locally, R2 in prod.
>
> Every query filters `eq(voiceNotes.userId, session.userId)`; inserts set `user_id` from the
> session, never the body. Tests: CRUD happy paths + a cross-user `404` test + an oversize-upload
> `413` test. Do not implement `/transcribe` or `/summary` — those are Block C. Open a PR stacked on Block 0.

**DoD:** all voice-note routes + `/audio` pass integration tests against compose; audio round-trips
MinIO; cross-user access returns `404`; delete cleans storage; `pnpm --filter api test` green.

**Verify:** `pnpm --filter api test -- voiceNotes && pnpm --filter api typecheck`

---

### BLOCK C — AI + documents + email

**Owned paths:** `apps/api/src/routes/documents.ts`, `apps/api/src/routes/voiceNotes.ai.ts` (transcribe + summary handlers, mounted by Block B's router via a documented import), `apps/api/src/lib/{openai,email,markdown}.ts`, `apps/api/src/repositories/documents.ts`, `apps/api/src/__tests__/{documents,ai}.test.ts`.

**Entry criteria:** `contract-v1` tagged. Mock OpenAI + Resend in tests; never call the real APIs from CI.

**Prompt:**
> You own **transcription, summarization, documents, and email**. Contract is frozen. Read
> `render-migration.md` § 1.4 (the 4 edge functions), § 3 (document routes), § 6.
>
> Implement:
> - `POST /api/voice-notes/:id/transcribe` — merge of `create-transcript` + `transcribe-audio`.
>   Ownership check → download audio from R2 (via Block B's `lib/r2`) → OpenAI `whisper-1` → write
>   `voice_notes.transcript` → return it. Synchronous, 120 s timeout, clear error if exceeded.
> - `POST /api/voice-notes/:id/summary` — merge of `summarize-transcript` + the `SummarizeButton`
>   doc upsert. `gpt-4o-mini` on the transcript → render markdown → upsert `documents` row → write
>   the `.md` to R2 `md/{userId}/{voiceNoteId}.md` → return the document.
> - `GET /api/voice-notes/:id/document`, `GET /api/documents/:id`, `POST /api/documents`,
>   `PATCH /api/documents/:id` — session-scoped. Server renders `content` → `.md` on write.
> - `GET /api/documents/:id/markdown` — `302` presigned.
> - `POST /api/documents/:id/email` — body `{ to }`. Render doc → Resend from the § 2.B #9 sender.
>   Behind `EMAIL_ENABLED` flag (default off until the domain is verified).
> - `lib/openai.ts`, `lib/email.ts`, `lib/markdown.ts` — thin, individually testable, injectable
>   for mocking.
>
> Tests use mocked OpenAI + Resend. Include a cross-user `404` test on documents. Coordinate the R2
> markdown key scheme with Block B **through the contract only**. Open a PR stacked on Block 0.

**DoD:** transcribe + summary + all document routes pass tests with mocked externals; markdown
renders + stores; email path gated by flag and unit-tested; cross-user access `404`; green CI.

**Verify:** `pnpm --filter api test -- documents ai && pnpm --filter api typecheck`

---

### BLOCK D — Frontend migration

**Owned paths:** `apps/web/src/lib/api.ts`, `apps/web/src/hooks/{useAuth.tsx,useVoiceNoteData.ts}`, `apps/web/src/components/RequireAuth.tsx`, and the per-file edits in `render-migration.md` § 7 (all under `apps/web/src/`), `apps/web/src/types/`, `apps/web/index.html`, `apps/web/.env.example`. **Delete** `apps/web/src/integrations/supabase/` and `apps/web/src/data/{auth,session,voiceNotes,fixtures,mode}.ts` in the final commit only.

**Entry criteria:** `contract-v1` tagged. Build and test against `pnpm --filter api mock` — you do
**not** wait for Blocks A–C.

**Prompt:**
> You own the **frontend migration** off Supabase. Contract is frozen; import types from
> `packages/shared-types`. Read `render-migration.md` § 7 — the per-file change list is your spec.
> Develop against `pnpm --filter api mock` (set `VITE_API_URL` to it).
>
> - `src/lib/api.ts` — typed `fetch` wrapper: `VITE_API_URL` base, `credentials:'include'`, JSON
>   in/out, typed error class, a `postForm` multipart helper.
> - `src/hooks/useAuth.tsx` — `AuthProvider` + `useAuth()` over
>   `useQuery(['session'], () => api.get('/auth/session'))`; exposes `user`, `isLoading`,
>   `requestCode`, `verifyCode`, `logout`. `<RequireAuth>` replaces the copy-pasted `checkAuth`
>   effects in `Index` / `Account` / `VoiceNoteDetail` / `VoiceNote`.
> - Rewrite `Login.tsx` / `Register.tsx` as **one email field → code entry** (magic link), shadcn +
>   `react-hook-form`. Delete the `<Auth>` widget and the `localStorage` token hack.
> - Every remaining Supabase call site → the `api` client per § 7's table. `DocumentEditor` loses
>   its client-side markdown upload (server renders it now).
> - Remove `@supabase/*` deps; delete `src/integrations/supabase/` and the `src/data/*` seam
>   (its job is done — the real API replaces fixture mode). Keep trimmed `VoiceNote` / `Document`
>   types in `src/types/` (or import from `shared-types`).
> - Remove the `cdn.gpteng.co/gptengineer.js` script from `index.html`.
> - `.env.example`: `VITE_API_URL`.
> - Keep every route, screen, and visual detail identical — this is a data-layer swap only. The
>   Playwright specs in `screenshots/` must still pass (update selectors only if the DOM genuinely moved).
>
> **Note on fixture mode:** production is currently live in `VITE_USE_FIXTURES=true` mode. Do not
> break that until Block E cutover — keep the app building with the mock API; Block E flips the
> Vercel env and removes the fixture path.
>
> Open a PR stacked on Block 0.

**DoD:** app builds + runs against the mock API; magic-link login flow works; every screen renders
real API data; no `@supabase` imports remain; `pnpm --filter web build` + `lint` + `typecheck` +
unit tests green; Playwright screenshot specs pass.

**Verify:** `pnpm --filter web build && pnpm --filter web test && pnpm --filter web lint`

---

### BLOCK E — Integration, E2E, cutover

**Owned paths:** `apps/api/src/index.ts` (final route mounting), `e2e/`, `apps/api/scripts/smoke.ts`, `render.yaml` (final env wiring), `vercel.json`, `docs/CUTOVER.md`, root `README.md`.

**Entry criteria:** Blocks A, B, C, D PRs all merged to the Block 0 branch (or to `main`).

**Prompt:**
> You own **integration and cutover**. All blocks are merged. Read `render-migration.md` § 8–9.
>
> 1. Mount every route in `apps/api/src/index.ts`; run the full stack via `docker compose up` + the
>    real API container. Fix any contract seams between blocks (report, don't silently redesign).
> 2. Write `e2e/` (Playwright) covering: request code → verify → record (upload fixture audio) →
>    transcribe → summarize → edit document → email (flag on, mocked) → logout. Run against the
>    composed stack.
> 3. Provision (or document exact steps for the Founder to provision): Render Managed Postgres,
>    Render Docker web service from `render.yaml`, Cloudflare R2 bucket. List every secret from
>    `render-migration.md` § 8 that the Founder must paste.
> 4. Cutover per § 9 Phase 4: deploy the API to Render; set `VITE_API_URL` + **unset
>    `VITE_USE_FIXTURES`** in Vercel (all environments); point `app.` + `api.` custom domains if
>    they exist; deploy web; run `apps/api/scripts/smoke.ts` against production; tag `pre-render-cutover`.
> 5. `docs/CUTOVER.md` — the runbook + rollback (revert Vercel env / redeploy; Supabase stays
>    paused ≥ 30 days).
>
> Pause for Founder confirmation before the production `VITE_API_URL` flip and before pointing DNS.

**DoD:** full E2E green against the composed stack; API live on Render with a passing health check;
production smoke test green; `CUTOVER.md` complete; `pre-render-cutover` tag pushed; fixture mode
removed from production.

**Verify:** `pnpm e2e && node apps/api/scripts/smoke.ts $PROD_API_URL`

---

### BLOCK F — Data migration from Supabase (trails, non-blocking)

**Owned paths:** `apps/api/scripts/migrate-from-supabase.ts`, `apps/api/scripts/README-migration.md`.

**Entry criteria:** Block E done **and** Supabase reachable (or a `pg_dump` + storage export handed over).

**Prompt:**
> Write a **one-shot, idempotent, resumable** import from the old Supabase project into the new
> Postgres + R2, per `render-migration.md` § 9 Phase 5. Order: `users` (keep the same UUIDs from
> `auth.users` so every FK stays valid) → `profiles` → `voice_notes` → `documents`. Pull both
> storage buckets via Supabase's S3-compatible endpoint and `rclone`/SDK them into R2 under the new
> key scheme, rewriting `audio_key` / `markdown_key`. Per § 2.A #3: if hash import is approved,
> carry `encrypted_password` and verify bcrypt-then-rehash-argon2 on next login; otherwise skip
> passwords (users re-set via magic link anyway). End with a row-count reconciliation report and a
> spot-check of one audio file + one document. Dry-run mode default; `--commit` to write.

**DoD:** script runs dry green against the real export; `--commit` imports with matching row counts;
spot-checks pass; report committed.

**Verify:** `tsx apps/api/scripts/migrate-from-supabase.ts --dry-run`

---

## 7. Coordination protocol

- **Worktrees.** Coordinator creates one git worktree per block off the Block 0 branch:
  `git worktree add .worktrees/block-a -b feat/backend-block-a contract-v1`. Agents never share a
  working copy. This is what makes the parallel phase safe.
- **Contract freeze.** After Block 0, `packages/shared-types` + `apps/api/CONTRACT.md` +
  `apps/api/src/db/schema.ts` are read-only for Blocks A–D. A needed change → the agent posts
  `CONTRACT-CHANGE-REQUEST` to the coordinator, who edits the contract, re-tags `contract-v2`, and
  tells every block to rebase. Do not free-hand it.
- **Cross-block imports** (e.g. B and C both need `requireSession` from A, C needs `lib/r2` from B):
  the contract names the export and its signature. Until the source block ships, stub locally behind
  the agreed signature and swap on rebase.
- **Context budget.** 200k tokens per agent. At ~150k, checkpoint to `apps/api/PROGRESS.md`
  (what's done, what's left, current file, open questions) and hand off to a fresh agent of the
  same profile. Divide a block that won't fit.
- **PR discipline.** Every block ends as an open PR stacked on the Block 0 branch. Draft while WIP.
  A `Sonnet, high` reviewer checks each PR against `CONTRACT.md` + `render-migration.md` before merge.
  Watch the **stacked-PR merge hazard** (`constanza` has hit it twice): retarget a child PR's base
  to the parent's merged base *before* merging the parent, or expect to recreate it.
- **Merge order into the Block 0 branch:** A → B → C → D (D last so it rebases onto the real routes),
  then the whole stack → `main`, then E, then F.
- **Escalation.** Anything touching money, DNS, production env vars, or a Founder decision in § 2.A
  → stop and post to the coordinator. Do not guess.

---

## 8. Definition of done (whole migration)

- [ ] `apps/api` deployed on Render (Docker), `/api/health` green, autoDeploy on.
- [ ] Render Managed Postgres with daily backups; schema from committed Drizzle migrations.
- [ ] Cloudflare R2 bucket; audio + markdown private, served via presigned `302`.
- [ ] Magic-link auth end to end; `SameSite` per § 2.A #4; sessions in Postgres.
- [ ] Every screen in the app runs on the new API — record, transcribe (Whisper), summarize
      (gpt-4o-mini), edit document, email (when the domain is verified).
- [ ] `VITE_USE_FIXTURES` removed from production; `@supabase/*` gone from the repo.
- [ ] `docs/CUTOVER.md` runbook + rollback; `pre-render-cutover` tag.
- [ ] Supabase project **paused, not deleted**, ≥ 30 days.
- [ ] OpenAI + Resend keys rotated (Founder); old Supabase anon key treated as burned.
- [ ] Baseline cost confirmed ≈ **$13/mo** (Starter web $7 + Basic Postgres $6).
- [ ] Block F: data imported (or explicitly written off per § 2.A #5).

---

## 9. Risk register

| Risk | Mitigation |
|---|---|
| Schema drift from reconstructing without `pg_dump` | § 2.A #1; Block F reconciles; Drizzle migrations make it fixable |
| Blocks diverge on shapes | Frozen contract in `shared-types`; reviewer checks every PR against `CONTRACT.md` |
| Stacked-PR merge auto-closes a sibling | § 7 merge rule — retarget base before merging parent |
| Synchronous Whisper times out on long audio | 120 s timeout + clear error in v1; `jobs` table is the documented v2 |
| Cross-origin cookies misconfigured | § 2.A #4; ship `SameSite=None; Secure` + exact-origin CORS if no custom domain |
| Cold starts on Render free tier | Budget the $7 Starter (always-on) from day 1 — § 10 of the migration doc |
| Agent blows past 200k context | Checkpoint at 150k to `PROGRESS.md`; coordinator splits the block |
| Fixture-mode production breaks during migration | Block D keeps the app building on the mock API; only Block E flips the env |
| Committed / shared secrets | Founder rotates OpenAI + Resend + Supabase anon; swarm reads only from env; `.env.example` only |

---

*Companion to `render-migration.md`. Produced 2026-09-09, session `session_01TeM1wQ4612BcQkgTVj3kao`.*
