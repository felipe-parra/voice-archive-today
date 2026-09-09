import { useState, useRef } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { AudioRecorder } from '@/utils/audioRecorder'
import { supabase } from '@/integrations/supabase/client'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AudioFileUpload } from './AudioFileUpload'
import { USE_FIXTURES } from '@/data/mode'

interface RecordingControlsProps {
  onRecordingComplete: () => void
}

const WAVE_BARS = Array.from({ length: 32 }, (_, i) => 12 + ((i * 17) % 42))

export const RecordingControls = ({
  onRecordingComplete,
}: RecordingControlsProps) => {
  const [searchParams] = useSearchParams()
  const demoRecording =
    USE_FIXTURES && searchParams.get('demo') === 'recording'

  const [isRecording, setIsRecording] = useState(demoRecording)
  const [isLoading, setIsLoading] = useState(false)
  const recorderRef = useRef<AudioRecorder>(new AudioRecorder())
  const { toast } = useToast()
  const navigate = useNavigate()

  const demoGuard = () => {
    if (USE_FIXTURES) {
      toast({
        title: 'Demo mode',
        description: 'This action is disabled in the fixture preview.',
      })
      return true
    }
    return false
  }

  const startRecording = async () => {
    if (demoGuard()) return
    try {
      await recorderRef.current.startRecording()
      setIsRecording(true)
    } catch (error) {
      toast({
        title: 'Error',
        description:
          'Could not access microphone. Please ensure you have granted permission.',
        variant: 'destructive',
      })
    }
  }

  const stopRecording = async () => {
    if (demoGuard()) return
    try {
      setIsLoading(true)
      const audioBlob = await recorderRef.current.stopRecording()
      setIsRecording(false)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const fileName = `${user.id}/recording-${Date.now()}.webm`

      const { error: uploadError } = await supabase.storage
        .from('voice_notes')
        .upload(fileName, audioBlob)

      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from('voice_notes').getPublicUrl(fileName)

      const { data: noteData, error: dbError } = await supabase
        .from('voice_notes')
        .insert({
          title: `Recording ${new Date().toLocaleTimeString()}`,
          audio_url: publicUrl,
          duration: 0,
          user_id: user.id,
        })
        .select()
        .single()

      if (dbError) throw dbError

      onRecordingComplete()
      toast({
        title: 'Success',
        description: 'Voice note saved successfully!',
      })

      navigate(`/voice-note/${noteData.id}`)
    } catch (error) {
      console.error('Error saving recording:', error)
      toast({
        title: 'Error',
        description: 'Failed to save recording. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-10">
      <article className="va-specimen mx-auto w-full max-w-[470px]">
        <div className="va-specimen-top">
          <strong>〰 new note</strong>
          <span>{isRecording ? 'REC' : '00:00'}</span>
        </div>

        <p className="va-eyebrow mt-4">Capture</p>
        <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-foreground">
          Speak now. Sort it later.
        </h2>

        <div
          className="va-wave mt-6"
          data-recording={isRecording ? 'true' : 'false'}
          aria-hidden="true"
        >
          {WAVE_BARS.map((h, i) => (
            <i key={i} style={{ height: `${h}px` }} />
          ))}
        </div>

        <div className="va-note mt-6">
          <span>Live transcript</span>
          <p>
            {isRecording ? 'Listening…' : 'Press the mic to start a note.'}
          </p>
        </div>
      </article>

      <div className="flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isLoading}
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          className="va-mic disabled:opacity-60"
          data-recording={isRecording ? 'true' : 'false'}
        >
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : isRecording ? (
            <Square className="h-6 w-6" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </button>

        <AudioFileUpload onUploadComplete={onRecordingComplete} />
      </div>
    </div>
  )
}
