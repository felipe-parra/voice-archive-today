# Hosting spike — Fly.io vs Render for the VAT backend / Fly.io vs Render para el backend de VAT

| Field | Value |
|---|---|
| Date | 2026-10-24 |
| Question | Where should the existing `server/` backend (PR #4, Docker, Postgres, S3-style audio storage, magic-link auth) run? It decides whether PR #5 (Fly runbook) and PR #6 (Vercel Blob adapter) move or close. |
| Method | Two parallel read-only agent spikes, one per platform. No account, deploy or remote change. Each wrote a draft IaC file in the house convention (`aziel-template/render.yaml`: one declarative file, every non-obvious setting commented with its reason, no secret values, explicit deploy trigger, health check, runbook beside it). |
| Status | **Spike — not a decision.** The draft IaC files live here, not at the repository root, so nothing picks them up. |

- Fly: [`fly/SPIKE-fly.md`](fly/SPIKE-fly.md) · [`fly/fly.toml`](fly/fly.toml)
- Render: [`render/SPIKE-render.md`](render/SPIKE-render.md) · [`render/render.yaml`](render/render.yaml)

## Side by side / Comparación

| Dimension | Fly.io | Render |
|---|---|---|
| Free start | None for new orgs: a trial of 2 h machine runtime **or** 7 days. **Card required** after the trial. ✅ re-verified | Free web service (750 h/mo, sleeps after 15 min idle, ~1 min cold start) and free Postgres. No card for free services (agent-reported). ✅ re-verified except the card point |
| Durable Postgres | Managed Basic **$38/mo** ✅ re-verified. The $2–4 path in PR #5 is the unmanaged template Fly staff say is headed for deprecation, on one unreplicated volume | Paid `0.1c-256mb` **$6/mo** (agent-reported). Free Postgres: 1 GB, no backups, **expires after 30 days**, deleted after a 14-day grace ✅ re-verified |
| Object storage for audio | Tigris, S3-compatible, works with the existing adapter unchanged | None GA → a third vendor (R2 or Vercel Blob / PR #6) |
| Wake from idle | ~2 s from stop, a few hundred ms from suspend | ~1 min on the free tier ✅ re-verified |
| Region nearest CDMX | `dfw` Dallas. No Mexico region; `qro` no longer exists ✅ re-verified | Oregon, Ohio, Virginia, Frankfurt, Singapore. None in Mexico; fixed at creation |
| What the IaC file holds | App, VM, health checks, deploy strategy. **Not** secrets, app creation, machine count, Postgres or buckets (all CLI) | Web service, Postgres, env (secrets as `sync: false`), deploy trigger: nearly the whole stack |
| IaC validation | TOML parses. `fly config validate` needs a login — **not run** | Passes Render's published JSON schema (0 errors). Caught a real bug: bare `off` parses as boolean. Positive and negative controls run. CLI `render blueprints validate` **not run** |
| Code fit today | Already wired: the server reads `Fly-Client-IP`, `vercel.json` rewrites `/api` to `vat-api.fly.dev` | Runs the same Dockerfile unchanged. Needs the client-IP fix below and a `vercel.json` change |

## Monthly cost / Costo mensual (each spike shows its arithmetic)

| Topology | Card | Idle / demo | 1 user | ~100 users |
|---|---|---|---|---|
| Fly API + Tigris + **Fly Managed Postgres** | Yes | ≈ $38.4 | ≈ $38.7 | ≈ $44.9 |
| Fly API + Tigris + **self-hosted Postgres** (deprecated template, single volume) | Yes | ≈ $2.5 | ≈ $2.7 | ≈ $10.2 |
| Fly API + Tigris + **external Postgres** (not researched) | Yes | < $1 + DB | — | ≈ $6 + DB |
| Render free web + free Postgres + Blob/R2 | No* | $0, **DB lost every 30 days** | — | — |
| Render paid web + paid Postgres + R2 | Yes | $13 | $13 | $16.50–$34.50 |

\* Render's card rule for free services and every Render price above are agent-reported: `render.com/pricing` renders client-side and could not be re-read. Re-check them before relying on them.

## Recommendation / Recomendación

**EN:** **Can we use Render? Yes, for a card-free demo. Plan to move to Fly for real users, unless the Postgres question changes the picture.**

1. **Today, with zero users:** Render's free web service, plus PR #6's Vercel Blob for audio. This is the only card-free topology that runs, and the Blueprint follows our convention almost end to end. **But do not use Render's free Postgres for anything you want to keep.** It deletes itself on a 30-day clock. Either accept a disposable demo, or put the database on an external free tier (next spike).
2. **At the first real user:** Fly API + Tigris + external Postgres is the cheapest durable topology found (≈ $6/mo at 100 users plus the database). It needs a card, and the code is already wired for it. Render's durable floor is $13/mo, and its stack spans three vendors.
3. **Do not run either host with PR #5's `fly postgres create`.** It is the cheap number in the runbook, but it sits on a deprecated template and a single unreplicated volume.

**The deciding unknown is the same in both columns: an external managed Postgres with a free tier that does not expire.** Neither spike researched it. That is the next spike.

**ES:** **¿Podemos usar Render? Sí, para un demo sin tarjeta.** Render gratis más Vercel Blob (PR #6) es lo único que corre sin tarjeta, pero su Postgres gratuito se borra cada 30 días: o el demo es desechable, o la base de datos vive fuera. Para usuarios reales, lo más barato y durable es Fly + Tigris + un Postgres externo (≈ $6/mes con 100 usuarios, más la base), y requiere tarjeta. Lo que decide en los dos casos es un Postgres externo gratuito que no caduque: es el siguiente spike.

## Open items / Pendientes

1. **Client-IP rate-limit key (affects both hosts, blocks real users).** Confirmed in code (`server/src/main.ts:44-50`): the login limiter keys on `Fly-Client-IP`, else the **last** `X-Forwarded-For` entry. Two problems follow:
   - **Fly:** because `vercel.json` rewrites `/api` through Vercel, Fly's direct client is Vercel's egress. `Fly-Client-IP` is then likely a Vercel address, not the visitor's.
   - **Render:** Render puts the client **first** in `X-Forwarded-For`, so the last entry is a proxy.

   Either way, every visitor may share a few buckets. This is the trust-proxy failure already seen on xilo-pro. It needs a code change, plus a header capture on a real deploy before a fix is chosen. **The runtime behaviour is not verified.**
2. **Spike: external Postgres.** Free tier that does not expire, region near `dfw`/Ohio, backups, connection limits, card requirement.
3. PR #5's stale claims are listed in `fly/SPIKE-fly.md` § 6. Whichever host wins, PR #5 needs a rewrite before it merges.
4. Not checked (ASSUMED in the spike docs): `dfw` price, the Tigris free tier through Fly, Fly spend caps, R2 pricing.
