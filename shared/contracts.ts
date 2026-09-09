/** Public API DTOs. Keep browser-visible names independent of database columns. */
export interface User { id: string; email: string }
export interface Session { user: User }
export interface Profile {
  id: string; full_name: string | null; gender: string | null;
  birthdate: string | null; avatar_url: string | null; updated_at: string | null;
}
export interface VoiceNote {
  id: string; user_id: string; title: string; description: string | null;
  audio_url: string; duration: number; tags: string[]; transcript: string | null; created_at: string;
}
export interface Document {
  id: string; user_id: string; voice_note_id: string; title: string;
  content: string; markdown_url: string; created_at: string; updated_at: string;
}
export type NotePatch = Partial<Pick<VoiceNote, 'title' | 'description' | 'tags' | 'transcript'>>;
export type ProfilePatch = Partial<Omit<Profile, 'id' | 'updated_at'>>;
export interface DocumentInput { voice_note_id: string; title: string; content: string }
export type DocumentPatch = Partial<Pick<DocumentInput, 'title' | 'content'>>;
export interface ApiError { error: { code: string; message: string } }
