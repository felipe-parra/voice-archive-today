import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    if (!voiceNoteId) {
      throw new Error('Missing voiceNoteId parameter')
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch voice note details
    const { data: voiceNote, error: fetchError } = await supabaseClient
      .from('voice_notes')
      .select('*')
      .eq('id', voiceNoteId)
      .single()

    if (fetchError || !voiceNote) {
      console.error('Error fetching voice note:', fetchError)
      throw new Error('Voice note not found')
    }

    console.log('Found voice note:', voiceNote.id)

    // Extract the file path from the audio_url
    const audioUrl = new URL(voiceNote.audio_url)
    const audioPath = decodeURIComponent(audioUrl.pathname.split('/voice_notes/').pop() || '')
    if (!audioPath) {
      console.error('Invalid audio URL format:', voiceNote.audio_url)
      throw new Error('Invalid audio URL format')
    }

    console.log('Downloading audio file from path:', audioPath)

    // Download the audio file
    const { data: audioData, error: downloadError } = await supabaseClient
      .storage
      .from('voice_notes')
      .download(audioPath)

    if (downloadError || !audioData) {
      console.error('Error downloading audio:', downloadError)
      throw new Error('Could not download audio file')
    }

    console.log('Successfully downloaded audio file')
    console.log('Audio file type:', audioData.type)

    // Create form data for OpenAI
    const formData = new FormData()
    
    // Get the file extension from the original file path
    const fileExtension = audioPath.split('.').pop() || 'webm'
    
    // Create a new blob with the original audio type
    const audioBlob = new Blob([audioData], { type: audioData.type })
    formData.append('file', audioBlob, `audio.${fileExtension}`)
    formData.append('model', 'whisper-1')

    console.log('Sending request to OpenAI with file extension:', fileExtension)

    // Call OpenAI API
    const openAIResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: formData,
    })

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text()
      console.error('OpenAI API error:', errorText)
      throw new Error(`OpenAI API error: ${errorText}`)
    }

    const transcriptionResult = await openAIResponse.json()
    console.log('Received transcription from OpenAI')

    // Update the voice note with the transcript
    const { error: updateError } = await supabaseClient
      .from('voice_notes')
      .update({ transcript: transcriptionResult.text })
      .eq('id', voiceNoteId)

    if (updateError) {
      console.error('Error updating voice note:', updateError)
      throw new Error('Failed to save transcript')
    }

    return new Response(
      JSON.stringify({ transcript: transcriptionResult.text }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in create-transcript function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})