# Spike — External managed Postgres for the VAT backend

| Field | Value |
|---|---|
| Date checked | 2026-10-24 |
| Question | Which managed Postgres, with a free tier that does not expire, should back (a) the card-free Render demo now and (b) the durable Fly setup later? |
| Follows | VAT draft PR #9 (`docs/hosting-spike-fly-vs-render`), README § "The deciding unknown" |
| Code read | `felipe-parra/voice-archive-today` `main` (clone at `vat-pg/`), `pg@8.23.0`, `pg-connection-string@2.14.0` (from `server/pnpm-lock.yaml`) |
| Method | Read-only. No sign-up, account, CLI against remote state, push or PR comment. Every claim is marked **VERIFIED** (with source) or **ASSUMED**. |
| Status | **Spike, not a decision.** |

---

## 1. What VAT needs from Postgres, from the code

| # | Requirement | Evidence | Consequence for a provider |
|---|---|---|---|
| R1 | **Driver: `pg` (node-postgres) `Pool`, `max: 10`, `connectionTimeoutMillis: 5000`, `statement_timeout: 15000`.** No ORM. | `server/src/adapters/postgres.ts:12`; `server/package.json` deps | Needs at most 10 server connections per process. |
| R2 | **`statement_timeout` goes out as a startup parameter**, not as a `SET`. | `pg@8.23.0` `lib/client.js:543-559` (`getStartupConf` → `data.statement_timeout`) — VERIFIED by reading the tagged source | **PgBouncer rejects unknown startup parameters** with "unsupported startup parameter: statement_timeout" unless it is told to ignore them (VERIFIED as PgBouncer behaviour: [pgsql-general thread](https://www.postgresql.org/message-id/CAKgGyB8iYj_JavbDD13-4PknNJPji%2B%3DtbmSjk%3D80ZtcZmr-2nw%40mail.gmail.com)). Whether Neon's or Supabase's pooler ignores it is **not documented** → prefer a **direct (unpooled)** connection. |
| R3 | **No named prepared statements, no `PREPARE`, no `LISTEN/NOTIFY`, no `SET`, no temp tables.** All queries are parameterised `pool.query(text, values)` without `name:`. | `postgres.ts` whole file (101 lines); `grep` for `name:`/`LISTEN`/`SET LOCAL` returns nothing | Compatible with a transaction-mode pooler apart from R2. |
| R4 | **Transaction-scoped advisory lock** `pg_advisory_xact_lock(74923018)` around migrations. | `postgres.ts:16-17` | Fine under PgBouncer transaction mode: Neon lists only *session-level* advisory locks as unsupported (VERIFIED, [neon.com/docs/connect/connection-pooling](https://neon.com/docs/connect/connection-pooling)). |
| R5 | **Explicit multi-statement transactions** (`BEGIN … COMMIT`) on one checked-out client: `migrate`, `requestLink` (6 statements), `consumeLink` (6 statements). | `postgres.ts:13-27, 30-50, 52-64` | Each statement is a network round trip → **DB distance multiplies login latency** (see § 4.4). |
| R6 | **Migrations self-apply on boot**: one file, run as a single multi-statement query inside the transaction, tracked in `schema_migrations`. | `server/src/main.ts:34-35`; `postgres.ts:18-23`; `server/migrations/001_initial.sql` | Needs the app role to own `CREATE TABLE` in its database — normal on every candidate (ASSUMED). |
| R7 | **No extensions.** Types used: `uuid`, `text`, `text[]`, `timestamptz`, `double precision`, `integer`. UUIDs are generated in Node (`randomUUID`), not by `gen_random_uuid()`. | `001_initial.sql:1-24`; `postgres.ts:2, 58, 94` | Any Postgres ≥ 13 works. Local dev uses `postgres:16-alpine` (`compose.yaml`) → **target PG 16**. |
| R8 | **`DATABASE_URL` is the only DB input**, read raw (`z.string().min(1)`) and passed as `connectionString`. No `ssl:` object in code. | `main.ts:17, 34`; `postgres.ts:12` | SSL is controlled **only** by `sslmode` in the URL. `pg-connection-string@2.14.0` treats `sslmode=require`/`prefer`/`verify-ca` as **`verify-full`** and prints a security warning (VERIFIED, `pg-connection-string/index.js:139-149, 219-226`). So the provider's certificate must validate against Node's default CA bundle, or the URL must carry `sslrootcert`. |
| R9 | **A long-running Node process with a 60 s timer that queries the DB** (`pendingDeletes()` every minute). | `main.ts` `setInterval(…, 60_000)`; `archive.ts:54-58`; `postgres.ts:98` | **While the API process is awake, the DB never sees 5 idle minutes**, so a scale-to-zero DB stays awake exactly as long as the API does. Decisive for Neon's compute-hour budget (§ 3). |
| R10 | `/api/health` runs `SELECT 1`; Fly checks it every 30 s (PR #9 `fly.toml`), Render on its own schedule. | `server/src/http/app.ts:62`; `main.ts` `health()` | Same effect as R9 while the app is up; no effect while the app is stopped (ASSUMED for both hosts, as PR #9 already states for Fly). |
| R11 | **Expected data size: small.** Rows are users, profiles, sessions, notes metadata, transcripts and generated documents; audio lives in S3/Blob (`voice_notes.audio_key`). | `001_initial.sql:11-23`; `server/src/adapters/s3.ts` | ASSUMED ~20 KB of text per note (transcript + document). 100 users × 100 notes ≈ **200 MB**. 500 MB–1 GB free tiers last well past 100 users. |

**Net:** VAT is a plain, extension-free, long-running `pg` client. Use a **direct connection** (R2), make SSL verify against a public CA (R8), and pick a provider whose compute billing survives the 60 s loop (R9).

---

## 2. Comparison table

V = VERIFIED (source below the table, checked 2026-10-24). A = ASSUMED.

| | **Neon (Free → Launch)** | **Supabase (Free → Pro)** | **Aiven for PostgreSQL (Free)** | **Prisma Postgres (Free)** |
|---|---|---|---|---|
| Free storage | 1 GB/project, 20 GB total, 100 projects — V¹ | 500 MB/project, 2 active projects — V⁴ | 1 GB disk, 1 vCPU, 1 GB RAM — V⁷ | 2 GB, 200k operations/mo — V⁹ |
| Free compute | **100 CU-hours/project/month**, autoscale up to 2 CU. Exhausting it **suspends compute until next month or upgrade; data kept** — V² | Shared CPU, 500 MB RAM — V⁴ | Single node, always on (until powered off) — V⁷ | Metered by operations, not time — V⁹ |
| **Expires or pauses?** | Scale to zero after **5 min idle, cannot be disabled on Free**; wakes in "a few hundred milliseconds" — V¹ ³. Free tier "permanent (not a trial)" — V¹. ⚠️ A "Free projects inactive ≥ 90 days are subject to deletion as of 2026-10-05" sentence appears on the regions page; the Azure-deprecation page scopes it to Azure regions ("Projects in AWS regions are not affected") — V⁵, but the scope is **not stated explicitly** → A: AWS free projects are not deleted | **Paused after 1 week of inactivity** ("a few user requests … each day" keeps it up; threshold unpublished); restore window 1 year per current docs (older changelog said 90 days) — V⁴ ⁶ | **May be powered off** after "no continuative activity" (no period given), with a notice; also powered off if unused in the first few hours; can be powered on again — V⁷ ⁸ | "No time limit" — V⁹. Inactivity rule not stated — A |
| Card for free | **No** — V¹ | Not stated on pricing — A: no | **No** — V⁸ | **No** — V⁹ |
| Region near Render `virginia` (PR #9 draft) | `aws-us-east-1` N. Virginia — V¹⁰ | `us-east-1` N. Virginia — V¹¹ | Cannot choose on free (Aiven "may change the cloud provider, region…") — V⁷ ⁸ | Not stated — A |
| Region near Fly `dfw` | None in Texas; nearest `aws-us-east-2` Ohio / `aws-us-east-1` — V¹⁰ | None in Texas; `us-east-2` Ohio / `us-east-1` — V¹¹ | Not choosable — V⁷ | A |
| Region near CDMX | None in Mexico; `aws-sa-east-1` São Paulo is the only LatAm one (farther than the US) — V¹⁰ | None in Mexico; `sa-east-1` — V¹¹ | — | A |
| Backups / PITR free | **6-hour instant-restore window**, 1 GB-month of history — V² | **No automatic backups** on Free — V⁴ | "Backups included", retention not stated; pricing comparison says "single backup only" — V⁷ ⁸ (sources disagree) | A |
| Backups / PITR cheapest paid | Launch: up to **7 days** instant restore, default 1 day, $0.20/GB-month of history — V² | Pro: daily backups kept 7 days; PITR is +$100/mo per 7 days — V⁴ | Paid plans: A (pricing page not read) | A |
| Connection limit | `max_connections` **104 at 0.25 CU, 97 usable**; pooler allows 10,000 clients — V³ᵇ | Not read for Free — A | **`max_connections` 20, no pooling** — V⁷ | **10 direct connections** on Free — V⁹ |
| Pooler & VAT fit | PgBouncer **transaction mode** (`-pooler` host). Unsupported: `SET`, `LISTEN/NOTIFY`, SQL `PREPARE`, session advisory locks… Protocol-level prepared statements OK. **Unpooled host = drop `-pooler`** — V³ᵇ. Startup-param handling not documented → use unpooled (R2) | Supavisor: session mode **5432**, transaction mode **6543**; "transaction mode does not support prepared statements"; **direct connection is IPv6-only** unless the IPv4 add-on; docs recommend direct for persistent backends — V¹² | Direct only; 20 > VAT's 10 — V⁷ | Driver support for plain `pg` over TCP not stated on pricing — A |
| Reachable from Render? | Yes, IPv4 — A (standard AWS endpoint) | **Direct connection: no.** Render is IPv4-only outbound per Render support / Supabase docs → must use the **Supavisor session pooler** — V¹³ (Render statement is a community post, not current docs → A on "still true") | Yes — A | A |
| Cheapest paid | **Launch: $0.106/CU-hour + $0.35/GB-month, no monthly minimum**, invoices < $0.50 not collected, 500 GB egress/project — V² | **Pro $25/mo**, includes $10 compute credit (one Micro), 250 GB egress — V⁴ | Not read — A | Starter $10/mo — V⁹ |
| Extensions VAT needs | None needed (R7) — V | None needed — V | None needed — V | None needed — V |
| IaC | **Community** Terraform provider `kislerdm/neon` (Neon-sponsored, "not officially supported"): project, branch, endpoint, role, database; Pulumi package bridged from it; Neon REST API — V¹⁴ | **Official** `supabase/supabase` Terraform provider (`supabase_project`, `supabase_settings`, `supabase_branch`) — V¹⁵. ⚠️ `database_password` is an argument → keep it in a TF variable/secret store, never in the file | Official `aiven/aiven` provider — A (not read this spike) | A |
| Egress / latency | 5 GB/project on Free, 500 GB on Launch — V¹ ² | 5 GB + 5 GB cached on Free — V⁴ | A | A |

**Excluded:** **CockroachDB** and **Xata** were not researched: CockroachDB is wire-compatible but not Postgres (advisory-lock and DDL-in-transaction semantics differ — A), and nothing in VAT needs either. **Prisma Postgres** stays in the table but is scored out: it bills by *operations*, and R9 alone (one `SELECT` per minute while awake, plus health checks) would spend a large share of 200k ops/month before any user (A, arithmetic: 43,200 cleanup queries + up to 86,400 Fly health checks per always-on month). It is also unverified for plain `pg` over TCP.

### Sources (all fetched 2026-10-24)
1. [neon.com/pricing](https://neon.com/pricing)
2. [neon.com/docs/introduction/plans](https://neon.com/docs/introduction/plans)
3. [neon.com/docs/introduction/scale-to-zero](https://neon.com/docs/introduction/scale-to-zero) · 3b. [neon.com/docs/connect/connection-pooling](https://neon.com/docs/connect/connection-pooling)
4. [supabase.com/pricing](https://supabase.com/pricing)
5. [neon.com/docs/introduction/regions](https://neon.com/docs/introduction/regions) · [neon.com/docs/import/azure-regions-deprecation](https://neon.com/docs/import/azure-regions-deprecation)
6. [supabase.com/docs/guides/platform/free-project-pausing](https://supabase.com/docs/guides/platform/free-project-pausing) (via search result text; not fetched directly)
7. [aiven.io/docs/products/postgresql/concepts/pg-free-tier](https://aiven.io/docs/products/postgresql/concepts/pg-free-tier)
8. [aiven.io/docs/platform/concepts/free-plan](https://aiven.io/docs/platform/concepts/free-plan) · [aiven.io/free-postgresql-database](https://aiven.io/free-postgresql-database) (search text)
9. [prisma.io/pricing](https://www.prisma.io/pricing)
10. [neon.com/docs/introduction/regions](https://neon.com/docs/introduction/regions)
11. [supabase.com/docs/guides/platform/regions](https://supabase.com/docs/guides/platform/regions)
12. [supabase.com/docs/guides/database/connecting-to-postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
13. [community.render.com — Render ↔ Supabase after IPv6 transition](https://community.render.com/t/issues-connecting-render-to-supabase-after-ipv6-transition/24156) · [Supabase IPv4/IPv6 compatibility](https://supabase.com/docs/guides/troubleshooting/supabase--your-network-ipv4-and-ipv6-compatibility-cHe3BP.md)
14. [neon.com/docs/reference/terraform](https://neon.com/docs/reference/terraform)
15. [supabase.com/docs/guides/deployment/terraform](https://supabase.com/docs/guides/deployment/terraform)

---

## 3. Monthly cost — top 2 (Neon, Supabase)

**The compute arithmetic that decides Neon (R9):** the DB is awake whenever the API is awake, plus 5 minutes.
At the minimum size of 0.25 CU: **100 CU-h ÷ 0.25 = 400 awake hours/month ≈ 13 h/day** on Free. An always-on API = 730 h × 0.25 = **182.5 CU-h → over the free quota by ~day 16**, after which Neon suspends compute until the month ends (V²) and `/api/health` fails.

| Scenario (ASSUMED usage) | API awake | Neon | Supabase |
|---|---|---|---|
| **Idle / demo** — Render free (sleeps after 15 min) or Fly `auto_stop`; ~2 h of use/day | ~2.5 h/day | ~19 CU-h → **$0 (Free)** | **$0 (Free)** — but **paused after 7 days without traffic**; a demo nobody opens for a week goes dark until someone restores it in Studio |
| **1 user** — a few sessions/day | ~3–4 h/day | ~23–30 CU-h → **$0 (Free)** | **$0 (Free)**; no backups |
| **~100 users** — Fly `auto_stop`, traffic most of the waking day | ~14 h/day | ~105 CU-h → just over Free → **Launch ≈ 105 × $0.106 + 0.2 GB × $0.35 + 1-day history ≈ $11–12/mo** | **Pro $25/mo** (Micro covered by the credit; daily backups 7 days). Free would technically fit (500 MB), but no backups for 100 real users is not acceptable |
| ~100 users, **always-on API** (Render paid / Fly `min_machines_running = 1`) | 24 h/day | 182.5 CU-h → **≈ $19.5/mo** on Launch | $25/mo |

**Cheap fix that changes the Neon number (code, not done here):** make the 60 s outbox loop back off when `pendingDeletes()` returns nothing (or run it on writes only). Then an idle-but-running API lets Neon sleep, and the always-on case drops back toward the active-traffic case. Without it, every always-on deployment pays ~$19.5/mo of DB compute for a once-a-minute empty `SELECT`.

Topology totals (adding PR #9's figures, which are not re-verified here):
- **Render free + Vercel Blob + Neon Free** ≈ **$0**, no card, data durable (6 h restore window).
- **Fly dfw/iad + Tigris + Neon** ≈ PR #9's "≈ $6 at 100 users" **+ ≈ $11–12** → **≈ $17–18/mo at 100 users**, < $1 idle. Still well under Fly Managed Postgres alone ($38).

---

## 4. Compatibility risks with VAT's driver and migrations

1. **Pooler + `statement_timeout` startup parameter (R2) — HIGH if the pooled URL is used.** PgBouncer refuses it by default. Neither Neon nor Supabase documents whether their pooler ignores it (A). **Mitigation: use the unpooled URL** (Neon: hostname without `-pooler`; Supabase: direct, which Render cannot reach — see 3). VAT's single process with `max: 10` is far below Neon's 97 usable connections (V³ᵇ), so no pooler is needed. If a pooler is ever required, move the timeout into the URL as `options=-c statement_timeout=15000` (works for a server option, not a startup parameter — A) or into `ALTER ROLE … SET statement_timeout`.
2. **SSL verification (R8) — MEDIUM.** `pg-connection-string@2.14.0` upgrades `sslmode=require` to `verify-full`. Neon serves certificates from a public CA (A), so it should validate with Node's default bundle; write **`sslmode=verify-full`** explicitly to silence the warning and survive the pg v9 semantic change (V, source comment). **Supabase uses its own CA (A)** — verify-full would then fail with "self-signed certificate in certificate chain" unless `sslrootcert=<path to Supabase CA>` ships in the image, which is extra moving parts. Neon's connection strings may also include `channel_binding=require`; confirm `pg@8.23` accepts it on first connect (A).
3. **Supabase from Render = pooler only (V¹² ¹³).** Direct is IPv6-only; Render egress is IPv4-only (A on current status). That forces Supavisor, which reintroduces risk 1 (session mode on 5432 is the less risky of the two; transaction mode 6543 adds the prepared-statement caveat, though VAT uses none).
4. **Region distance × round trips (R5).** `consumeLink` is 6 sequential statements; a normal request is 2 (session lookup + query). With the DB in N. Virginia and the API in Fly `dfw`, A: ~25–35 ms RTT → **~150–210 ms added to every login, ~60 ms to every request.** With API and DB in the same AWS-adjacent metro (Render `virginia` ↔ Neon `aws-us-east-1`, or Fly `iad` ↔ Neon `aws-us-east-1`), it is low single-digit ms (A).
5. **Cold start stacking.** Neon wakes in a few hundred ms (V³) — negligible next to Render free's ~1 min and Fly's ~2 s. `connectionTimeoutMillis: 5000` covers it (A).
6. **Migrations.** One multi-statement simple-protocol query inside `BEGIN` plus a transaction advisory lock: fine on a direct connection on all candidates (A); also fine through a transaction pooler (R4, V³ᵇ). Neon's free 6-hour restore window is the only safety net for a bad boot-time migration on Free — ADR-02's "reviewed SQL applied deliberately" matters more there.
7. **Quota exhaustion looks like an outage.** When Neon Free runs out of CU-hours it suspends compute (V²); `/api/health` then fails and Fly/Render mark the app unhealthy. Set a usage alert, and cap autoscaling at 0.25 CU so one heavy query cannot burn the budget at 2 CU (A: the max is configurable on Free up to 2 CU, V²).

---

## 5. Verdict

**(a) Card-free Render demo now → Neon Free, region `aws-us-east-1`, unpooled URL, PG 16.** It is the only candidate that is card-free (V), never pauses on a calendar (only scale-to-zero, which wakes in ms — V), keeps a 6 h restore window (V), lets us pick N. Virginia next to Render `virginia` (V), and its compute budget fits a demo with large margin because Render free sleeps (§ 3). Supabase is the runner-up and loses on: 7-day inactivity pause (a demo nobody opens goes dark), no backups on Free, and pooler-only access from Render plus a custom CA.

**(b) Fly durable setup later → still Neon, upgraded to Launch (pay-as-you-go, no minimum): ≈ $11–12/mo at 100 users, 7-day PITR.** Same project, no data migration between phases: upgrading the plan keeps the URL (A). **Put the Fly app in `iad`, not `dfw`**, so it sits next to the database (§ 4.4) — or accept ~60 ms/request in `dfw`.

**Conditions that flip it**
- Neon confirms the 90-day inactivity deletion applies to **AWS** Free projects too → the demo needs a weekly wake-up ping, or move it to Aiven Free (no stated deletion, but no region choice and an unspecified power-off).
- The API must be **always on** and the outbox loop is **not** changed → Neon ≈ $19.5/mo; still cheaper than Supabase Pro ($25), but the gap narrows — and if the product later needs Supabase's auth/storage, Supabase Pro wins on bundled value.
- A **Mexico region** appears at Neon or Supabase (none today, V) → reconsider region for CDMX latency.
- Fly stays in `dfw` for user latency and the DB must be close → no candidate has Texas (V); Fly Managed Postgres in `dfw` ($38) becomes the only co-located option.
- A Supabase-specific need (RLS-backed auth, Realtime) — out of scope for this server, which does its own auth.

---

## 6. Exact changes the PR #9 drafts would need (described, not applied)

### `docs/deploy/spikes/render/render.yaml`
1. **Delete the whole `databases:` block** (`vat-db`, `plan: free`, `region: virginia`, `postgresMajorVersion: "16"`, `ipAllowList: []`) — Render's free DB is the 30-day clock this spike exists to avoid.
2. **Replace** the `DATABASE_URL` env entry
   ```yaml
   - key: DATABASE_URL
     fromDatabase: { name: vat-db, property: connectionString }
   ```
   with
   ```yaml
   # External Neon Postgres (Free; Launch for real users), project region aws-us-east-1 to sit next to
   # Render `virginia`. UNPOOLED host (no `-pooler`): pg sends statement_timeout as a startup parameter,
   # which PgBouncer rejects. Format: postgresql://<role>:<password>@<endpoint>.us-east-1.aws.neon.tech/vat?sslmode=verify-full
   # Typed into the Dashboard only; never in this file.
   - key: DATABASE_URL
     sync: false
   ```
3. **Update comments** that now lie: the "Internal URL: private network, same region. Free web services MAY send private traffic to datastores" line (the DB is now public-internet, TLS-verified); the `databases:` cost note (`free — 1 GB, no backups, EXPIRES 30 days…`) moves to a header line pointing at this spike.
4. `region: virginia` on the web service stays — it is now justified by the DB's region, not by Fly's old `iad`.

### `docs/deploy/spikes/fly/fly.toml`
1. **No new keys.** `DATABASE_URL` is already in the header's `fly secrets set` list; set it to the same unpooled Neon URL with `sslmode=verify-full`.
2. **Header comment** "Postgres: `fly mpg create` / an external provider" → "Postgres: external Neon (`SPIKE-postgres.md`), unpooled URL as a secret."
3. **`primary_region`**: the comment should state the trade explicitly — `dfw` (closer to CDMX users) vs `iad` (co-located with Neon `aws-us-east-1`, saves ~60 ms per request and ~150–210 ms per login, A). This spike recommends `iad` unless a user-side latency measurement says otherwise.
4. **`[[http_service.checks]]` comment**: add that each probe is a DB round trip **and keeps Neon awake** while the machine runs; harmless with `auto_stop_machines = "stop"`, but with `min_machines_running = 1` it (and the 60 s outbox loop) holds Neon at 24/7 compute.
5. `auto_stop_machines = "stop"` / `min_machines_running = 0` should stay — it is what keeps Neon inside (or near) the free compute budget.

### App code (out of scope for PR #9, noted for the backend PR)
- Optional: outbox loop backoff when empty (§ 3) — removes the always-on Neon cost.
- Not needed: no SSL object, no pooler flags, no extension migrations.

---

**ES (resumen):** Neon Free (sin tarjeta, sin caducidad por calendario, región `aws-us-east-1`, URL sin pooler) para el demo en Render hoy, y el mismo proyecto en Neon Launch (≈ $11–12/mes con 100 usuarios, 7 días de PITR) para Fly después, idealmente con Fly en `iad` junto a la base de datos.
