import { useEffect } from "react";
import { BlockNoteEditor } from "@blocknote/core";
import { BlockNoteView, useBlockNote } from "@blocknote/react";
import "@blocknote/core/style.css";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface DocumentEditorProps {
  initialContent?: string;
  documentId?: string;
  voiceNoteId: string;
  title: string;
}

export const DocumentEditor = ({ initialContent, documentId, voiceNoteId, title }: DocumentEditorProps) => {
  const { toast } = useToast();
  
  const editor: BlockNoteEditor = useBlockNote({
    initialContent: initialContent ? JSON.parse(initialContent) : undefined,
  });

  useEffect(() => {
    if (!editor) return;

    let timeoutId: NodeJS.Timeout;
    
    const saveContent = async () => {
      const blocks = editor.topLevelBlocks;
      const content = JSON.stringify(blocks);
      console.log("Saving content:", content);
      
      try {
        if (documentId) {
          const { error } = await supabase
            .from("documents")
            .update({ content })
            .eq("id", documentId);
          
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("documents")
            .insert({
              content,
              voice_note_id: voiceNoteId,
              title
            });
          
          if (error) throw error;
        }
      } catch (error) {
        console.error("Error saving document:", error);
        toast({
          title: "Error",
          description: "Failed to save document",
          variant: "destructive",
        });
      }
    };

    const handleContentChange = () => {
      // Clear any existing timeout
      if (timeoutId) clearTimeout(timeoutId);
      
      // Set new timeout for debouncing
      timeoutId = setTimeout(saveContent, 1000);
    };

    // Subscribe to content changes
    editor.onEditorContentChange(handleContentChange);

    // Cleanup
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      editor.onEditorContentChange(null); // Remove the content change listener
    };
  }, [editor, documentId, voiceNoteId, title, toast]);

  return (
    <div className="rounded-lg bg-accent/50 p-6 backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-primary mb-4">Document</h3>
      <BlockNoteView editor={editor} theme="dark" />
    </div>
  );
};