import React, { useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { createDocument, updateDocument } from '@/data/voiceNotes'
import { Button } from '@/components/ui/button'
import { Save } from 'lucide-react'
import '@mdxeditor/editor/style.css'
import {
  MDXEditor,
  type MDXEditorMethods,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  Separator,
} from '@mdxeditor/editor'
import { DocumentActions } from './voice-note/DocumentActions'
import { useQueryClient } from '@tanstack/react-query'
import { USE_FIXTURES } from '@/data/mode'

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
  const queryClient = useQueryClient()
  const [savedId, setSavedId] = useState(documentId)
  const [content, setContent] = useState(initialContent || '')
  const editorRef = useRef<MDXEditorMethods>(null)
  const markdownUrl = savedId ? `/api/documents/${encodeURIComponent(savedId)}/markdown` : null
  useEffect(() => {
    if (documentId) setSavedId(documentId)
  }, [documentId])
  useEffect(() => {
    setContent(initialContent || '')
    editorRef.current?.setMarkdown(initialContent || '')
  }, [initialContent, voiceNoteId])

  const saveContent = async () => {
    if (USE_FIXTURES) {
      toast({
        title: 'Demo mode',
        description: 'This action is disabled in the fixture preview.',
      })
      return
    }
    setIsSaving(true)
    try {
      const saved = savedId
        ? await updateDocument(savedId, { title, content })
        : await createDocument({ title, content, voice_note_id: voiceNoteId })
      setSavedId(saved.id)
      queryClient.setQueryData(['document', voiceNoteId], saved)

      toast({
        title: 'Success',
        description: documentId
          ? 'Document saved successfully'
          : 'Document created successfully',
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
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-semibold text-foreground">
          Document
        </h3>
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
      <div className="prose prose-stone max-w-none">
        <MDXEditor
          ref={editorRef}
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
                  {' '}
                  <UndoRedo />
                  <BoldItalicUnderlineToggles />
                  <Separator />
                  <BlockTypeSelect />
                </>
              ),
            }),
          ]}
          contentEditableClassName="min-h-[200px] p-4 bg-transparent rounded-md"
          className="mdxeditor"
        />
      </div>
      <DocumentActions documentId={savedId} markdownUrl={markdownUrl} />
    </div>
  )
}