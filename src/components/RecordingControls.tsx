import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2, FileText } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { AudioRecorder } from "@/utils/audioRecorder";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { AudioFileUpload } from "./AudioFileUpload";

interface RecordingControlsProps {
  onRecordingComplete: () => void;
}

export const RecordingControls = ({ onRecordingComplete }: RecordingControlsProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const recorderRef = useRef<AudioRecorder>(new AudioRecorder());
  const { toast } = useToast();
  const navigate = useNavigate();

  const startRecording = async () => {
    try {
      await recorderRef.current.startRecording();
      setIsRecording(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not access microphone. Please ensure you have granted permission.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = async () => {
    try {
      setIsLoading(true);
      const audioBlob = await recorderRef.current.stopRecording();
      setIsRecording(false);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const fileName = `${user.id}/recording-${Date.now()}.webm`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('voice_notes')
        .upload(fileName, audioBlob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('voice_notes')
        .getPublicUrl(fileName);

      const { data: noteData, error: dbError } = await supabase
        .from('voice_notes')
        .insert({
          title: `Recording ${new Date().toLocaleTimeString()}`,
          audio_url: publicUrl,
          duration: 0,
          user_id: user.id
        })
        .select()
        .single();

      if (dbError) throw dbError;

      onRecordingComplete();
      toast({
        title: "Success",
        description: "Voice note saved successfully!",
      });

      // Navigate to the detail page of the newly created voice note
      navigate(`/voice-note/${noteData.id}`);
    } catch (error) {
      console.error('Error saving recording:', error);
      toast({
        title: "Error",
        description: "Failed to save recording. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-8 min-h-[60vh] relative">
      {isRecording && (
        <div className="audio-visualizer animate-pulse" />
      )}
      
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex flex-col-reverse items-center gap-4">
        <AudioFileUpload onUploadComplete={onRecordingComplete} />
        
        <Button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isLoading}
          className={`bubble h-16 w-16 ${isRecording ? "glow" : ""}`}
        >
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : isRecording ? (
            <Square className="h-6 w-6" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </Button>

        {/* <Button
          variant="outline"
          onClick={() => navigate("/voice-note/new")}
          className="flex items-center gap-2"
        >
          <FileText className="h-4 w-4" />
          Create Document
        </Button> */}
      </div>
      
      {isRecording && (
        <p className="text-center text-primary animate-pulse absolute bottom-32">Recording...</p>
      )}
    </div>
  );
};