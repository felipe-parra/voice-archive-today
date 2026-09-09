import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Repository, User, Profile, ProfilePatch, StoredNote, NotePatch, StoredDocument, DocumentInput, DocumentPatch } from '../domain/ports.js';

function serialize<T>(row: Record<string, unknown> | undefined): T | null {
  if (!row) return null;
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v])) as T;
}
export class PostgresRepository implements Repository {
  private pool: pg.Pool;
  constructor(connectionString: string) { this.pool = new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000, statement_timeout: 15000 }); }
  async migrate() {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(74923018)');
      await client.query('CREATE TABLE IF NOT EXISTS schema_migrations(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
      const exists = await client.query('SELECT version FROM schema_migrations WHERE version=1');
      if (!exists.rowCount) {
        const sql = await readFile(new URL('../../migrations/001_initial.sql', import.meta.url), 'utf8');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(version) VALUES(1)');
      }
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async health() { await this.pool.query('SELECT 1'); }
  async close() { await this.pool.end(); }
  async requestLink(email: string, hash: string, expires: Date, now: Date) {
    email = email.trim().toLowerCase();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Expired authentication material and stale throttle rows have bounded retention.
      await client.query('DELETE FROM magic_links WHERE expires_at <= $1', [now]);
      await client.query('DELETE FROM sessions WHERE expires_at <= $1', [now]);
      await client.query("DELETE FROM link_throttle WHERE last_request < $1::timestamptz - interval '1 day'", [now]);
      const allowed = await client.query(`INSERT INTO link_throttle(email,last_request,window_start,requests) VALUES($1,$2,$2,1)
        ON CONFLICT(email) DO UPDATE SET last_request=$2,
          window_start=CASE WHEN link_throttle.window_start <= $2::timestamptz - interval '1 hour' THEN $2 ELSE link_throttle.window_start END,
          requests=CASE WHEN link_throttle.window_start <= $2::timestamptz - interval '1 hour' THEN 1 ELSE link_throttle.requests+1 END
        WHERE link_throttle.last_request <= $2::timestamptz - interval '60 seconds'
          AND (link_throttle.window_start <= $2::timestamptz - interval '1 hour' OR link_throttle.requests < 5)
        RETURNING email`, [email, now]);
      if (allowed.rowCount) await client.query('INSERT INTO magic_links(hash,email,expires_at) VALUES($1,$2,$3)', [hash,email,expires]);
      await client.query('COMMIT');
      return Boolean(allowed.rowCount);
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async revokeLink(hash: string) { await this.pool.query('DELETE FROM magic_links WHERE hash=$1',[hash]); }
  async consumeLink(hash: string, sessionHash: string, expires: Date, now: Date): Promise<User | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const token = await client.query('DELETE FROM magic_links WHERE hash=$1 AND expires_at > $2 RETURNING email',[hash,now]);
      if (!token.rowCount) { await client.query('COMMIT'); return null; }
      const result = await client.query('INSERT INTO users(id,email) VALUES($1,$2) ON CONFLICT(email) DO UPDATE SET email=EXCLUDED.email RETURNING id,email',[randomUUID(),token.rows[0].email]);
      const user = result.rows[0] as User;
      await client.query('INSERT INTO profiles(id,updated_at) VALUES($1,$2) ON CONFLICT(id) DO NOTHING',[user.id,now]);
      await client.query('INSERT INTO sessions(hash,user_id,expires_at) VALUES($1,$2,$3)',[sessionHash,user.id,expires]);
      await client.query('COMMIT'); return user;
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async getSession(hash: string, now: Date) { return serialize<User>((await this.pool.query('SELECT u.id,u.email FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.hash=$1 AND s.expires_at > $2',[hash,now])).rows[0]); }
  async deleteSession(hash: string) { await this.pool.query('DELETE FROM sessions WHERE hash=$1',[hash]); }
  async getProfile(userId: string) { return serialize<Profile>((await this.pool.query('SELECT * FROM profiles WHERE id=$1',[userId])).rows[0]); }
  private async patch<T>(table: string, ownerColumn: string, userId: string, id: string, patch: object, allowed: string[], timestamp = false): Promise<T | null> {
    const entries = Object.entries(patch).filter(([key,value]) => allowed.includes(key) && value !== undefined);
    const values: unknown[] = [id,userId];
    const sets = entries.map(([key,value]) => { values.push(value); return `${key}=$${values.length}`; });
    if (timestamp) sets.push('updated_at=now()');
    const sql = sets.length ? `UPDATE ${table} SET ${sets.join(',')} WHERE id=$1 AND ${ownerColumn}=$2 RETURNING *` : `SELECT * FROM ${table} WHERE id=$1 AND ${ownerColumn}=$2`;
    return serialize<T>((await this.pool.query(sql,values)).rows[0]);
  }
  async updateProfile(userId: string, patch: ProfilePatch) { return this.patch<Profile>('profiles','id',userId,userId,patch,['full_name','gender','birthdate','avatar_url'],true); }
  async listNotes(userId: string) { return (await this.pool.query('SELECT * FROM voice_notes WHERE user_id=$1 ORDER BY created_at DESC',[userId])).rows.map(row => serialize<StoredNote>(row)!); }
  async getNote(userId: string,id: string) { return serialize<StoredNote>((await this.pool.query('SELECT * FROM voice_notes WHERE user_id=$1 AND id=$2',[userId,id])).rows[0]); }
  async insertNote(note: StoredNote) {
    return serialize<StoredNote>((await this.pool.query(`INSERT INTO voice_notes(id,user_id,title,description,audio_key,audio_type,duration,tags,transcript,created_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[note.id,note.user_id,note.title,note.description,note.audio_key,note.audio_type,note.duration,note.tags,note.transcript,note.created_at])).rows[0])!;
  }
  async updateNote(userId: string,id: string,patch: NotePatch) { return this.patch<StoredNote>('voice_notes','user_id',userId,id,patch,['title','description','tags','transcript']); }
  async deleteNote(userId: string,id: string) {
    const result = await this.pool.query(`WITH deleted AS (DELETE FROM voice_notes WHERE user_id=$1 AND id=$2 RETURNING audio_key)
      INSERT INTO object_deletions(key) SELECT audio_key FROM deleted ON CONFLICT(key) DO NOTHING RETURNING key`,[userId,id]);
    return Boolean(result.rowCount);
  }
  async enqueueDelete(key: string) { await this.pool.query('INSERT INTO object_deletions(key) VALUES($1) ON CONFLICT(key) DO NOTHING',[key]); }
  async getDocument(userId: string,id: string) { return serialize<StoredDocument>((await this.pool.query('SELECT * FROM documents WHERE user_id=$1 AND id=$2',[userId,id])).rows[0]); }
  async getNoteDocument(userId: string,noteId: string) { return serialize<StoredDocument>((await this.pool.query('SELECT * FROM documents WHERE user_id=$1 AND voice_note_id=$2',[userId,noteId])).rows[0]); }
  async saveDocument(userId: string,input: DocumentInput) {
    return serialize<StoredDocument>((await this.pool.query(`INSERT INTO documents(id,user_id,voice_note_id,title,content,created_at,updated_at)
      SELECT $1,$2,id,$4,$5,now(),now() FROM voice_notes WHERE id=$3 AND user_id=$2
      ON CONFLICT(voice_note_id) DO UPDATE SET title=EXCLUDED.title,content=EXCLUDED.content,updated_at=now()
      WHERE documents.user_id=$2 RETURNING *`,[randomUUID(),userId,input.voice_note_id,input.title,input.content])).rows[0]);
  }
  async updateDocument(userId: string,id: string,patch: DocumentPatch) { return this.patch<StoredDocument>('documents','user_id',userId,id,patch,['title','content'],true); }
  async pendingDeletes() { return (await this.pool.query('SELECT key FROM object_deletions ORDER BY created_at LIMIT 100')).rows.map(row => row.key as string); }
  async completeDelete(key: string) { await this.pool.query('DELETE FROM object_deletions WHERE key=$1',[key]); }
}
