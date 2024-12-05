import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { VoiceNote } from '@/interfaces/voice.interface'

export const useVoiceNoteData = (id: string | undefined) => {
  const queryClient = useQueryClient()

  const {
    data: voiceNote,
    isLoading: isLoadingVoiceNote,
    error: voiceNoteError,
  } = useQuery({
    queryKey: ['voiceNote', id],
    queryFn: async () => {
      if (!id) throw new Error('No voice note ID provided')

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
    },
    enabled: !!id,
  })

  const {
    data: document,
    isLoading: isLoadingDocument,
    error: documentError,
  } = useQuery({
    queryKey: ['document', id],
    queryFn: async () => {
      if (!id) throw new Error('No voice note ID provided')

      console.log('Fetching document for voice note:', id)
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('voice_note_id', id)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching document:', error)
        throw error
      }
      console.log('Document data:', data)
      return data
    },
    enabled: !!id,
  })

  const updateVoiceNoteTranscript = (newTranscript: string) => {
    queryClient.setQueryData(['voiceNote', id], (oldData: VoiceNote) => ({
      ...oldData,
      transcript: newTranscript,
    }))
  }

  return {
    voiceNote,
    document,
    isLoadingVoiceNote,
    isLoadingDocument,
    voiceNoteError,
    documentError,
    updateVoiceNoteTranscript,
  }
}