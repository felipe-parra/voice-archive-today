import React, { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RecordingControls } from './RecordingControls'
import { VoiceNoteList } from './VoiceNoteList'
import { useToast } from '@/components/ui/use-toast'
import { listVoiceNotes } from '@/data/voiceNotes'
import { VoiceNote as VoiceNoteType } from '@/interfaces/voice.interface'

export const VoiceNote = () => {
  const [recordings, setRecordings] = useState<VoiceNoteType[]>([])
  const { toast } = useToast()

  React.useEffect(() => {
    loadRecordings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadRecordings = async () => {
    try {
      const data = await listVoiceNotes()
      setRecordings((data as VoiceNoteType[]) || [])
    } catch (error) {
      console.error('Unexpected error:', error)
      toast({
        title: 'Error',
        description: 'Failed to load recordings. Please try again.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div>
      <p className="va-eyebrow">Your archive</p>
      <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground md:text-5xl">
        voice-archive-today
      </h1>

      <Tabs defaultValue="record" className="mt-10 w-full">
        <TabsList>
          <TabsTrigger value="record">Record</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="record" className="mt-10">
          <RecordingControls onRecordingComplete={loadRecordings} />
        </TabsContent>

        <TabsContent value="notes" className="mt-10">
          <VoiceNoteList recordings={recordings} onUpdate={loadRecordings} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
