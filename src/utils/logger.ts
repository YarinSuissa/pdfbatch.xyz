// src/utils/logger.ts
type Level = 'debug' | 'info' | 'warn' | 'error';

const isProd = import.meta.env.PROD;

// redact obvious secrets
function redact(v: unknown): unknown {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  if (!s) return v;
  return s
    // mask tokens / keys / bearer
    .replace(/\b(eyJ[A-Za-z0-9_-]+\.?[A-Za-z0-9_-]*\.?[A-Za-z0-9_-]+)\b/g, '***JWT***')
    .replace(/\b(AIza[0-9A-Za-z_\-]{33})\b/g, '***API_KEY***')
    .replace(/\b(signedUrl|token|access_token|refresh_token)=([^&\s]+)/gi, '$1=***')
    .replace(/\b(\+?\d{9,15})\b/g, '***PHONE***')
    .replace(/\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi, '***EMAIL***');
}

function emit(level: Level, ...args: unknown[]) {
  // In prod, keep only warn/error; in dev keep everything
  if (isProd && (level === 'debug' || level === 'info')) return;
  const safe = args.map(redact);
  // eslint-disable-next-line no-console
  (console as any)[level](...safe);
}

export const log = {
  debug: (...a: unknown[]) => emit('debug', ...a),
  info:  (...a: unknown[]) => emit('info',  ...a),
  warn:  (...a: unknown[]) => emit('warn',  ...a),
  error: (...a: unknown[]) => emit('error', ...a),
};