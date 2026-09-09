# Deploy — Voice Archive backend

> **EN:** Production topology and the turnkey deploy for the `server/` container.
> **ES:** Topología de producción y el deploy llave-en-mano del contenedor `server/`.

## Topology / Topología

| Piece | Choice | Why |
|---|---|---|
| API container | **Fly.io** app `vat-api` (`iad`), from `server/Dockerfile` | Long-running process — the in-process delete-outbox loop and the server-wide AI concurrency cap need it. Vercel Functions was rejected: hard 4.5 MB request-body cap vs 25 MB audio uploads. |
| Database | **Fly Postgres** `vat-db` (single node, `shared-cpu-1x`, 1 GB volume) | Same vendor, one `fly` login. Migrations self-apply on boot (`server/src/main.ts` → `repository.migrate()`). |
| Object storage | **Fly Tigris** (`fly storage create`) | S3-compatible — the existing `S3ObjectStore` adapter talks to it unchanged. Range playback supported. |
| Transcription + summary | **Groq** (`whisper-large-v3-turbo` + `llama-3.3-70b-versatile`) | OpenAI-compatible API; the adapter gained a `baseUrl`. ~10× cheaper than OpenAI. |
| Magic-link email | **Resend** | `MAIL_MODE=resend` is required in production; needs a verified `MAIL_FROM` domain. |
| Frontend | **Vercel** (unchanged project), `vercel.json` rewrites `/api/*` → `https://vat-api.fly.dev/api/*` | Same-origin `/api` proxy → the `__Host-` session cookie and the `Origin` allow-list work without CORS juggling. |

Infra budget ceiling: **$5/mo.** Fly machine auto-stops when idle (`min_machines_running = 0`); realistic spend ≈ $2–4/mo.

## Prerequisites / Prerrequisitos

1. `flyctl` installed and `fly auth login` done.
2. A **Groq** API key — <https://console.groq.com> (free, no card).
3. A **Resend** API key + a verified sending domain — <https://resend.com>.
   Add the domain in Resend, publish the SPF/DKIM records at the DNS host for
   `felipeparra.dev`, then `Verify`. Until DNS propagates, Resend can send from
   `onboarding@resend.dev` to the account owner's own address only.

## Deploy / Despliegue

From the repo root, with `GROQ_KEY`, `RESEND_KEY`, `RESEND_FROM` exported:

```bash
APP=vat-api REGION=iad
WEB=https://voice-archive-today.vercel.app

fly apps create "$APP" --org personal

# Postgres — migrations run on first boot of the API, no release step
fly postgres create --name vat-db --region "$REGION" \
  --initial-cluster-size 1 --vm-size shared-cpu-1x --volume-size 1 --org personal
fly postgres attach vat-db --app "$APP"      # sets DATABASE_URL

# Tigris object storage — sets AWS_* secrets on the app
fly storage create --app "$APP" --name vat-audio
# then map them to the adapter's S3_* names (read current values with
# `fly ssh console -a $APP -C env` or the Tigris dashboard):
fly secrets set --app "$APP" --stage \
  S3_ENDPOINT="$AWS_ENDPOINT_URL_S3" S3_BUCKET="$BUCKET_NAME" \
  S3_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" S3_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY"

fly secrets set --app "$APP" \
  WEB_URL="$WEB" ALLOWED_ORIGINS="$WEB" \
  OPENAI_API_KEY="$GROQ_KEY" \
  OPENAI_BASE_URL="https://api.groq.com/openai/v1" \
  AI_TRANSCRIBE_MODEL="whisper-large-v3-turbo" \
  AI_SUMMARY_MODEL="llama-3.3-70b-versatile" \
  RESEND_API_KEY="$RESEND_KEY" MAIL_FROM="$RESEND_FROM" \
  DOCUMENT_EMAIL_ENABLED="false"

fly deploy --app "$APP" --ha=false
curl -fsS https://$APP.fly.dev/api/health          # {"ok":true}
```

## Cut over the frontend / Conmutar el frontend

```bash
# on the Vercel project (already linked):
vercel env rm VITE_USE_FIXTURES production        # or set it to false
vercel env add VITE_USE_FIXTURES production       # value: false
vercel deploy --prod
```

`vercel.json` already proxies `/api/*` to `vat-api.fly.dev`. Verify end to end on
`https://voice-archive-today.vercel.app`: request a sign-in link, click it, record
or upload a note, transcribe, summarize, play back.

Preview deployments keep `VITE_USE_FIXTURES=true` — their URLs rotate and cannot
be in `ALLOWED_ORIGINS`.

## Smoke test / Prueba de humo

```
POST /api/auth/magic-link {email}          -> 202 {ok:true}
POST /api/auth/verify {token}              -> {user} + Set-Cookie __Host-va_session
GET  /api/auth/session                     -> {user}
POST /api/voice-notes (multipart)          -> 201 VoiceNote
GET  /api/voice-notes/:id/audio            -> 200 ; Range -> 206 ; bytes=-N -> 206
POST /api/voice-notes/:id/transcribe       -> {transcript}
POST /api/voice-notes/:id/summary          -> Document
```

## Local stack / Stack local

`docker compose up -d --build` from the repo root brings up Postgres + MinIO +
the API on `localhost:3001` with `MAIL_MODE=development` (magic links written to
`/tmp/voice-archive-mail/` inside the API container). Mirrors the Fly topology.

## Rotate / Rotar

`OPENAI_API_KEY` (Groq) and `RESEND_API_KEY` are the only long-lived secrets.
The Supabase keys that used to sit in edge-function secrets are dead — the
project is decommissioned and `@supabase/*` is gone from this repo.
