# Container backend contract

Status: implementation in progress. Supersedes the earlier migration proposal where it conflicts.

Founder decisions (2026-09-09): start with an empty database; no legacy-data or password import. Login and signup both use email magic links. Passkeys are a future authentication adapter, not a v1 feature. Use layers and testable interfaces; avoid infrastructure churn.

Keep the Vite frontend at the repository root and the existing Vercel project. Add one API container in `server/`, a Postgres connection, and a private S3-compatible store. Local Compose supplies Postgres and MinIO; in `development` mail mode the API writes each message as a JSON file to a local inbox directory instead of calling a provider. No new queues, workers, auth SaaS or monorepo move. Production provider credentials and routing are deployment inputs, not hardcoded business rules.

Dependencies flow from HTTP to application services to domain ports. Adapters implement the ports; `main.ts` composes them. Domain/application code cannot import Hono, pg, AWS or provider SDKs. Public DTOs are in `shared/contracts.ts`.

All paths below are under `/api`. Successful responses are raw DTOs, errors are `{ error: { code, message } }`. `404` also covers another user's record. All data writes derive ownership from the session, never request bodies.

| Method | Path | Result |
| --- | --- | --- |
| GET | /health | readiness, 200 or 503 |
| POST | /auth/magic-link | `{email}` → generic 202 `{ok:true}`; sends a single-use link |
| POST | /auth/verify | `{token}` → `{user}`, sets HttpOnly session cookie |
| GET | /auth/session | `{user}` or null |
| POST | /auth/logout | 204, revokes session and clears cookie |
| GET / PATCH | /profile | Profile / patch → Profile |
| GET | /voice-notes | VoiceNote[] |
| POST | /voice-notes | multipart audio, title, duration → VoiceNote, 201 |
| GET / PATCH / DELETE | /voice-notes/:id | VoiceNote / patch → VoiceNote / 204 |
| GET | /voice-notes/:id/audio | authenticated audio bytes; Range playback supported |
| POST | /voice-notes/:id/transcribe | `{transcript}` |
| POST | /voice-notes/:id/summary | Document |
| GET | /voice-notes/:id/document | Document or null |
| GET / PATCH | /documents/:id | Document / patch → Document |
| POST | /documents | DocumentInput → Document, 201 (one per note) |
| GET | /documents/:id/markdown | authenticated markdown download |
| POST | /documents/:id/email | `{to}` → `{ok:true}`; disabled unless explicitly configured |

Notes retain frontend snake_case names. Audio URLs and markdown URLs are API paths. Markdown is rendered from the authoritative document row on download/email, avoiding a second persistent copy and synchronization failures. Audio storage remains private behind the storage port.

Upload limits: audio is 25 MB or smaller (`413`), one of webm/mpeg/mp3/mp4/m4a/wav/ogg (`415`), duration `0`–`86400` s; the HTTP body limit is that ceiling plus 64 KB. AI generation is serialized per note (`409`), capped at four concurrent server-wide (`429`), and rate-limited per user to five transcribe-or-summary calls and five document emails per minute; summary input is capped at 100000 characters. Re-running transcribe or summary overwrites the prior transcript or the single note document. `DELETE /voice-notes/:id` returns `204` on the durable database transaction alone; the audio object is purged asynchronously by an in-process retry loop backed by an outbox table, so completion never depends on storage availability and no separate worker is required.

Magic links carry random 256-bit tokens in the frontend URL fragment (`/auth/verify#token=...`). The confirmation screen removes the fragment and consumes via POST after an explicit click, so mail link scanners do not consume links on GET. Only hashes are persisted; expiry is 15 minutes, consumption is atomic, sessions expire after 30 days and can be revoked. Request throttling applies per email and at the HTTP boundary. A future verified passkey credential can issue the same sessions without changing notes or profile use cases.

Unsafe methods additionally require an allow-listed `Origin` header (`403`), so the reverse proxy must forward it. Prefer a same-origin `/api` reverse proxy to the container with a host-only Secure, HttpOnly, SameSite=Lax cookie. Exact allowed origins and production web URL are configuration. No wildcard preview origins or shared parent-domain cookie. Same-site app/api subdomains are another deployment option. Verify proxy cookies, uploads and AI timeout before cutover. Fixture mode remains available until a verified deployment replaces it.
