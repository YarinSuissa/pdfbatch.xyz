// Minimal HMAC signer: POST { objectPath, bucket?, ttl? } -> { url }
// No auth needed. Uses only SUPABASE_URL + DOWNLOAD_HMAC_SECRET.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const te = new TextEncoder();
const toB64Url = (u8: Uint8Array) =>
  btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,'');

async function hmac(payload: Uint8Array, secret: string) {
  const key = await crypto.subtle.importKey('raw', te.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, payload));
  return toB64Url(sig);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
    const SECRET = Deno.env.get('DOWNLOAD_HMAC_SECRET') || '';
    
    // Better error handling for missing environment variables
    if (!SUPABASE_URL) {
      console.error('mint-download: SUPABASE_URL not found in environment');
      return new Response(JSON.stringify({ 
        error: 'Configuration error: SUPABASE_URL missing' 
      }), { status: 500, headers: cors });
    }
    
    if (!SECRET) {
      console.error('mint-download: DOWNLOAD_HMAC_SECRET not set');
      return new Response(JSON.stringify({ 
        error: 'Configuration error: DOWNLOAD_HMAC_SECRET not set. Please set this environment variable in your Supabase project.' 
      }), { status: 500, headers: cors });
    }

    const body = await req.json().catch(() => ({}));
    const objectPath = typeof body.objectPath === 'string' ? body.objectPath : '';
    const bucket = typeof body.bucket === 'string' && body.bucket ? body.bucket : 'outputs';
    const ttl = Number.isFinite(body.ttl) ? Math.min(Math.max(body.ttl, 60), 604800) : 86400;

    // IMPORTANT: objectPath must be relative to the bucket (NO leading "bucket/" prefix)
    if (!objectPath || objectPath.includes('..') || objectPath.startsWith('/')) {
      return new Response(JSON.stringify({ error: 'bad request' }), { status: 400, headers: cors });
    }

    const exp = Math.floor(Date.now() / 1000) + ttl;
    const payload = te.encode(JSON.stringify({ b: bucket, p: objectPath, exp }));
    const token = `${toB64Url(payload)}.${await hmac(payload, SECRET)}`;

    return new Response(JSON.stringify({
      url: `${SUPABASE_URL}/functions/v1/download?token=${token}`,
      expiresIn: ttl,
    }), { headers: { ...cors, 'content-type': 'application/json' }});
  } catch {
    return new Response(JSON.stringify({ error: 'mint failed' }), { status: 500, headers: cors });
  }
});