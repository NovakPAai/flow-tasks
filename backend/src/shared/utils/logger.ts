type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const envLevel = (process.env.LOG_LEVEL ?? '').toLowerCase() as Level;
const minLevel: number =
  LEVEL_ORDER[envLevel] ??
  (process.env.NODE_ENV === 'production' ? LEVEL_ORDER.warn : LEVEL_ORDER.debug);

// Regex matches any key that looks like it could carry a secret.
// Applied recursively so nested objects (e.g. req.headers.authorization) are also masked.
const SENSITIVE_KEY_RE = /password|secret|token|authorization|cookie|session|credential|api.?key/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 10 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [
      k,
      SENSITIVE_KEY_RE.test(k) ? '[REDACTED]' : redact(v, depth + 1),
    ]),
  );
}

function emit(level: Level, message: string, fields?: Record<string, unknown>) {
  if (LEVEL_ORDER[level] < minLevel) return;
  const safeFields = fields ? (redact(fields) as Record<string, unknown>) : undefined;
  const payload = { level, msg: message, time: new Date().toISOString(), ...safeFields };
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (process.env.NODE_ENV === 'production') {
    fn(JSON.stringify(payload));
  } else {
    fn(`[${level}] ${message}`, safeFields ?? '');
  }
}

export const logger = {
  debug: (msg: string, fields?: Record<string, unknown>) => emit('debug', msg, fields),
  info:  (msg: string, fields?: Record<string, unknown>) => emit('info',  msg, fields),
  warn:  (msg: string, fields?: Record<string, unknown>) => emit('warn',  msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit('error', msg, fields),
};

export function captureError(error: unknown, context: Record<string, unknown> = {}): void {
  const err =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { value: String(error) };
  logger.error('captured_error', { ...(redact(context) as Record<string, unknown>), error: err });
}
