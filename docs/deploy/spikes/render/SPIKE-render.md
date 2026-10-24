# Spike — Render as the VAT backend host

> **Scope:** research + IaC draft only. Nothing was created, deployed or bought, and no remote state was changed. GitHub was read only.
> **Target:** `felipe-parra/voice-archive-today` (VAT), `main` @ `6629174` (2026-10-24).
> **Companion:** [`render.yaml`](./render.yaml). A parallel spike covers Fly.io.
> **Labels:** **VERIFIED** = I read it in the cited source on **2026-10-24**. **ASSUMED** = inference or an unconfirmed claim.

---

## 1. What VAT needs from a host

The backend already exists. PR #4 merged `server/`, so this spike started from real code, not from the PR #1 plan.

| Need | Evidence |
|---|---|
| **One long-running container.** Hono on Node 24, built from `server/Dockerfile` with the repo root as the context (it copies `server/` and `shared/`), listening on `PORT=3001`. | `server/Dockerfile`, `server/src/main.ts` on `main` |
| **No serverless.** A 60 s in-process delete-outbox loop and in-memory rate limiters, together with audio uploads up to 25 MB, rule out Vercel Functions (4.5 MB body cap). | PR #5 `docs/deploy.md` § Topology, `main.ts`, `app.ts` `bodyLimit` |
| **Postgres.** Migrations apply on boot (`repository.migrate()`), so no release step is needed. | `main.ts` |
| **Durable S3-compatible object storage** for the audio, with Range reads for playback. Vercel Blob is the alternative only if draft PR #6 merges. | `adapters/s3.ts`, PR #5 smoke test (`Range` → 206), PR #6 |
| **A health route** at `GET /api/health`. It calls `repo.health()`, so it **depends on the DB**. | `app.ts:62` |
| **Single instance.** The rate limiters live in process memory. | `app.ts` `limit()` |
| **Outbound HTTPS** to Groq (AI) and Resend (magic-link email). SMTP ports are not needed. | PR #5, `main.ts` env |
| **A same-origin proxy.** Vercel `vercel.json` rewrites `/api/*` to the backend, and today that rewrite points at `vat-api.fly.dev`. | `vercel.json` on `main` |
| **Card-free deploys matter.** PR #6 exists "because of" this requirement. | PR #6 title/body |
| **Budget ceiling of $5/mo**, as stated in the Fly runbook. | PR #5 |

Closed PR #1 (`docs/render-migration.md`) had already proposed "Render + Render Postgres + Cloudflare R2, baseline ~$13/mo". That number reappears in § 3.

---

## 2. Facts (checked 2026-10-24)

| # | Fact | Status | Source |
|---|---|---|---|
| F1 | **Free web services spin down after 15 min** without inbound traffic. Spin-up takes **about one minute**. Each workspace gets **750 free instance hours per month**; once they run out, every free service is suspended until the next month. | VERIFIED | <https://render.com/docs/free> |
| F2 | Free web services **cannot use persistent disks**, have no shell, run as a single instance, keep only the **2 most recent previous deploys** for rollback, can be restarted at any time, and have outbound ports 25/465/587 blocked. | VERIFIED | <https://render.com/docs/free> |
| F3 | **Free Postgres has 1 GB, expires 30 days after creation**, then gets a 14-day grace period, then is **deleted with all data**. It has no backups, and a workspace can have one at a time. | VERIFIED | <https://render.com/docs/free> |
| F4 | **Disks attach to paid services only.** A disk **disables zero-downtime deploys** and **prevents scaling past one instance**. Disks get daily snapshots kept for 7 days and cost **$0.25/GB/mo**. | VERIFIED | <https://render.com/docs/disks>, <https://render.com/pricing> |
| F5 | Compute prices: `free` is $0 (0.1 CPU, 512 MB), **`0.5c-512mb` (legacy "starter") is $7/mo**, and `1c-2g` (legacy "standard") is $25/mo. | VERIFIED | <https://render.com/pricing>, <https://render.com/docs/compute-plans> |
| F6 | Postgres prices: `free` is $0, **`0.1c-256mb` (legacy "basic-256mb") is $6/mo**, and `0.5c-1g` is $19/mo. Each includes 1 GB SSD, extra storage costs **$0.30/GB**, and paid plans get PITR (3 days on Hobby). | VERIFIED | <https://render.com/pricing> |
| F7 | Workspace plans: **Hobby is $0/mo + compute** (1 seat, **5 GB bandwidth**, single-service previews, 7-day logs, 5 builds retained). **Pro is $25/mo** (25 GB bandwidth, full-stack previews). Bandwidth overage is **$0.15/GB**, and inbound traffic is free. | VERIFIED | <https://render.com/pricing>, <https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses> (July 2026 snapshot) |
| F8 | **Regions:** `oregon`, `ohio`, `virginia`, `frankfurt`, `singapore`. **None is in Mexico or LatAm**, and a region cannot be changed after creation. | VERIFIED | <https://render.com/docs/regions>, <https://render.com/docs/blueprint-spec> |
| F9 | **Latency from CDMX:** the closest region is probably `virginia` or `ohio` at roughly 40–60 ms RTT. This was not measured. | ASSUMED | — |
| F10 | **Object storage:** Render Object Storage exists only as **early access**. The marketing page lists no GA prices or regions. Render's documented alternative is self-hosted MinIO on a paid service with a disk. | VERIFIED (early-access status from search excerpt of render.com/object-storage; the page itself rendered no details) | <https://render.com/object-storage>, <https://render.com/docs/deploy-minio> |
| F11 | **Card:** Render's first-deploy tutorial says free resources need "no payment". However, Render staff say accounts are *sometimes* verified with a **$1 card authorization**, which is cancelled, and the Terms allow a hold of up to $1. Without a card, running out of bandwidth or build minutes **suspends** free services for the rest of the month. **Any paid plan needs a card** (ASSUMED, but obvious). | VERIFIED (docs) / conflicting reports | <https://render.com/docs/your-first-deploy>, <https://render.com/docs/free>, <https://render.com/terms>, <https://community.render.com/t/free-web-service-issue/18026> |
| F12 | **Private networking:** free web services *can send* private traffic to datastores and paid services in the same region, but *cannot receive* it. VAT only needs the API → DB direction, so this is enough. | VERIFIED | <https://render.com/docs/free> |
| F13 | **Previews:** full preview environments require **Pro**, are billed like normal services, and do **not** copy `sync: false` variables, so they need an env group. Hobby gets single-service previews. | VERIFIED | <https://render.com/docs/preview-environments>, <https://render.com/pricing> |
| F14 | **Rollback** redeploys a previous build artifact, **including that deploy's env vars**. A Dashboard rollback **turns auto-deploy off**; an API rollback does not. Hobby keeps 5 builds. | VERIFIED | <https://render.com/docs/rollbacks>, <https://render.com/pricing> |
| F15 | **Health checks:** a check passes on a 2xx/3xx within 5 s. A deploy is cancelled if it is not healthy within 15 min. A running instance stops getting traffic after **15 s** of failures and is **restarted after 60 s**. | VERIFIED | <https://render.com/docs/health-checks> |
| F16 | **Logs:** Hobby keeps **7 days** and Pro 14 days. Log streams are available. | VERIFIED | <https://render.com/pricing> |
| F17 | **Client IP:** Render **appends** to `X-Forwarded-For` and puts the real client IP **first**, according to Render's CEO in a feedback thread. Render documents no dedicated client-IP header. | VERIFIED (vendor statement, not docs) | <https://feedback.render.com/features/p/send-the-correct-xforwardedfor> |
| F18 | **Cloudflare R2** (the external bucket assumed here) gives 10 GB-month free per month. Sources disagree on whether a card is needed to create a bucket. | VERIFIED (free tier) / card UNRESOLVED | <https://developers.cloudflare.com/r2/pricing/> (via search excerpt) |

---

## 3. Monthly cost

**Usage model (ASSUMED):** 0.5 MB per audio minute, 3-minute notes (1.5 MB each), and 2 notes per user per day (~90 per month). That is **~135 MB/user/month** stored. Playback egress is assumed at 2× the stored bytes. All playback goes **through the API**, which gates every read, so it counts against Render bandwidth. Groq and Resend are excluded (separate vendors, free tiers assumed).

| Level | Web | Postgres | Bandwidth | Storage (R2) | **Total** |
|---|---|---|---|---|---|
| **Idle / demo** | `free` $0 | `free` $0, dies every 30 days | ≪ 5 GB → $0 | ≪ 10 GB → $0 | **$0** (plus a monthly DB rebuild with data loss), or **$6** if the DB is paid to survive |
| **1 real user** | `0.5c-512mb` $7. Free is unacceptable: a 1-min cold start on every first visit, and the DB expires. | `0.1c-256mb` $6 | 0.27 GB → $0 | 0.14 GB → $0 | **$7 + $6 = $13** |
| **~100 users** | `0.5c-512mb` $7, or `1c-2g` $25 if 512 MB is too small for concurrent 25 MB uploads (ASSUMED risk, unmeasured) | `0.1c-256mb` $6. Metadata and transcripts fit in 1 GB (ASSUMED). | 100 × 0.27 = 27 GB + ~1 GB API → (28 − 5) × $0.15 = **$3.45** | 13.5 GB in month 1 → (13.5 − 10) × $0.015 = $0.05, growing ~$0.20/mo each month (R2 rate ASSUMED) | **$16.50** (starter) to **$34.50** (`1c-2g`) |

On Render, a **durable** setup costs at least **$13/mo**. That is above the **$5/mo ceiling** in PR #5. Only the free demo level fits under $5, and only by accepting a Postgres database that deletes itself.

---

## 4. IaC fidelity

**What the Blueprint expresses** (all in the draft): the Docker build and context, branch, `autoDeployTrigger`, `buildFilter`, plan, region, instance count, health path, shutdown delay, every env var name, the DB wiring (`fromDatabase`, internal URL), the DB plan, version and name, and the DB `ipAllowList: []`.

**What it cannot express, or only partly:**
- **Secret values.** `sync: false` prompts **only at Blueprint creation**, and later syncs ignore it (VERIFIED, blueprint-spec). Rotation is therefore a Dashboard step followed by a restart, which matches the xilo-pro lesson that env changes need a restart. Env groups cannot hold `sync: false` keys. `generateValue` exists, but VAT has no server-generated secret to use it on.
- **The object-storage bucket.** It lives in Cloudflare or Vercel, outside the file, so it is a second IaC surface or a manual step.
- **Immutable fields.** Region, service type, DB name, user and Postgres major version cannot change after creation; changing one means recreating the resource.
- **Workspace and billing settings,** registry credentials, and custom domain DNS.
- **The Vercel side** (the `vercel.json` rewrite target): a one-line repo change, outside Render.

**Secret handling:** no secret values appear in the file. Nine `sync: false` keys (WEB_URL, ALLOWED_ORIGINS, RESEND_API_KEY, MAIL_FROM, OPENAI_API_KEY, S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY) are entered once in the Dashboard. This follows the same pattern as `aziel-template/render.yaml`.

---

## 5. Lessons already paid for on Render, and how this draft handles them

| Lesson (source) | Handling in this draft |
|---|---|
| A `/healthz` behind a global rate limiter got the instance marked failed (xilo-pro). | **Avoided.** `/api/health` is not rate-limited: `app.ts` calls `limit()` only on the login, AI and email routes. |
| `trust proxy 1` collapsed per-IP limits onto Render proxy IPs; `ERR_ERL_PERMISSIVE_TRUST_PROXY` (xilo-pro `RENDER_PREPROD_STATUS_2026-02-23.md`). aziel ships `TRUST_PROXY=false` for the same reason. | **Not solved — flagged as an OPEN ITEM in the YAML.** VAT keys the login limit on `Fly-Client-IP`, falling back to the **last** `X-Forwarded-For` entry. Render puts the real client **first** (F17), and the Vercel rewrite adds another hop. On Render, all visitors would probably share one 30/window login bucket. This needs a small code change (a configurable client-IP header) and a header probe on a real deploy. ASSUMED until probed; it probably affects Fly behind the Vercel rewrite as well. |
| Env changes need a restart (xilo-pro). | Documented above. Secrets are set once, and rotation is Dashboard + restart. |
| Free instances spin down (xilo-pro, aziel). | The demo level only. The YAML comments name the plan to switch to for real users. aziel's smoke `warm-up.ts` pattern (poll the health route for 3 min) would be reused. |
| Free Postgres dies at about 30 days (aziel's expires 2026-11-22). | Called out in the YAML. Because `/api/health` pings the DB, **expiry turns into a 60 s restart loop** (F15), not a quiet failure. Real users require `0.1c-256mb`. |
| xilo-pro put state on a Render disk (`activation-api-data`). | **Avoided.** No disk. Audio goes to an external bucket, which keeps the free plan, zero-downtime deploys and future scaling available (F4). |
| xilo-pro's Blueprint used deprecated `env: node`. | Uses `runtime: docker` and `autoDeployTrigger` (current spec). |

---

## 6. Validation

**`render blueprints validate`: NOT RUN — CLI not installed** (`which render` → not found). Nothing was installed globally.

As a substitute:
1. **YAML syntax** with PyYAML: `PARSE OK`, 1 service, 1 database, 19 env vars, no duplicate keys, and `fromDatabase` resolves to `vat-db`.
2. **Render's published JSON schema** (`https://render.com/schema/render.yaml.json`, sha256 `8a3fb8da…94a`, fetched 2026-10-24), checked with `jsonschema` in a scratch venv:
   - First run: **2 errors**. A bare `autoDeployTrigger: off` parsed as YAML boolean `false`. Quoting it as `"off"` fixed it. A real Render CLI would have rejected the unquoted version too (ASSUMED).
   - After the fix: **`ERRORS: 0`**.
   - Control: `aziel-template/render.yaml` → `ERRORS: 0`.
   - Negative control: `region: mexico-city` → `ERRORS: 3`, so the validator does reject invalid input.

Schema validity does not show that Render would accept the plan, repo access or quotas; only `render blueprints validate` or a dry Blueprint creation shows that.

---

## 7. Verdict for VAT

**Render works for VAT technically, but it is not the cheaper or simpler option.** The fit is good where it counts: it runs the existing Docker image unchanged, provides managed Postgres, supports one long-running process, and expresses almost the whole stack in a single Blueprint that follows the house convention. The costs are three:
- it has **no GA object storage**, so the setup always spans three vendors (Render, plus R2 or Blob, plus Vercel);
- **durable data costs at least $13/mo with a card**, above PR #5's $5 ceiling;
- the **client-IP rate-limit key needs a code change** before real users.

**Card-free and durable are incompatible on Render.** A card-free Render setup is a demo whose database deletes itself every 30 days.

**Conditions that would flip it:**
- **Toward Render:** Fly turns out to require a card even for the demo, and the Founder wants a card-free demo now (Render free + PR #6 Vercel Blob, accepting monthly DB loss). Or Render Object Storage reaches GA at R2-like prices, making Render a single vendor. Or the $5 ceiling is lifted to about $15.
- **Further away:** usage pushes the web tier to `1c-2g` ($25), or full-stack previews become a requirement (Pro, $25/mo workspace fee).

> **ES (resumen):** Render sirve para VAT y su Blueprint encaja con nuestra convención. Aun así, no hay object storage GA, lo durable cuesta ≥ $13/mes con tarjeta, y "sin tarjeta" en Render implica una base de datos que se borra cada 30 días. Antes de usuarios reales hay que corregir la llave de IP del rate limit.
