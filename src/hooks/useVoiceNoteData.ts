import { useQuery, useQueryClient } from '@tanstack/react-query'
import { VoiceNote } from '@/interfaces/voice.interface'
import { getVoiceNote, getDocumentForVoiceNote } from '@/data/voiceNotes'

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
      return getVoiceNote(id)
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
      return getDocumentForVoiceNote(id)
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
