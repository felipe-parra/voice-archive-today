import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { DocumentEditor } from "@/components/DocumentEditor";
import { VoiceNoteMetadata } from "@/components/voice-note/VoiceNoteMetadata";
import { AudioPlayer } from "@/components/voice-note/AudioPlayer";
import { TranscriptDisplay } from "@/components/voice-note/TranscriptDisplay";
import { useToast } from "@/components/ui/use-toast";
import { useEffect } from "react";

const VoiceNoteDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Authentication required",
          description: "Please log in to view this page",
          variant: "destructive",
        });
        navigate("/login");
      }
    };
    checkAuth();
  }, [navigate]);

  const { data: voiceNote, isLoading: isLoadingVoiceNote, error: voiceNoteError } = useQuery({
    queryKey: ["voiceNote", id],
    queryFn: async () => {
      if (!id) throw new Error("No voice note ID provided");

      const { data, error } = await supabase
        .from("voice_notes")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching voice note:", error);
        throw error;
      }
      return data;
    },
    enabled: !!id,
  });

  const { data: document, isLoading: isLoadingDocument, error: documentError } = useQuery({
    queryKey: ["document", id],
    queryFn: async () => {
      if (!id) throw new Error("No voice note ID provided");

      console.log("Fetching document for voice note:", id);
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("voice_note_id", id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching document:", error);
        throw error;
      }
      console.log("Document data:", data);
      return data;
    },
    enabled: !!id,
  });

  // Handle errors
  useEffect(() => {
    if (voiceNoteError) {
      toast({
        title: "Error loading voice note",
        description: "Failed to load voice note details",
        variant: "destructive",
      });
    }
    if (documentError) {
      toast({
        title: "Error loading document",
        description: "Failed to load document details",
        variant: "destructive",
      });
    }
  }, [voiceNoteError, documentError]);

  const handleTranscriptCreated = (newTranscript: string) => {
    queryClient.setQueryData(["voiceNote", id], (oldData: any) => ({
      ...oldData,
      transcript: newTranscript,
    }));
  };

  if (isLoadingVoiceNote || isLoadingDocument) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full border-4 border-primary border-t-transparent h-12 w-12"></div>
      </div>
    );
  }

  if (!voiceNote && !isLoadingVoiceNote) {
    return (
      <div className="min-h-screen p-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Voice note not found</h2>
          <Button
            variant="ghost"
            className="mt-4"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
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

        <TranscriptDisplay 
          transcript={voiceNote?.transcript || ""} 
          voiceNoteId={id || ""}
          onTranscriptCreated={handleTranscriptCreated}
        />

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