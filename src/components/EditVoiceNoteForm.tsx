import React from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface EditVoiceNoteFormProps {
  voiceNote: {
    id: string;
    title: string;
    description?: string;
    tags?: string[];
    transcript?: string;
  };
  onClose: () => void;
}

export const EditVoiceNoteForm = ({ voiceNote, onClose }: EditVoiceNoteFormProps) => {
  const { toast } = useToast();
  const form = useForm({
    defaultValues: {
      title: voiceNote.title || "",
      description: voiceNote.description || "",
      tags: voiceNote.tags?.join(", ") || "",
      transcript: voiceNote.transcript || "",
    },
  });

  const onSubmit = async (data: {
    title: string;
    description: string;
    tags: string;
    transcript: string;
  }) => {
    try {
      // Update voice note
      const { error: updateError } = await supabase
        .from("voice_notes")
        .update({
          title: data.title,
          description: data.description,
          tags: data.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
          transcript: data.transcript,
        })
        .eq("id", voiceNote.id);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Voice note updated successfully",
      });
      
      onClose();
    } catch (error) {
      console.error("Error updating voice note:", error);
      toast({
        title: "Error",
        description: "Failed to update voice note",
        variant: "destructive",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tags"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tags (comma-separated)</FormLabel>
              <FormControl>
                <Input {...field} placeholder="tag1, tag2, tag3" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="transcript"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Transcript</FormLabel>
              <FormControl>
                <Textarea {...field} className="min-h-[200px]" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save Changes</Button>
        </div>
      </form>
    </Form>
  );
};