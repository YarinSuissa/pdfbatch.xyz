import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const td = new TextDecoder();
const te = new TextEncoder();
const b64toU8 = (s: string) => {
  s = s.replace(/-/g,'+').replace(/_/g,'/');
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  const bin = atob(s + '='.repeat(pad));
  const u8 = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) u8[i] = bin.charCodeAt(i);
  return u8;
};
const b64url = (u8: Uint8Array) =>
  btoa(String.fromCharCode(...u8)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

async function hmac(payload: Uint8Array, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', te.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, payload));
  return b64url(sig);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SECRET = Deno.env.get('DOWNLOAD_HMAC_SECRET')!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const url = new URL(req.url);
    const token = url.searchParams.get('token') || url.pathname.split('/').pop() || '';
    const [payloadB64, sigB64] = token.split('.');
    if (!payloadB64 || !sigB64) return new Response('unauthorized', { status: 401, headers: cors });

    const payloadBytes = b64toU8(payloadB64);
    const expected = await hmac(payloadBytes, SECRET);
    if (expected !== sigB64) return new Response('unauthorized', { status: 401, headers: cors });

    const payload = JSON.parse(td.decode(payloadBytes)) as { b: string; p: string; exp: number };
    if (!payload.b || !payload.p || !payload.exp) return new Response('bad token', { status: 400, headers: cors });
    if (Math.floor(Date.now()/1000) > payload.exp) return new Response('expired', { status: 410, headers: cors });

    const { data, error } = await supabase.storage.from(payload.b).createSignedUrl(payload.p, 60);
    if (error || !data?.signedUrl) return new Response('not found', { status: 404, headers: cors });

    return new Response(null, { status: 302, headers: { ...cors, Location: data.signedUrl } });
  } catch {
    return new Response('error', { status: 500, headers: cors });
  }
});