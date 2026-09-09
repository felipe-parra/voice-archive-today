import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { DocumentEditor } from '@/components/DocumentEditor'
import { VoiceNoteMetadata } from '@/components/voice-note/VoiceNoteMetadata'
import { AudioPlayer } from '@/components/voice-note/AudioPlayer'
import { TranscriptDisplay } from '@/components/voice-note/TranscriptDisplay'
import { SummarizeButton } from '@/components/voice-note/SummarizeButton'
import { LoadingSpinner } from '@/components/voice-note/LoadingSpinner'
import { NotFoundMessage } from '@/components/voice-note/NotFoundMessage'
import { useToast } from '@/components/ui/use-toast'
import { useAuthGuard } from '@/data/auth'
import { useVoiceNoteData } from '@/hooks/useVoiceNoteData'

const VoiceNoteDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const isAuthenticated = useAuthGuard()

  const {
    voiceNote,
    document,
    isLoadingVoiceNote,
    isLoadingDocument,
    voiceNoteError,
    documentError,
    updateVoiceNoteTranscript,
  } = useVoiceNoteData(isAuthenticated ? id : undefined)

  useEffect(() => {
    if (voiceNoteError || documentError) {
      toast({
        title: 'Error loading data',
        description: 'Failed to load voice note or document details',
        variant: 'destructive',
      })
    }
  }, [voiceNoteError, documentError, toast])

  if (isLoadingVoiceNote || isLoadingDocument) {
    return <LoadingSpinner />
  }

  if (!voiceNote && !isLoadingVoiceNote) {
    return <NotFoundMessage />
  }

  return (
    <AppShell>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="va-text-link inline-flex items-center gap-2 text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="mx-auto mt-8 max-w-4xl space-y-8">
        <VoiceNoteMetadata
          title={voiceNote?.title || ''}
          createdAt={voiceNote?.created_at || new Date().toISOString()}
          duration={voiceNote?.duration}
          tags={voiceNote?.tags}
          description={voiceNote?.description}
        />

        <AudioPlayer audioUrl={voiceNote?.audio_url || ''} />

        <div className="space-y-4">
          <TranscriptDisplay
            transcript={voiceNote?.transcript || ''}
            voiceNoteId={id || ''}
            onTranscriptCreated={updateVoiceNoteTranscript}
          />

          {voiceNote?.transcript && (
            <SummarizeButton
              transcript={voiceNote.transcript}
              documentId={document?.id}
              voiceNoteId={id || ''}
              title={voiceNote.title || ''}
            />
          )}
        </div>

        {id && (
          <DocumentEditor
            key={id}
            initialContent={document?.content}
            documentId={document?.id}
            voiceNoteId={id}
            title={voiceNote?.title || 'New Document'}
          />
        )}
      </div>
    </AppShell>
  )
}

export default VoiceNoteDetail
