import React from 'react'
import { FileText, Speech } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { supabase } from '@/integrations/supabase/client'

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
    try {
      setIsCreating(true)

      const { data, error } = await supabase.functions.invoke(
        'create-transcript',
        {
          body: { voiceNoteId },
        }
      )

      if (error) throw error

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

  if (!transcript) {
    return (
      <div className="rounded-lg bg-accent/50 p-6 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <FileText className="mr-2 h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-primary">Transcript</h3>
          </div>
          <Button
            variant="secondary"
            onClick={createTranscript}
            disabled={isCreating}
            className="flex items-center gap-2"
          >
            <Speech className="h-4 w-4" />
            {isCreating ? 'Creating...' : 'Create Transcript'}
          </Button>
        </div>
        <p className="text-gray-400 italic">No transcript available</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-accent/50 p-6 backdrop-blur-sm">
      <div className="flex items-center mb-4">
        <FileText className="mr-2 h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-primary">Transcript</h3>
      </div>
      <p className="text-gray-300 whitespace-pre-wrap">{transcript}</p>
    </div>
  )
}
