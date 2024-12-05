import { useEffect, useState } from 'react'
import { BlockNoteView, useCreateBlockNote } from '@blocknote/react'
import { useToast } from '@/components/ui/use-toast'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Save } from 'lucide-react'
import '@blocknote/core/style.css'

interface DocumentEditorProps {
  initialContent?: string
  documentId?: string
  voiceNoteId: string
  title: string
}

export const DocumentEditor = ({
  initialContent,
  documentId,
  voiceNoteId,
  title,
}: DocumentEditorProps) => {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)

  // Safely parse the initial content
  const parseInitialContent = () => {
    if (!initialContent) return undefined
    try {
      return JSON.parse(initialContent)
    } catch (error) {
      console.error('Error parsing initial content:', error)
      return undefined
    }
  }

  const editor = useCreateBlockNote({
    initialContent: parseInitialContent(),
  })

  const saveContent = async () => {
    if (!editor) return

    setIsSaving(true)
    try {
      // Get the content safely
      const blocks = editor.topLevelBlocks
      const content = JSON.stringify(blocks)

      if (documentId) {
        const { error } = await supabase
          .from('documents')
          .update({ content })
          .eq('id', documentId)

        if (error) throw error

        toast({
          title: 'Success',
          description: 'Document saved successfully',
        })
      } else {
        const { error } = await supabase.from('documents').insert({
          content,
          voice_note_id: voiceNoteId,
          title,
        })

        if (error) throw error

        toast({
          title: 'Success',
          description: 'Document created successfully',
        })
      }
    } catch (error) {
      console.error('Error saving document:', error)
      toast({
        title: 'Error',
        description: 'Failed to save document',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    if (!editor) return

    let timeoutId: NodeJS.Timeout

    const handleContentChange = () => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(saveContent, 5000)
    }

    editor.onEditorContentChange(handleContentChange)

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      editor.onEditorContentChange(null)
    }
  }, [editor, documentId, voiceNoteId, title])

  return (
    <div className="rounded-lg bg-accent/50 p-6 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-primary">Document</h3>
        <Button 
          onClick={saveContent} 
          disabled={isSaving}
          variant="outline"
          size="sm"
        >
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
      <BlockNoteView editor={editor} theme="dark" />
    </div>
  )
}