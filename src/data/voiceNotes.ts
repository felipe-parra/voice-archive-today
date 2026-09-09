import type { VoiceNote, Document, Profile, NotePatch, ProfilePatch, DocumentInput, DocumentPatch } from '../../shared/contracts'
import { api, jsonBody } from './api'
import { USE_FIXTURES } from './mode'
import { FIXTURE_DOCUMENTS, FIXTURE_PROFILE, FIXTURE_VOICE_NOTES } from './fixtures'
export const listVoiceNotes = async () => USE_FIXTURES ? [...FIXTURE_VOICE_NOTES] : api<VoiceNote[]>('/voice-notes')
export const getVoiceNote = async (id: string) => {
  if (!USE_FIXTURES) return api<VoiceNote>(`/voice-notes/${encodeURIComponent(id)}`)
  const note = FIXTURE_VOICE_NOTES.find(n => n.id === id)
  if (!note) throw new Error('Voice note not found')
  return note
}
export const getDocumentForVoiceNote = async (id: string) => USE_FIXTURES ? FIXTURE_DOCUMENTS.find(d => d.voice_note_id === id) || null : api<Document | null>(`/voice-notes/${encodeURIComponent(id)}/document`)
export const getProfile = async (_userId?: string): Promise<Profile> => USE_FIXTURES ? { id: 'demo-user', full_name: FIXTURE_PROFILE.full_name, gender: FIXTURE_PROFILE.gender, birthdate: '1993-05-01', avatar_url: FIXTURE_PROFILE.avatar_url, updated_at: null } : api<Profile>('/profile')
export const updateProfile = (patch: ProfilePatch) => api<Profile>('/profile', { method: 'PATCH', body: jsonBody(patch) })
export const updateVoiceNote = (id: string, patch: NotePatch) => api<VoiceNote>(`/voice-notes/${encodeURIComponent(id)}`, { method: 'PATCH', body: jsonBody(patch) })
export const deleteVoiceNote = (id: string) => api<void>(`/voice-notes/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const transcribeVoiceNote = (id: string) => api<{ transcript: string }>(`/voice-notes/${encodeURIComponent(id)}/transcribe`, { method: 'POST' })
export const summarizeVoiceNote = (id: string) => api<Document>(`/voice-notes/${encodeURIComponent(id)}/summary`, { method: 'POST' })
export const getDocument = (id: string) => api<Document>(`/documents/${encodeURIComponent(id)}`)
export const createDocument = (input: DocumentInput) => api<Document>('/documents', { method: 'POST', body: jsonBody(input) })
export const updateDocument = (id: string, patch: DocumentPatch) => api<Document>(`/documents/${encodeURIComponent(id)}`, { method: 'PATCH', body: jsonBody(patch) })
export const emailDocument = (id: string, to: string) => api<{ ok: true }>(`/documents/${encodeURIComponent(id)}/email`, { method: 'POST', body: jsonBody({ to }) })
export const uploadVoiceNote = (audio: Blob, title: string, duration: number, fileName = 'recording.webm') => {
  const data = new FormData()
  data.append('audio', audio, fileName)
  data.append('title', title)
  data.append('duration', String(duration))
  return api<VoiceNote>('/voice-notes', { method: 'POST', body: data })
}
