import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { FileText } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface SummarizeButtonProps {
  transcript: string
  documentId?: string
  voiceNoteId: string
  title: string
}

export const SummarizeButton = ({
  transcript,
  documentId,
  voiceNoteId,
  title,
}: SummarizeButtonProps) => {
  const [isSummarizing, setIsSummarizing] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const handleSummarize = async () => {
    setIsSummarizing(true)
    try {
      console.log('Calling summarize-transcript function...')
      const { data, error } = await supabase.functions.invoke(
        'summarize-transcript',
        {
          body: { transcript },
        }
      )

      if (error) throw error

      console.log('Summary generated:', data)
      const { summary } = data

      if (documentId) {
        const { error: updateError } = await supabase
          .from('documents')
          .update({ content: summary })
          .eq('id', documentId)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase.from('documents').insert({
          content: summary,
          voice_note_id: voiceNoteId,
          title,
        })

        if (insertError) throw insertError
      }

      // Invalidate both the document query and the specific document content
      await queryClient.invalidateQueries({
        queryKey: ['document', voiceNoteId],
      })
      await queryClient.invalidateQueries({
        queryKey: ['documentContent', documentId],
      })

      toast({
        title: 'Success',
        description: 'Transcript has been summarized and added to the document',
      })
    } catch (error) {
      console.error('Error summarizing transcript:', error)
      toast({
        title: 'Error',
        description: 'Failed to summarize transcript',
        variant: 'destructive',
      })
    } finally {
      setIsSummarizing(false)
    }
  }

  return (
    <Button
      variant="secondary"
      onClick={handleSummarize}
      disabled={isSummarizing}
      className="w-full"
    >
      <FileText className="mr-2 h-4 w-4" />
      {isSummarizing ? 'Summarizing...' : 'Summarize Transcript'}
    </Button>
  )
}
