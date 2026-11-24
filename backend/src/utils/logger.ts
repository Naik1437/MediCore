// Sanitizing logger ensuring credentials, tokens, and PHI payloads are never dumped to raw console/logs
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'refreshtoken',
  'accesstoken',
  'authorization',
  'secret',
  'ssn',
  'cardnumber',
  'cvv',
]);

export function sanitize(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(sanitize);
  }

  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      clean[key] = sanitize(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export const logger = {
  info: (message: string, meta?: any) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, meta ? sanitize(meta) : '');
  },
  warn: (message: string, meta?: any) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, meta ? sanitize(meta) : '');
  },
  error: (message: string, error?: any) => {
    const errDetails = error instanceof Error ? { message: error.message, stack: error.stack } : error;
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, errDetails ? sanitize(errDetails) : '');
  },
};
