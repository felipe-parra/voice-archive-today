import React from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AudioFileUploadProps {
  onUploadComplete: () => void;
}

export const AudioFileUpload = ({ onUploadComplete }: AudioFileUploadProps) => {
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      toast({
        title: "Error",
        description: "Please upload an audio file",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const fileName = `${user.id}/upload-${Date.now()}.${file.name.split('.').pop()}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('voice_notes')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('voice_notes')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('voice_notes')
        .insert({
          title: `Upload ${new Date().toLocaleTimeString()}`,
          audio_url: publicUrl,
          user_id: user.id
        });

      if (dbError) throw dbError;

      toast({
        title: "Success",
        description: "Audio file uploaded successfully!",
      });
      
      onUploadComplete();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Error",
        description: "Failed to upload file. Please try again.",
        variant: "destructive",
      });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="audio/*"
        onChange={handleFileUpload}
        className="hidden"
        ref={fileInputRef}
      />
      <Button
        onClick={() => fileInputRef.current?.click()}
        variant="outline"
        className="bubble glow-green"
      >
        <Upload className="h-6 w-6" />
      </Button>
    </div>
  );
};