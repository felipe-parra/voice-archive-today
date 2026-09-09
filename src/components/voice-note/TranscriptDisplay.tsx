import React from 'react'
import { Speech } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { transcribeVoiceNote } from '@/data/voiceNotes'
import { USE_FIXTURES } from '@/data/mode'

interface TranscriptDisplayProps {
  transcript: string
  voiceNoteId: string
  onTranscriptCreated?: (transcript: string) => void
}

export const TranscriptDisplay = ({
  transcript,
  voiceNoteId,
  onTranscriptCreated,
}: TranscriptDisplayProps) => {
  const { toast } = useToast()
  const [isCreating, setIsCreating] = React.useState(false)

  const createTranscript = async () => {
    if (USE_FIXTURES) {
      toast({
        title: 'Demo mode',
        description: 'This action is disabled in the fixture preview.',
      })
      return
    }
    try {
      setIsCreating(true)

      const data = await transcribeVoiceNote(voiceNoteId)

      if (data.transcript) {
        onTranscriptCreated?.(data.transcript)
        toast({
          title: 'Success',
          description: 'Transcript created successfully',
        })
      }
    } catch (error) {
      console.error('Error creating transcript:', error)
      toast({
        title: 'Error',
        description: 'Failed to create transcript. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="va-note p-6 text-base">
      <span>Transcript</span>
      {transcript ? (
        <p className="whitespace-pre-wrap">{transcript}</p>
      ) : (
        <div className="mt-3 flex flex-col items-start gap-3">
          <p className="text-secondary-foreground">
            No transcript yet for this note.
          </p>
          <Button
            variant="default"
            onClick={createTranscript}
            disabled={isCreating}
            className="gap-2"
          >
            <Speech className="h-4 w-4" />
            {isCreating ? 'Creating…' : 'Create transcript'}
          </Button>
        </div>
      )}
    </div>
  )
}
