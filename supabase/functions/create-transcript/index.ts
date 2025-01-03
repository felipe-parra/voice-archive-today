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
    console.log('Processing voice note:', voiceNoteId)

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
      console.error('Voice note not found:', fetchError)
      throw new Error('Voice note not found')
    }

    console.log('Found voice note:', voiceNote.id)

    // Extract the file path from the audio_url
    // The audio_url is typically in the format: 
    // https://xxx.supabase.co/storage/v1/object/public/voice_notes/path/to/file.mp3
    const audioPath = voiceNote.audio_url.split('/voice_notes/').pop()
    if (!audioPath) {
      console.error('Invalid audio URL format:', voiceNote.audio_url)
      throw new Error('Invalid audio URL format')
    }

    console.log('Audio path:', audioPath)

    // Get a signed URL for the file
    const { data: signedURL, error: signedURLError } = await supabaseClient
      .storage
      .from('voice_notes')
      .createSignedUrl(audioPath, 60)

    if (signedURLError || !signedURL?.signedUrl) {
      console.error('Error creating signed URL:', signedURLError)
      throw new Error('Could not get audio file URL')
    }

    console.log('Created signed URL successfully')

    // Create transcript using OpenAI
    const formData = new FormData()
    const audioResponse = await fetch(signedURL.signedUrl)
    const audioBlob = await audioResponse.blob()
    formData.append('file', audioBlob, 'audio.mp3')
    formData.append('model', 'whisper-1')

    console.log('Sending request to OpenAI')

    const openAIResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: formData,
    })

    if (!openAIResponse.ok) {
      const error = await openAIResponse.text()
      console.error('OpenAI API error:', error)
      throw new Error('Failed to create transcript')
    }

    const transcriptionResult = await openAIResponse.json()
    console.log('Received transcript from OpenAI')

    // Update the voice note with the transcript
    const { error: updateError } = await supabaseClient
      .from('voice_notes')
      .update({ transcript: transcriptionResult.text })
      .eq('id', voiceNoteId)

    if (updateError) {
      console.error('Error updating voice note:', updateError)
      throw updateError
    }

    console.log('Successfully updated voice note with transcript')

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