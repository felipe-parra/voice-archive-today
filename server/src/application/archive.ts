import { randomUUID } from 'node:crypto';
import { AppError, type Dependencies, type StoredNote, type StoredDocument, type NotePatch, type ProfilePatch, type DocumentInput, type DocumentPatch } from '../domain/ports.js';

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const acceptedAudio = new Set(['audio/webm', 'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/ogg']);
const required = <T>(value: T | null): T => {
  if (value === null) throw new AppError(404, 'NOT_FOUND', 'Record not found.');
  return value;
};

export class ArchiveService {
  private activeAI = new Set<string>();
  constructor(private deps: Dependencies, private documentEmailEnabled: boolean) {}
  noteDTO(note: StoredNote) {
    const { audio_key: _key, audio_type: _type, ...dto } = note;
    return { ...dto, audio_url: `/api/voice-notes/${note.id}/audio` };
  }
  documentDTO(doc: StoredDocument) { return { ...doc, markdown_url: `/api/documents/${doc.id}/markdown` }; }
  async list(user: string) { return (await this.deps.repository.listNotes(user)).map(n => this.noteDTO(n)); }
  async get(user: string, id: string) { return this.noteDTO(required(await this.deps.repository.getNote(user, id))); }
  async profile(user: string) { return required(await this.deps.repository.getProfile(user)); }
  async updateProfile(user: string, patch: ProfilePatch) { return required(await this.deps.repository.updateProfile(user, patch)); }

  async upload(user: string, audio: Uint8Array, contentType: string, title: string, duration: number) {
    const type = contentType.split(';')[0].toLowerCase();
    if (!audio.length) throw new AppError(400, 'EMPTY_AUDIO', 'Choose a non-empty audio file.');
    if (audio.length > MAX_AUDIO_BYTES) throw new AppError(413, 'AUDIO_TOO_LARGE', 'Audio must be 25 MB or smaller.');
    if (!acceptedAudio.has(type)) throw new AppError(415, 'AUDIO_TYPE', 'Unsupported audio format.');
    const id = randomUUID();
    const key = `audio/${user}/${id}`;
    await this.deps.repository.enqueueDelete(key);
    try {
      await this.deps.storage.put(key, audio, type);
      const note = await this.deps.repository.insertNote({ id, user_id: user, title, duration,
        audio_key: key, audio_type: type, description: null, tags: [], transcript: null, created_at: this.deps.now().toISOString() });
      await this.deps.repository.completeDelete(key);
      return this.noteDTO(note);
    } catch (error) {
      // If the durable database insert fails, keep the key in the retry outbox when a best-effort delete also fails.
      try {
        await this.deps.storage.delete(key);
        await this.deps.repository.completeDelete(key);
      } catch {
        // Leave the key queued for the container retry loop while the storage/provider outage is resolved.
      }
      throw error;
    }
  }
  async update(user: string, id: string, patch: NotePatch) { return this.noteDTO(required(await this.deps.repository.updateNote(user, id, patch))); }
  async remove(user: string, id: string) {
    if (!await this.deps.repository.deleteNote(user, id)) throw new AppError(404, 'NOT_FOUND', 'Record not found.');
    // HTTP completion depends only on the durable transaction, not storage availability.
  }
  async cleanup() {
    for (const key of await this.deps.repository.pendingDeletes()) {
      try { await this.deps.storage.delete(key); await this.deps.repository.completeDelete(key); }
      catch { /* Durable outbox is retried by the container maintenance timer. */ }
    }
  }
  async audio(user: string, id: string, range?: { start?: number; end?: number }) {
    const note = required(await this.deps.repository.getNote(user, id));
    return range ? this.deps.storage.getRange(note.audio_key, range.start, range.end) : this.deps.storage.get(note.audio_key);
  }
  async document(user: string, id: string) { return this.documentDTO(required(await this.deps.repository.getDocument(user, id))); }
  async noteDocument(user: string, id: string) {
    required(await this.deps.repository.getNote(user, id));
    const doc = await this.deps.repository.getNoteDocument(user, id);
    return doc ? this.documentDTO(doc) : null;
  }
  async saveDocument(user: string, input: DocumentInput) { return this.documentDTO(required(await this.deps.repository.saveDocument(user, input))); }
  async updateDocument(user: string, id: string, input: DocumentPatch) { return this.documentDTO(required(await this.deps.repository.updateDocument(user, id, input))); }
  async markdown(user: string, id: string) {
    const doc = required(await this.deps.repository.getDocument(user, id));
    return { title: doc.title, markdown: `# ${doc.title.replace(/[\r\n]/g, ' ')}\n\n${doc.content}\n` };
  }
  async email(user: string, id: string, to: string) {
    const doc = await this.markdown(user, id);
    if (!this.documentEmailEnabled) throw new AppError(503, 'EMAIL_DISABLED', 'Document email is not enabled.');
    await this.deps.mailer.sendDocument(to, doc.title, doc.markdown);
  }
  private async exclusive<T>(key: string, action: () => Promise<T>): Promise<T> {
    if (this.activeAI.has(key)) throw new AppError(409, 'GENERATION_IN_PROGRESS', 'Generation is already in progress.');
    if (this.activeAI.size >= 4) throw new AppError(429, 'GENERATION_BUSY', 'Generation is busy. Try again shortly.');
    this.activeAI.add(key);
    try { return await action(); } finally { this.activeAI.delete(key); }
  }
  transcribe(user: string, id: string) {
    return this.exclusive(`${user}/${id}`, async () => {
      const note = required(await this.deps.repository.getNote(user, id));
      const audio = await this.deps.storage.get(note.audio_key);
      const transcript = await this.deps.intelligence.transcribe(audio.bytes, note.audio_type);
      required(await this.deps.repository.updateNote(user, id, { transcript }));
      return { transcript };
    });
  }
  summary(user: string, id: string) {
    return this.exclusive(`${user}/${id}`, async () => {
      const note = required(await this.deps.repository.getNote(user, id));
      if (!note.transcript?.trim()) throw new AppError(400, 'NO_TRANSCRIPT', 'Transcribe the recording first.');
      if (note.transcript.length > 100_000) throw new AppError(413, 'TRANSCRIPT_TOO_LARGE', 'Transcript is too long to summarize.');
      const content = await this.deps.intelligence.summarize(note.transcript);
      return this.saveDocument(user, { voice_note_id: id, title: note.title, content });
    });
  }
}
