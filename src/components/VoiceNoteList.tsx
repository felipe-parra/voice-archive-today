import { Button } from '@/components/ui/button'
import { Play, Edit2, FileText } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { EditVoiceNoteForm } from './EditVoiceNoteForm'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/components/ui/use-toast'

interface VoiceNote {
  id: string
  title: string
  audio_url: string
  created_at: string
  description?: string
  tags?: string[]
  transcript?: string
}

interface VoiceNoteListProps {
  recordings: VoiceNote[]
  onUpdate: () => void
}

export const VoiceNoteList = ({ recordings, onUpdate }: VoiceNoteListProps) => {
  const [selected, setSelected] = useState<VoiceNote | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState<string | null>(null)
  const navigate = useNavigate()
  const { toast } = useToast()

  const playRecording = (url: string) => {
    const audio = new Audio(url)
    audio.play()
  }

  const handleCloseSidebar = () => {
    setIsSidebarOpen(false)
    onUpdate()
  }

  const transcribeAudio = async (voiceNote: VoiceNote) => {
    try {
      setIsTranscribing(voiceNote.id)
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: {
          audioUrl: voiceNote.audio_url,
          voiceNoteId: voiceNote.id,
        },
      })

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Audio transcribed successfully!',
      })

      onUpdate()
    } catch (error) {
      console.error('Error transcribing audio:', error)
      toast({
        title: 'Error',
        description: 'Failed to transcribe audio. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsTranscribing(null)
    }
  }

  return (
    <div className="space-y-4">
      {recordings.map((recording) => (
        <div
          key={recording.id}
          className="flex items-center justify-between rounded-lg bg-accent/50 p-4 backdrop-blur-sm"
        >
          <div
            className="flex-grow cursor-pointer"
            onClick={() => navigate(`/voice-note/${recording.id}`)}
          >
            <p className="text-primary">{recording.title}</p>
            {recording.description && (
              <p className="text-sm text-gray-500 mt-1">
                {recording.description}
              </p>
            )}
            {recording.tags && recording.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {recording.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <p className="text-sm text-gray-400 mt-2">
              {new Date(recording.created_at).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => playRecording(recording.audio_url)}
            >
              <Play className="h-4 w-4" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => transcribeAudio(recording)}
              disabled={isTranscribing === recording.id}
            >
              <FileText className={`h-4 w-4 ${isTranscribing === recording.id ? 'animate-pulse' : ''}`} />
            </Button>

            <Sheet
              open={isSidebarOpen}
              onOpenChange={(open) => {
                setIsSidebarOpen(open)
                if (!open) {
                  setSelected(null)
                }
              }}
            >
              <SheetTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => {
                    setSelected(recording)
                  }}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Edit Voice Note</SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  {selected ? (
                    <EditVoiceNoteForm
                      voiceNote={selected}
                      onClose={handleCloseSidebar}
                    />
                  ) : (
                    <p>No voice note selected</p>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      ))}

      {recordings.length === 0 && (
        <div className="text-center text-gray-400">
          <p>No recordings yet</p>
        </div>
      )}
    </div>
  )
}