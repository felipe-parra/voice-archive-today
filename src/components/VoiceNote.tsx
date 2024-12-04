import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { List } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RecordingControls } from "./RecordingControls";
import { VoiceNoteList } from "./VoiceNoteList";

export const VoiceNote = () => {
  const [recordings, setRecordings] = useState<{
    id: string;
    title: string;
    audio_url: string;
    created_at: string;
    description?: string;
    tags?: string[];
    transcript?: string;
  }[]>([]);

  React.useEffect(() => {
    loadRecordings();
  }, []);

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
            <RecordingControls onRecordingComplete={loadRecordings} />
          </TabsContent>

          <TabsContent value="notes" className="mt-8">
            <VoiceNoteList recordings={recordings} onUpdate={loadRecordings} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};