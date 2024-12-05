import React, { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/integrations/supabase/client'
import { RecordingControls } from './RecordingControls'
import { VoiceNoteList } from './VoiceNoteList'
import { useToast } from '@/components/ui/use-toast'
import { useNavigate } from 'react-router-dom'

export const VoiceNote = () => {
  const [recordings, setRecordings] = useState<
    {
      id: string
      title: string
      audio_url: string
      created_at: string
      description?: string
      tags?: string[]
      transcript?: string
    }[]
  >([])
  const { toast } = useToast()
  const navigate = useNavigate()

  React.useEffect(() => {
    loadRecordings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadRecordings = async () => {
    try {
      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession()

      if (authError) {
        console.error('Auth error:', authError)
        toast({
          title: 'Authentication Error',
          description: 'Please try logging in again',
          variant: 'destructive',
        })
        navigate('/login')
        return
      }

      if (!session) {
        console.log('No session found')
        navigate('/login')
        return
      }

      console.log('Fetching recordings for user:', session.user.id)

      const { data, error } = await supabase
        .from('voice_notes')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading recordings:', error)
        toast({
          title: 'Error',
          description: 'Failed to load recordings. Please try again.',
          variant: 'destructive',
        })
        return
      }

      console.log('Loaded recordings:', data)
      setRecordings(data || [])
    } catch (error) {
      console.error('Unexpected error:', error)
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-8 text-center text-3xl font-bold text-primary">
          VoiceNote
        </h1>

        <Tabs defaultValue="record" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="record" className="text-lg">
              Record
            </TabsTrigger>
            <TabsTrigger value="notes" className="text-lg">
              Notes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="record" className="mt-8">
            <RecordingControls onRecordingComplete={loadRecordings} />
          </TabsContent>

          <TabsContent value="notes" className="mt-8">
            <VoiceNoteList recordings={recordings} onUpdate={loadRecordings} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
