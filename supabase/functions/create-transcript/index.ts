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
    const { voiceNoteId } = await req.json()

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the voice note
    const { data: voiceNote, error: fetchError } = await supabaseClient
      .from('voice_notes')
      .select('*')
      .eq('id', voiceNoteId)
      .single()

    if (fetchError || !voiceNote) {
      throw new Error('Voice note not found')
    }

    // Get the audio file URL
    const { data: signedURL } = await supabaseClient
      .storage
      .from('voice_notes')
      .createSignedUrl(voiceNote.audio_url, 60)

    if (!signedURL?.signedUrl) {
      throw new Error('Could not get audio file URL')
    }

    // Create transcript using OpenAI
    const formData = new FormData()
    const audioResponse = await fetch(signedURL.signedUrl)
    const audioBlob = await audioResponse.blob()
    formData.append('file', audioBlob, 'audio.mp3')
    formData.append('model', 'whisper-1')

    const openAIResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: formData,
    })

    if (!openAIResponse.ok) {
      throw new Error('Failed to create transcript')
    }

    const transcriptionResult = await openAIResponse.json()

    // Update the voice note with the transcript
    const { error: updateError } = await supabaseClient
      .from('voice_notes')
      .update({ transcript: transcriptionResult.text })
      .eq('id', voiceNoteId)

    if (updateError) {
      throw updateError
    }

    return new Response(
      JSON.stringify({ transcript: transcriptionResult.text }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})