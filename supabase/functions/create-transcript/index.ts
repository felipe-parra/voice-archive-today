import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import "https://deno.land/x/xhr@0.1.0/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { voiceNoteId } = await req.json();
    if (!voiceNoteId) throw new Error('Missing or invalid voiceNoteId');
  
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
  
    const { data: voiceNote, error: fetchError } = await supabaseClient
      .from('voice_notes')
      .select('*')
      .eq('id', voiceNoteId)
      .single();
  
    if (fetchError || !voiceNote) throw new Error('Voice note not found');
  
    const audioUrl = new URL(voiceNote.audio_url);
    const audioPath = audioUrl.pathname.split('/voice_notes/').pop();
    if (!audioPath) throw new Error('Invalid audio URL format');
  
    const { data: audioData, error: downloadError } = await supabaseClient
      .storage
      .from('voice_notes')
      .download(audioPath);
  
    if (downloadError || !audioData) throw new Error('Could not download audio file');
  
    const audioBlob = new Blob([audioData], { type: 'audio/webm' }); // Ensure correct MIME type
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
  
    const openAIResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}` },
      body: formData,
    });
  
    if (!openAIResponse.ok) {
      const error = await openAIResponse.text();
      console.error('OpenAI API error:', error);
      throw new Error('Failed to create transcript');
    }
  
    const transcriptionResult = await openAIResponse.json();
  
    const { error: updateError } = await supabaseClient
      .from('voice_notes')
      .update({ transcript: transcriptionResult.text })
      .eq('id', voiceNoteId);
  
    if (updateError) throw new Error('Failed to update transcript');
  
    return new Response(
      JSON.stringify({ transcript: transcriptionResult.text }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  
  } catch (error) {
    console.error('Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})