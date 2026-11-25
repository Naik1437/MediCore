import dotenv from 'dotenv';
dotenv.config();

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';

const DEFAULT_JWT_SECRET = 'medicore-dev-jwt-super-secret-key-change-in-prod-32bytesmin';
const jwtSecret = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
const databaseUrl = process.env.DATABASE_URL || 'postgresql://medicore_user:medicore_secure_pass_2026@localhost:5432/medicore_db?schema=public';

// Fail-fast in production if default/insecure credentials remain configured
if (isProd) {
  if (!process.env.JWT_SECRET || jwtSecret === DEFAULT_JWT_SECRET) {
    throw new Error('FATAL: Insecure production configuration: JWT_SECRET must be explicitly set to a cryptographically strong value in production.');
  }
  if (!process.env.DATABASE_URL || databaseUrl.includes('medicore_secure_pass_2026')) {
    throw new Error('FATAL: Insecure production configuration: DATABASE_URL cannot use default development credentials in production.');
  }
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
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3002',
  databaseUrl,
};
