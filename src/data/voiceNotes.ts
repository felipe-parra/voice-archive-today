import { supabase } from '@/integrations/supabase/client'
import { USE_FIXTURES } from './mode'
import {
  FIXTURE_DOCUMENTS,
  FIXTURE_PROFILE,
  FIXTURE_VOICE_NOTES,
} from './fixtures'

export const listVoiceNotes = async () => {
  if (USE_FIXTURES) {
    return [...FIXTURE_VOICE_NOTES]
  }

  const { data, error } = await supabase
    .from('voice_notes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error loading recordings:', error)
    throw error
  }
  return data || []
}

export const getVoiceNote = async (id: string) => {
  if (USE_FIXTURES) {
    const note = FIXTURE_VOICE_NOTES.find((n) => n.id === id)
    if (!note) throw new Error('Voice note not found')
    return note
  }

  const { data, error } = await supabase
    .from('voice_notes')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching voice note:', error)
    throw error
  }
  return data
}

export const getDocumentForVoiceNote = async (voiceNoteId: string) => {
  if (USE_FIXTURES) {
    return FIXTURE_DOCUMENTS.find((d) => d.voice_note_id === voiceNoteId) || null
  }

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('voice_note_id', voiceNoteId)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching document:', error)
    throw error
  }
  return data
}

export const getProfile = async (userId: string) => {
  if (USE_FIXTURES) {
    return {
      id: 'demo-user',
      full_name: FIXTURE_PROFILE.full_name,
      gender: FIXTURE_PROFILE.gender,
      birthdate: '1993-05-01',
      avatar_url: FIXTURE_PROFILE.avatar_url,
      updated_at: null,
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Error fetching profile:', error)
    throw error
  }
  return data
}
