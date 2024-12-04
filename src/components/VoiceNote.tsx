import React, { useState, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Mic, Square, Play, List, Loader2, Edit2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { AudioRecorder } from "@/utils/audioRecorder";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { EditVoiceNoteForm } from "./EditVoiceNoteForm";

export const VoiceNote = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [recordings, setRecordings] = useState<{
    id: string;
    title: string;
    audio_url: string;
    created_at: string;
    description?: string;
    tags?: string[];
    transcript?: string;
  }[]>([]);
  const recorderRef = useRef<AudioRecorder>(new AudioRecorder());
  const { toast } = useToast();

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

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Create user-specific folder path
      const fileName = `${user.id}/recording-${Date.now()}.webm`;
      
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('voice_notes')
        .upload(fileName, audioBlob);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('voice_notes')
        .getPublicUrl(fileName);

      // Save metadata to database
      const { data: noteData, error: dbError } = await supabase
        .from('voice_notes')
        .insert({
          title: `Recording ${new Date().toLocaleTimeString()}`,
          audio_url: publicUrl,
          duration: 0, // You could calculate actual duration if needed
          user_id: user.id // Add user_id to the insert
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setRecordings(prev => [...prev, noteData]);
      toast({
        title: "Success",
        description: "Voice note saved successfully!",
      });
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

  React.useEffect(() => {
    // Load existing recordings for the current user
    const loadRecordings = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("voice_notes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading recordings:", error);
        return;
      }

      setRecordings(data);
    };

    loadRecordings();
  }, []);

  const playRecording = (url: string) => {
    const audio = new Audio(url);
    audio.play();
  };

  const handleSheetClose = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("voice_notes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading recordings:", error);
      return;
    }

    setRecordings(data);
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-8 text-center text-3xl font-bold text-primary">VoiceNote</h1>
        
        <Tabs defaultValue="record" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="record" className="text-lg">Record</TabsTrigger>
            <TabsTrigger value="notes" className="text-lg">Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="record" className="mt-8">
            <div className="flex flex-col items-center space-y-8">
              {isRecording && (
                <div className="audio-visualizer animate-pulse" />
              )}
              
              <div className="flex items-center space-x-4">
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isLoading}
                  className={`bubble h-16 w-16 ${isRecording ? "animate-pulse glow" : ""}`}
                >
                  {isLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : isRecording ? (
                    <Square className="h-6 w-6" />
                  ) : (
                    <Mic className="h-6 w-6" />
                  )}
                </Button>
              </div>
              
              {isRecording && (
                <p className="text-center text-primary animate-pulse">Recording...</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="notes" className="mt-8">
            <div className="space-y-4">
              {recordings.map((recording) => (
                <div
                  key={recording.id}
                  className="flex items-center justify-between rounded-lg bg-accent/50 p-4 backdrop-blur-sm"
                >
                  <div className="flex-grow">
                    <p className="text-primary">{recording.title}</p>
                    {recording.description && (
                      <p className="text-sm text-gray-500 mt-1">{recording.description}</p>
                    )}
                    {recording.tags && recording.tags.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {recording.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-gray-400 mt-2">
                      {new Date(recording.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8"
                      onClick={() => playRecording(recording.audio_url)}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </SheetTrigger>
                      <SheetContent>
                        <SheetHeader>
                          <SheetTitle>Edit Voice Note</SheetTitle>
                        </SheetHeader>
                        <div className="mt-4">
                          <EditVoiceNoteForm
                            voiceNote={recording}
                            onClose={handleSheetClose}
                          />
                        </div>
                      </SheetContent>
                    </Sheet>
                  </div>
                </div>
              ))}
              
              {recordings.length === 0 && (
                <div className="text-center text-gray-400">
                  <List className="mx-auto mb-2 h-8 w-8" />
                  <p>No recordings yet</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};