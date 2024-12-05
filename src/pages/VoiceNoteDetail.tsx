import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { DocumentEditor } from '@/components/DocumentEditor'
import { VoiceNoteMetadata } from '@/components/voice-note/VoiceNoteMetadata'
import { AudioPlayer } from '@/components/voice-note/AudioPlayer'
import { TranscriptDisplay } from '@/components/voice-note/TranscriptDisplay'
import { SummarizeButton } from '@/components/voice-note/SummarizeButton'
import { LoadingSpinner } from '@/components/voice-note/LoadingSpinner'
import { NotFoundMessage } from '@/components/voice-note/NotFoundMessage'
import { useToast } from '@/components/ui/use-toast'
import { supabase } from '@/integrations/supabase/client'
import { useVoiceNoteData } from '@/hooks/useVoiceNoteData'

const VoiceNoteDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()

  const {
    voiceNote,
    document,
    isLoadingVoiceNote,
    isLoadingDocument,
    voiceNoteError,
    documentError,
    updateVoiceNoteTranscript,
  } = useVoiceNoteData(id)

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        toast({
          title: 'Authentication required',
          description: 'Please log in to view this page',
          variant: 'destructive',
        })
        navigate('/login')
      }
    }
    checkAuth()
  }, [navigate, toast])

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
    <div className="min-h-screen bg-accent p-4 md:p-8">
      <Button variant="ghost" className="mb-6" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="mx-auto max-w-4xl space-y-8">
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
            initialContent={document?.content}
            documentId={document?.id}
            voiceNoteId={id}
            title={voiceNote?.title || 'New Document'}
          />
        )}
      </div>
    </div>
  )
}

export default VoiceNoteDetail
