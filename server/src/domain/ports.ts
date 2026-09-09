import type { User, Profile, ProfilePatch, VoiceNote, NotePatch, Document, DocumentInput, DocumentPatch } from '../../../shared/contracts.js';
export type { User, Profile, ProfilePatch, VoiceNote, NotePatch, Document, DocumentInput, DocumentPatch };
export type StoredNote = Omit<VoiceNote, 'audio_url'> & { audio_key: string; audio_type: string };
export type StoredDocument = Omit<Document, 'markdown_url'>;
/** Every data method scopes by authenticated user, including linked records. */
export interface Repository {
  health(): Promise<void>;
  close(): Promise<void>;
  requestLink(email: string, hash: string, expires: Date, now: Date): Promise<boolean>;
  revokeLink(hash: string): Promise<void>;
  /** Atomic consume + create verified user/profile + session. False on expired/replayed token. */
  consumeLink(hash: string, sessionHash: string, expires: Date, now: Date): Promise<User | null>;
  getSession(hash: string, now: Date): Promise<User | null>;
  deleteSession(hash: string): Promise<void>;
  getProfile(userId: string): Promise<Profile | null>;
  updateProfile(userId: string, patch: ProfilePatch): Promise<Profile | null>;
  listNotes(userId: string): Promise<StoredNote[]>;
  getNote(userId: string, id: string): Promise<StoredNote | null>;
  insertNote(note: StoredNote): Promise<StoredNote>;
  updateNote(userId: string, id: string, patch: NotePatch): Promise<StoredNote | null>;
  /** Delete database rows and enqueue audio key for durable cleanup in the same transaction. */
  deleteNote(userId: string, id: string): Promise<boolean>;
  enqueueDelete(key: string): Promise<void>;
  getDocument(userId: string, id: string): Promise<StoredDocument | null>;
  getNoteDocument(userId: string, noteId: string): Promise<StoredDocument | null>;
  /** One document per note; linked note ownership must be checked atomically. */
  saveDocument(userId: string, input: DocumentInput): Promise<StoredDocument | null>;
  updateDocument(userId: string, id: string, patch: DocumentPatch): Promise<StoredDocument | null>;
  pendingDeletes(): Promise<string[]>;
  completeDelete(key: string): Promise<void>;
}
export interface ObjectStore {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<{ bytes: Uint8Array; contentType: string; length: number }>;
  getRange(key: string, start?: number, end?: number): Promise<{ bytes: Uint8Array; contentType: string; length: number }>;
  delete(key: string): Promise<void>;
}
export interface Intelligence {
  transcribe(bytes: Uint8Array, contentType: string): Promise<string>;
  summarize(transcript: string): Promise<string>;
}
export interface Mailer {
  sendLink(email: string, url: string): Promise<void>;
  sendDocument(email: string, title: string, markdown: string): Promise<void>;
}
export interface Dependencies { repository: Repository; storage: ObjectStore; intelligence: Intelligence; mailer: Mailer; now: () => Date }
export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
