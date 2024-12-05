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

  const editor = useCreateBlockNote({
    initialContent: initialContent ? JSON.parse(initialContent) : undefined,
  })

  const saveContent = async () => {
    if (!editor) return

    setIsSaving(true)
    const content = JSON.stringify(editor.topLevelBlocks)
    console.log('Saving content:', content)

    try {
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
      // Clear any existing timeout
      if (timeoutId) clearTimeout(timeoutId)

      // Set new timeout for debouncing
      timeoutId = setTimeout(saveContent, 5000) // Autosave after 5 seconds of no changes
    }

    // Subscribe to content changes
    editor.onEditorContentChange(handleContentChange)

    // Cleanup
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