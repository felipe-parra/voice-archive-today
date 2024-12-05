export interface VoiceNote {
  id: string
  title: string
  audio_url: string
  created_at: string
  description?: string
  tags?: string[]
  transcript?: string
  documentId?: string
}
