import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const dbUrl = process.env.DATABASE_URL || 'postgresql://medicore_user:medicore_secure_pass_2026@localhost:5432/medicore_db?schema=public';

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export default prisma;
