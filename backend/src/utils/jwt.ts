import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/env.js';
import { UserRole } from '../constants/roles.js';

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  patientId?: string;
  providerId?: string;
  staffId?: string;
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtAccessExpiration as any,
  });
}

export function generateRefreshToken(): { token: string; hash: string; expiresAt: Date } {
  // Generate high-entropy cryptographically secure random token
  const token = crypto.randomBytes(40).toString('hex');
  const hash = hashToken(token);

  // 7 days expiration
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  return { token, hash, expiresAt };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtSecret) as TokenPayload;
}
