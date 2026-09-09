CREATE TABLE users (id uuid PRIMARY KEY, email text NOT NULL UNIQUE);
CREATE TABLE profiles (
 id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 full_name text, gender text, birthdate text, avatar_url text, updated_at timestamptz
);
CREATE TABLE magic_links (hash text PRIMARY KEY, email text NOT NULL, expires_at timestamptz NOT NULL);
CREATE INDEX magic_links_expiry ON magic_links(expires_at);
CREATE TABLE link_throttle (email text PRIMARY KEY, last_request timestamptz NOT NULL, window_start timestamptz NOT NULL, requests integer NOT NULL);
CREATE TABLE sessions (hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE voice_notes (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title text NOT NULL, description text, audio_key text NOT NULL UNIQUE, audio_type text NOT NULL,
 duration double precision NOT NULL CHECK(duration >= 0), tags text[] NOT NULL DEFAULT '{}',
 transcript text, created_at timestamptz NOT NULL, UNIQUE(id, user_id)
);
CREATE INDEX voice_notes_owner ON voice_notes(user_id, created_at DESC);
CREATE TABLE documents (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 voice_note_id uuid NOT NULL UNIQUE, title text NOT NULL, content text NOT NULL,
 created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
 FOREIGN KEY(voice_note_id,user_id) REFERENCES voice_notes(id,user_id) ON DELETE CASCADE
);
CREATE TABLE object_deletions (key text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
