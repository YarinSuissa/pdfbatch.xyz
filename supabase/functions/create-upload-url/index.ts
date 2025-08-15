import { corsHeaders } from '../_shared/cors.ts'

interface CreateUploadUrlRequest {
  jobId: string
  filename: string
  bucket?: string
}

interface CreateUploadUrlResponse {
  uploadUrl: string
  objectPath: string
}

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const { jobId, filename, bucket = 'outputs' }: CreateUploadUrlRequest = await req.json()

    if (!jobId || !filename) {
      throw new Error('jobId and filename are required')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Create object path
    const objectPath = `${jobId}/${filename}`

    // Create presigned PUT URL
    const putResponse = await fetch(`${supabaseUrl}/storage/v1/object/sign/${bucket}/${objectPath}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'PUT',
        expiresIn: 3600 // 1 hour
      })
    })

    if (!putResponse.ok) {
      throw new Error('Failed to create presigned URL')
    }

    const putData = await putResponse.json()

    const response: CreateUploadUrlResponse = {
      uploadUrl: putData.signedURL,
      objectPath
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('create-upload-url error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})