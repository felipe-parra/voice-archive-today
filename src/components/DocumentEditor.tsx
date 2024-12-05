import { useEffect, useState } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Save } from 'lucide-react'
import '@mdxeditor/editor/style.css'
import { MDXEditor, headingsPlugin, listsPlugin, quotePlugin, thematicBreakPlugin, markdownShortcutPlugin, toolbarPlugin, UndoRedo, BoldItalicUnderlineToggles, BlockTypeSelect } from '@mdxeditor/editor'

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
  const [content, setContent] = useState(initialContent || '')

  const saveContent = async () => {
    setIsSaving(true)
    try {
      // Create a Blob from the markdown content
      const blob = new Blob([content], { type: 'text/markdown' })
      const file = new File([blob], `${title}.md`, { type: 'text/markdown' })
      
      // Upload to storage
      const userId = (await supabase.auth.getUser()).data.user?.id
      if (!userId) throw new Error('User not authenticated')
      
      const filePath = `${userId}/${voiceNoteId}/${file.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('markdown_files')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('markdown_files')
        .getPublicUrl(filePath)

      if (documentId) {
        const { error } = await supabase
          .from('documents')
          .update({ 
            content,
            markdown_url: publicUrl
          })
          .eq('id', documentId)

        if (error) throw error
      } else {
        const { error } = await supabase.from('documents').insert({
          content,
          markdown_url: publicUrl,
          voice_note_id: voiceNoteId,
          title,
        })

        if (error) throw error
      }

      toast({
        title: 'Success',
        description: documentId ? 'Document saved successfully' : 'Document created successfully',
      })
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
      <div className="prose prose-invert max-w-none">
        <MDXEditor
          markdown={content}
          onChange={setContent}
          plugins={[
            headingsPlugin(),
            listsPlugin(),
            quotePlugin(),
            thematicBreakPlugin(),
            markdownShortcutPlugin(),
            toolbarPlugin({
              toolbarContents: () => (
                <>
                  <UndoRedo />
                  <BoldItalicUnderlineToggles />
                  <BlockTypeSelect />
                </>
              )
            })
          ]}
          contentEditableClassName="min-h-[200px] p-4 bg-background/50 rounded-md text-foreground"
          className="mdxeditor !bg-background/50 !text-foreground [&_*]:!text-foreground [&_.toolbar]:!bg-accent [&_.toolbar]:border-primary/20 [&_.toolbar]:rounded-t-md [&_.toolbar]:p-2"
        />
      </div>
    </div>
  )
}