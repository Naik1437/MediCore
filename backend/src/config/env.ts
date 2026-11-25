import dotenv from 'dotenv';
dotenv.config();

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';

const DEFAULT_JWT_SECRET = 'medicore-dev-jwt-super-secret-key-change-in-prod-32bytesmin';
const DEFAULT_ANALYTICS_SECRET = 'medicore-internal-analytics-key-2026';
const DEFAULT_DATABASE_URL = 'postgresql://medicore_user:medicore_secure_pass_2026@localhost:5432/medicore_db?schema=public';
const jwtSecret = process.env.JWT_SECRET || (isProd ? '' : DEFAULT_JWT_SECRET);
const databaseUrl = process.env.DATABASE_URL || (isProd ? '' : DEFAULT_DATABASE_URL);
const analyticsSharedSecret = process.env.ANALYTICS_SHARED_SECRET || (isProd ? '' : DEFAULT_ANALYTICS_SECRET);

// Fail-fast in production if default/insecure credentials remain configured
if (isProd) {
  if (!jwtSecret || jwtSecret === DEFAULT_JWT_SECRET) {
    throw new Error('FATAL: Insecure production configuration: JWT_SECRET must be explicitly set to a cryptographically strong value in production.');
  }
  if (!databaseUrl || databaseUrl.includes('medicore_secure_pass_2026')) {
    throw new Error('FATAL: Insecure production configuration: DATABASE_URL cannot use default development credentials in production.');
  }
}

function parseCorsOrigin(val?: string) {
  const defaultOrigins = [
    'http://localhost:3002',
    'http://localhost:8088',
    'http://127.0.0.1:3002',
    'http://127.0.0.1:8088',
  ];
  const configuredOrigins = (val || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const trustedOrigins = new Set([...defaultOrigins, ...configuredOrigins]);
  const explicitTunnel = process.env.CLOUDFLARE_TUNNEL_ORIGIN?.trim();
  if (explicitTunnel) {
    trustedOrigins.add(explicitTunnel);
  }

  return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow non-browser requests (e.g. curl, internal proxy, same-origin without Origin header)
    if (!origin) return callback(null, true);

    if (trustedOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(null, false);
  };
}

export const config = {
  env,
  port: parseInt(process.env.PORT || '4002', 10),
  host: process.env.HOST || '0.0.0.0',
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  jwtSecret,
  jwtAccessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
  jwtRefreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN || 'http://localhost:3002,http://localhost:8088'),
  databaseUrl,
  analyticsSharedSecret,
};
