import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Clock, Tags, FileText } from "lucide-react";
import { format } from "date-fns";

const VoiceNoteDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: voiceNote, isLoading } = useQuery({
    queryKey: ["voiceNote", id],
    queryFn: async () => {
      // If id is "new", return a blank voice note template
      if (id === "new") {
        return {
          id: "new",
          title: "New Document",
          created_at: new Date().toISOString(),
          content: "",
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
    enabled: !!id, // Only run query if we have an ID
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full border-4 border-primary border-t-transparent h-12 w-12"></div>
      </div>
    );
  }

  if (!voiceNote && id !== "new") {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-lg text-gray-500">Voice note not found</p>
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
        <div className="rounded-lg bg-accent/50 p-6 backdrop-blur-sm">
          <h1 className="text-3xl font-bold text-primary mb-4">
            {id === "new" ? "New Document" : voiceNote?.title}
          </h1>
          
          {id !== "new" && (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center text-gray-400">
                  <Calendar className="mr-2 h-4 w-4" />
                  {format(new Date(voiceNote.created_at), "PPP")}
                </div>
                
                {voiceNote.duration && (
                  <div className="flex items-center text-gray-400">
                    <Clock className="mr-2 h-4 w-4" />
                    {Math.floor(voiceNote.duration / 60)}:{(voiceNote.duration % 60).toString().padStart(2, '0')}
                  </div>
                )}

                {voiceNote.tags && voiceNote.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <Tags className="h-4 w-4 text-gray-400 mr-2" />
                    {voiceNote.tags.map((tag: string, index: number) => (
                      <span
                        key={index}
                        className="bg-primary/10 text-primary text-sm px-3 py-1 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {voiceNote.description && (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-primary">Description</h3>
                  <p className="text-gray-300">{voiceNote.description}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {id !== "new" && voiceNote.audio_url && (
          <div className="rounded-lg bg-accent/50 p-6 backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-primary mb-4">Audio</h3>
            <audio
              controls
              className="w-full"
              src={voiceNote.audio_url}
            >
              Your browser does not support the audio element.
            </audio>
          </div>
        )}

        {id !== "new" && voiceNote.transcript && (
          <div className="rounded-lg bg-accent/50 p-6 backdrop-blur-sm">
            <div className="flex items-center mb-4">
              <FileText className="mr-2 h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-primary">Transcript</h3>
            </div>
            <p className="text-gray-300 whitespace-pre-wrap">{voiceNote.transcript}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceNoteDetail;