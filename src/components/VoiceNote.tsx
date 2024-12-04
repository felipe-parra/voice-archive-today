import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Mic, Square, Play, List } from "lucide-react";

export const VoiceNote = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState<{ id: number; timestamp: string; duration: string }[]>([]);

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      // Start recording logic would go here
    } else {
      // Stop recording logic would go here
      const newRecording = {
        id: recordings.length + 1,
        timestamp: new Date().toLocaleTimeString(),
        duration: "00:15",
      };
      setRecordings([...recordings, newRecording]);
    }
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
                  onClick={toggleRecording}
                  className={`bubble h-16 w-16 ${isRecording ? 'animate-glow-pulse' : 'animate-bubble-float'}`}
                >
                  {isRecording ? <Square className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
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
                  <div>
                    <p className="text-primary">Recording {recording.id}</p>
                    <p className="text-sm text-gray-400">{recording.timestamp}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-400">{recording.duration}</span>
                    <Button size="icon" variant="ghost" className="h-8 w-8">
                      <Play className="h-4 w-4" />
                    </Button>
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