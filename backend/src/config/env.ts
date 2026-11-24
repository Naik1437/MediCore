import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4002', 10),
  host: process.env.HOST || '0.0.0.0',
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  jwtSecret: process.env.JWT_SECRET || 'medicore-dev-jwt-super-secret-key-change-in-prod-32bytesmin',
  jwtAccessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
  jwtRefreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3002',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://medicore_user:medicore_secure_pass_2026@localhost:5432/medicore_db?schema=public',
};
