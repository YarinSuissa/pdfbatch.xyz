import { createClient } from 'npm:@supabase/supabase-js@2'

// CORS for browser calls
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      throw new Error('Missing SUPABASE_URL or SERVICE_ROLE env')
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
      global: { headers: { 'X-Client-Info': 'edge:init-upload' } },
    })

    const { jobId } = await req.json().catch(() => ({}))
    if (!jobId) throw new Error('jobId required')

    // ensure bucket names EXIST and are PRIVATE
    const bucket = 'uploads'
    const pdfPath = `${jobId}/${crypto.randomUUID()}.pdf`
    const csvPath = `${jobId}/${crypto.randomUUID()}.csv`

    // IMPORTANT: use createSignedUploadUrl (NOT createSignedUrl)
    const [pdf, csv] = await Promise.all([
      supabase.storage.from(bucket).createSignedUploadUrl(pdfPath),
      supabase.storage.from(bucket).createSignedUploadUrl(csvPath),
    ])

    if (pdf.error) throw pdf.error
    if (csv.error) throw csv.error

    const res = {
      pdf: { bucket, key: pdfPath, token: pdf.data.token },
      csv: { bucket, key: csvPath, token: csv.data.token },
    }

    return new Response(JSON.stringify(res), {
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  } catch (e) {
    console.error('init-upload failed:', e)
    return new Response(JSON.stringify({ error: 'Failed to create presigned URLs' }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }
})