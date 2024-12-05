import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

interface EmailRequest {
  documentId: string
  to: string
  from: string
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Received request to send markdown email")
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured")
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    const emailRequest: EmailRequest = await req.json()
    console.log("Email request:", emailRequest)

    // Fetch document content
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('content, title')
      .eq('id', emailRequest.documentId)
      .single()

    if (docError) {
      console.error("Error fetching document:", docError)
      throw new Error('Failed to fetch document')
    }

    console.log("Sending email with Resend API")
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: emailRequest.from,
        to: [emailRequest.to],
        subject: `Markdown Document: ${document.title || 'Untitled'}`,
        html: `<p>Here's your markdown document:</p><pre>${document.content}</pre>`,
        text: document.content,
      }),
    })

    const responseData = await res.json()
    console.log("Resend API response:", responseData)

    if (!res.ok) {
      throw new Error(`Resend API error: ${JSON.stringify(responseData)}`)
    }

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error: any) {
    console.error("Error in send-markdown-email function:", error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString()
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
}

serve(handler)