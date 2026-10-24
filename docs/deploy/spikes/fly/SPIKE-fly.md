# Spike — Fly.io as the VAT backend host

> **EN:** Time-boxed research + IaC draft, 2026-10-24. No account, no deploy, nothing remote changed. Companion file: `fly.toml` (same folder). A parallel spike covers Render.
> **ES:** Investigación acotada + borrador IaC, 2026-10-24. Sin cuenta, sin deploy, sin cambios remotos.

Labels: **VERIFIED** = read on the cited page on 2026-10-24 · **ASSUMED** = inference, not checked.

---

## 1. What VAT needs from a host

Derived from `felipe-parra/voice-archive-today` `main` (HEAD `6629174`, 2026-10-22) and PRs #1, #5, #6.

| Need | Evidence |
|---|---|
| One long-running Node container (`server/Dockerfile`, Hono, port 3001) | `server/Dockerfile`; PR #5: "the in-process outbox loop and AI concurrency cap need a long-running process" |
| Request bodies up to ~25 MB (audio upload). This rules out Vercel Functions (4.5 MB cap) | PR #5 topology table; `app.ts` `bodyLimit(MAX_AUDIO_BYTES + 64 KiB)` |
| **Exactly one instance**: rate limiters (login 30, AI 5, email 5) are in process memory | `server/src/http/app.ts` `limit()`; `main.ts` comment "A single API process…" |
| Postgres (`DATABASE_URL` required; migrations self-apply on boot) | `main.ts` → `repository.migrate()` |
| S3-compatible object storage with Range GET (audio playback) | `S3ObjectStore`; PR #5 smoke test (`Range -> 206`); PR #6 adds Vercel Blob as an alternative |
| Outbound HTTPS to Groq (transcribe/summary) and Resend (magic link) | `main.ts` env schema; PR #5 prerequisites |
| Health endpoint that touches the DB | `app.ts:62` `GET /api/health → repo.health()` |
| Same-origin `/api` via Vercel rewrite → the `__Host-` cookie works without CORS | `vercel.json` on `main` (`/api/:path*` → `https://vat-api.fly.dev`) |
| Real client IP from `Fly-Client-IP` (the only trusted header) | `main.ts` `clientKey`. **The code is already Fly-specific here.** On another host the limiter falls back to the last `x-forwarded-for` hop |

PR #1 (closed, 2026-09-09) planned Render + Render Postgres + Cloudflare R2, at a baseline of ~$13/mo. PR #4 then shipped the container. PR #5 retargeted it to Fly. PR #6 exists because Fly needs a card: it is the card-free Render + Vercel Blob path.

---

## 2. Facts (checked 2026-10-24)

| # | Fact | Status | Source |
|---|---|---|---|
| F1 | **No free tier or free monthly allowance for new orgs.** The only free start is a trial of **2 h of machine runtime or 7 days**, whichever comes first. A few items stay free: inbound transfer, the first 10 GB of snapshots, and shared IPv4/IPv6. | VERIFIED | https://docs.fly.io/about/pricing |
| F2 | **Card required:** "every organization except Linked Organizations must have a card on file." Trial users can start without one, but must add a card to keep using billable resources after the trial. With a 2 h trial, that is effectively **day one**. | VERIFIED (2 h ⇒ day one is inference) | https://docs.fly.io/about/pricing |
| F3 | Machine price, shared-cpu-1x, cheapest regions (iad/ewr): **256 MB $2.19 · 512 MB $3.69 · 1 GB $6.70 per month**. "Prices vary by region." dfw is not priced on the page. | VERIFIED / dfw price unknown | https://docs.fly.io/about/pricing |
| F4 | A stopped machine bills only its rootfs, at **$0.15/GB-mo**. Volumes cost **$0.15/GB-mo provisioned**, even when detached. Snapshots cost $0.08/GB-mo after the first 10 GB, which are free. Dedicated IPv4 is $2/mo. Egress in North America is **$0.02/GB**. | VERIFIED | https://docs.fly.io/about/pricing |
| F5 | Auto-stop: `auto_stop_machines = "off"\|"stop"\|"suspend"`. The machine stops after being idle "for several minutes" (no exact number given), at most one machine per region per pass. A cold start from stop takes "about 2 seconds or more". Suspend resumes in "a few hundred milliseconds", with extra caveats. `min_machines_running` applies only in the primary region. Fly recommends toggling stop and start together. | VERIFIED | https://docs.fly.io/launch/autostop-autostart |
| F6 | Volumes: "A volume exists on one server in a single region". A volume is 1:1 with a machine. "Fly.io does not automatically replicate data". "If you only have a single copy … and that drive fails, then the data is lost." Snapshots are daily, kept 5 days by default (1–60 configurable), and "may not include your latest changes". | VERIFIED | https://docs.fly.io/volumes/overview · https://docs.fly.io/reference/configuration |
| F7 | **Fly Managed Postgres (MPG):** Basic (shared-2x, 1 GB) **$38/mo**, Starter (2 GB) $72, Launch $282 and up. Storage costs **$0.28/GB-mo**. All plans include HA, backups and pooling. | VERIFIED | https://docs.fly.io/postgres |
| F8 | **Unmanaged "Fly Postgres" (`fly postgres create`)**, the setup PR #5 uses, is on a deprecation path toward MPG. Fly staff said the templates "will be deprecated", and the `fly postgres` commands may go away or be repurposed. The current MPG page no longer mentions it. **No official end-of-life date found.** Community reports: MPG does not auto-stop, and some admin tasks need the dashboard. | VERIFIED (staff statement); EOL date unknown | https://community.fly.io/t/future-of-legacy-postgres/24609 · https://community.fly.io/t/how-to-auto-stop-managed-postgres-instances/25340 · https://community.fly.io/t/mpg-administration-options/26213 |
| F9 | **Regions: `qro` (Querétaro) is gone.** There are 17 regions and none is in Mexico. The nearest to CDMX is **dfw** (Dallas), which has a gateway and MPG. The only Latin American region is gru (São Paulo). | VERIFIED (list); "nearest" by geography = ASSUMED, latency not measured | https://docs.fly.io/reference/regions |
| F10 | **Tigris:** buckets are created with `fly storage create` (CLI). It sets `BUCKET_NAME`, `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` on the app. Keys are shown only at creation. Docs recommend the endpoint **`https://t3.storage.dev`** over the old `fly.storage.tigris.dev`. Usage is billed on the Fly invoice. | VERIFIED | https://docs.fly.io/tigris |
| F11 | Tigris price: Standard **$0.02/GB-mo**. Class A $0.005/1k and Class B $0.0005/1k requests. **Egress is free.** Free tier: 5 GB storage, 10k Class A and 100k Class B per month. **Whether that free tier applies to Fly-provisioned buckets is not stated** on Fly's page. | VERIFIED (Tigris pricing via search summary); free-tier-via-Fly = ASSUMED | https://www.tigrisdata.com/pricing.md · https://docs.fly.io/tigris |
| F12 | Secrets: fly.toml `[env]` is for non-sensitive values only. Credentials go through `fly secrets` (CLI). `[[files]]` can materialize a secret as a file. | VERIFIED | https://docs.fly.io/reference/configuration |
| F13 | Rollback: there is **no rollback command**. You run `fly releases --image` and then `fly deploy --image <old>`, which works only while the image is still in Fly's registry. It does **not** revert secrets, config or migrations. The old `auto_rollback` flag was removed. | VERIFIED (guide + forum) | https://fly.io/docs/blueprints/rollback-guide/ · https://community.fly.io/t/auto-rollback-in-fly-toml-documentation-is-missing/26462 |
| F14 | Logs: `fly logs` is a live tail. Docs say Grafana log search keeps **30 days**; forum posts report 7 days and 1 hour. The Fly Log Shipper exists for longer retention. | VERIFIED (docs say 30 d); conflicting reports | https://fly.io/docs/metrics-and-logs/logs · https://community.fly.io/t/logs-now-showing-only-about-1-hour-of-history/25075 |
| F15 | Deploy strategies: `rolling` (default), `immediate`, `canary`, `bluegreen` (needs a health check). Canary and bluegreen **cannot be used with attached volumes**. `[mounts]` supports `initial_size`, `snapshot_retention`, `scheduled_snapshots` and `auto_extend_*`. | VERIFIED | https://docs.fly.io/reference/configuration |
| F16 | flyctl v0.4.101 is installed locally. `fly config validate` and `fly platform regions` **both require login**. Neither works offline. | VERIFIED (run locally, § 7) | local run |

---

## 3. Monthly cost — three levels

The app machine is shared-cpu-1x 512 MB ($3.69/mo always on, $0.005/h). Prices are iad prices; dfw may differ (F3). The Postgres choice dominates, so every level is shown under two options:

- **A = Fly Managed Postgres Basic.** Supported. $38 floor.
- **B = self-hosted Postgres** on its own Fly machine: shared-cpu-1x 256 MB always on, plus a volume. Deprecated template (F8). We own the backups. A single volume can lose data (F6).

A third option, **C = external free-tier Postgres** (e.g. Neon, Supabase) + Fly API + Tigris, is listed as a flip condition. It was **not researched here (ASSUMED)**.

| Line | Idle / demo | 1 real user | ~100 users |
|---|---|---|---|
| Usage assumptions (ASSUMED) | API awake ~20 h/mo | awake ~60 h/mo, ~0.2 GB audio | awake 24/7, ~20 GB audio, ~100 GB playback streamed through the API |
| API machine | 20 h × $0.005 = **$0.10**, plus rootfs ~0.3 GB × $0.15 = $0.05 → **$0.15** | 60 h × $0.005 + $0.05 = **$0.35** | **$3.69** |
| Tigris storage | 0 GB → **$0** | 0.2 GB → $0.004 (or $0 if the free tier applies) | (20 − 5 free) × $0.02 = **$0.30**; without the free tier 20 × $0.02 = $0.40 |
| Tigris requests | ≈ $0 | ≈ $0 | ≈ 5k PUT × $0.005/1k + 100k GET × $0.0005/1k ≈ **$0.08** |
| Fly egress (audio is proxied by the API, not served from Tigris directly) | ≈ $0 | ~2 GB × $0.02 = $0.04 | 100 GB × $0.02 = **$2.00** |
| **DB option A: MPG Basic** | $38 + 1 GB × $0.28 = **$38.28** | **$38.28** | $38 + 3 GB × $0.28 = **$38.84** |
| **DB option B: self-hosted** | 256 MB $2.19 + 1 GB vol $0.15 = **$2.34** | **$2.34** | 512 MB $3.69 + 3 GB vol $0.45 = **$4.14** |
| **Total with A** | **≈ $38.4** | **≈ $38.7** | **≈ $44.9** |
| **Total with B** | **≈ $2.5** | **≈ $2.7** | **≈ $10.2** |

Reading the totals:

- PR #5's "$2–4/mo" is option **B**, and the arithmetic still holds today. But B rests on a deprecated product and on a single unreplicated volume.
- The supported path (**A**) is roughly **10–15× the PR #5 budget ceiling of $5/mo**.
- Snapshots of a 1–3 GB DB volume fall inside the free 10 GB. A dedicated IPv4 is not needed (shared IPv4 is free), so neither is counted.

---

## 4. IaC fidelity — what `fly.toml` can and cannot express

| Concern | In `fly.toml`? | Otherwise |
|---|---|---|
| App name, region, build (Dockerfile), env (non-secret), HTTP service, health checks, auto stop/start, concurrency, VM size, deploy strategy, release command, kill signal/timeout | **Yes** | — |
| Volumes | **Partly**: `[mounts]` declares the mount and `initial_size`/snapshots, and the first deploy creates the volume | Later resizing or forking: `fly volumes` |
| Secrets | **No** (F12) | `fly secrets set` (stored in Fly, not in git) |
| App creation | **No** | `fly apps create` |
| Machine **count** | **No** (`min_machines_running` is a floor for auto-stop, not a count) | `fly deploy --ha=false` / `fly scale count 1` |
| Postgres (MPG or self-hosted) | **No** | `fly mpg create` / a separate app; `DATABASE_URL` set as a secret |
| Tigris bucket | **No** (F10) | `fly storage create`, then re-map `AWS_*` → `S3_*` |
| Deploy trigger | **No**: there is no Git integration in config | Manual `fly deploy`, or a GitHub Action holding a deploy token |
| Rollback | **No** | `fly deploy --image` (F13) |

Compared with `aziel-template/render.yaml`, Render's Blueprint declares the **database, generated secrets (`generateValue`), placeholder secrets (`sync: false`), branch and `autoDeploy`** in the file. On Fly those are all imperative.

**Fly config covers the app container, not the environment around it.** Rebuilding from scratch means re-running a CLI script, so the runbook script effectively becomes part of the IaC.

---

## 5. Draft `fly.toml`: decisions taken

The full reasoning is inline in `fly.toml`. Compared with the file on VAT `main`:

1. `primary_region`: `iad` → **`dfw`** (closest to CDMX; `qro` no longer exists). The dfw price still needs confirming.
2. **`kill_timeout = 15`**, because `main.ts` waits up to 10 s on shutdown.
3. **`[deploy] strategy = "rolling"`**, explicitly. bluegreen would briefly run two processes: two in-memory limiters and a `migrate()` race.
4. **`[http_service.concurrency]`** set low, because uploads hold requests open. The values are ASSUMED.
5. Health check: grace 20 → 30 s, interval 15 → 30 s, because every probe is a DB round-trip.
6. The Groq model and base URL move from secrets to `[env]`, since they are not secret. A summary-model conflict between PR #5 and `.env.example` is flagged.
7. **No `[mounts]`.** The API stays stateless.

---

## 6. PR #5 runbook (`docs/deploy.md`): what is stale

| Claim in PR #5 | Status now |
|---|---|
| `fly postgres create … --initial-cluster-size 1` (Fly Postgres) | **Stale / risky.** That template is on a deprecation path to MPG (F8). The command may disappear or change meaning. The supported option is `fly mpg create`, from $38/mo. |
| "Infra budget ceiling $5/mo … realistic ≈ $2–4/mo" | Holds **only** with the deprecated self-hosted Postgres (option B, § 3). With MPG it is ≈ $38+. There is also no free allowance to absorb it (F1). |
| Region `iad` | Not wrong, but not the best fit for CDMX users. `dfw` is nearer (F9). Neither the runbook nor the original plan considered `qro`, which no longer exists. |
| Tigris secrets re-mapped from `$AWS_ENDPOINT_URL_S3` | Still works, but Fly now recommends the endpoint `https://t3.storage.dev` (F10). |
| "read current values with `fly ssh console -a $APP -C env`" | Works, but it prints the secrets to the terminal. The keys are shown once at `fly storage create`, so capture them there (F10). |
| Prerequisite "`fly auth login` done" | Incomplete. It needs **a card on file** (F2): the trial is 2 h of machine time. This is the reason PR #6 exists. |
| `fly deploy --ha=false` | **Still correct and essential.** It keeps one machine for the in-memory limiters. |
| "`AI_SUMMARY_MODEL=openai/gpt-oss-120b`" | Conflicts with `server/.env.example` (`llama-3.3-70b-versatile`). It is not a host issue, but it needs resolving. |
| No rollback section | Gap. Add `fly releases --image` / `fly deploy --image` and the "migrations are not rolled back" warning (F13). |

---

## 7. Validation

```
$ fly version
fly v0.4.101 darwin/arm64 Commit: 203d7369ecb26c9adecadb501cd95682decdb527 BuildDate: 2026-09-08T18:51:26Z

$ fly config validate -c fly.toml
Error: no access token available. Please login with 'flyctl auth login'
exit=1          # same with --strict; validation is server-side and needs an account

$ python3 -I -c "import tomllib; …"   # local TOML parse
TOML OK, top-level keys: ['app', 'primary_region', 'kill_signal', 'kill_timeout', 'build', 'deploy', 'env', 'http_service', 'vm']
```

`fly config validate` was **NOT RUN**: it needs auth, and creating an account was out of scope. The TOML is syntactically valid. Schema-level validation against Fly is still pending. Run it on the first login, before any deploy.

---

## 8. Verdict for VAT

**Conditional no-go on Fly today. Fly is technically the best fit, but not on cost and card terms.**

- **Technical fit: good.** The code already reads `Fly-Client-IP`, `vercel.json` already points at `vat-api.fly.dev`, scale-to-zero suits a demo, and Tigris needs no adapter change.
- **Economics: poor.** A card is needed from day one. With supported Postgres the floor is ≈ $38/mo. The $2–4/mo the runbook promises only exists on a deprecated, single-volume Postgres that the Founder would have to back up.
- **Region: no Mexico presence.** dfw is the best available.

**Conditions that flip it to GO:**

1. **The Postgres runs outside Fly** on a free or low-cost managed tier (option C). The Fly API + Tigris then cost **< $1/mo idle and ≈ $6/mo at ~100 users** (§ 3 without the DB line). This is the cheapest serious topology found, but it still needs a card.
2. The Founder accepts a card on file and caps exposure. Fly has no spend cap in the docs read here (ASSUMED: not researched).
3. VAT gets ≥ 1 paying user, or the $38 MPG floor becomes acceptable as the cost of not owning backups.

**Conditions that keep it NO-GO:** no card at all. That is the PR #6 path (Render + Vercel Blob), and the parallel spike covers it.

**ES:** Fly encaja técnicamente (el código ya usa `Fly-Client-IP`, Tigris sin cambios), pero exige tarjeta desde el día uno. Con Postgres administrado el piso es ≈ $38/mes. Los $2–4 del runbook dependen de un Postgres que Fly está deprecando. Se vuelve GO si la base de datos vive fuera de Fly en un tier gratuito.
