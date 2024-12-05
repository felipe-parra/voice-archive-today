import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { DocumentEditor } from "@/components/DocumentEditor";
import { VoiceNoteMetadata } from "@/components/voice-note/VoiceNoteMetadata";
import { AudioPlayer } from "@/components/voice-note/AudioPlayer";
import { TranscriptDisplay } from "@/components/voice-note/TranscriptDisplay";

const VoiceNoteDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: voiceNote, isLoading: isLoadingVoiceNote } = useQuery({
    queryKey: ["voiceNote", id],
    queryFn: async () => {
      if (id === "new") {
        return {
          id: "new",
          title: "New Document",
          created_at: new Date().toISOString(),
          audio_url: "",
          duration: 0,
          description: "",
          tags: [],
          transcript: "",
          user_id: (await supabase.auth.getUser()).data.user?.id
        };
      }

      const { data, error } = await supabase
        .from("voice_notes")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: document, isLoading: isLoadingDocument } = useQuery({
    queryKey: ["document", id],
    queryFn: async () => {
      if (!id || id === "new") return null;

      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("voice_note_id", id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!id && id !== "new",
  });

  if (isLoadingVoiceNote || isLoadingDocument) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full border-4 border-primary border-t-transparent h-12 w-12"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-accent p-4 md:p-8">
      <Button
        variant="ghost"
        className="mb-6"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="mx-auto max-w-4xl space-y-8">
        <VoiceNoteMetadata
          title={voiceNote?.title || ""}
          createdAt={voiceNote?.created_at || new Date().toISOString()}
          duration={voiceNote?.duration}
          tags={voiceNote?.tags}
          description={voiceNote?.description}
        />

        <AudioPlayer audioUrl={voiceNote?.audio_url || ""} />

        <TranscriptDisplay transcript={voiceNote?.transcript || ""} />

        {id && (
          <DocumentEditor
            initialContent={document?.content}
            documentId={document?.id}
            voiceNoteId={id}
            title={voiceNote?.title || "New Document"}
          />
        )}
      </div>
    </div>
  );
};

export default VoiceNoteDetail;