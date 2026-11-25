import bcrypt from 'bcryptjs';
import { prisma } from '../prisma.js';
import { config } from '../config/env.js';
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  TokenPayload,
} from '../utils/jwt.js';
import {
  BadRequestError,
  UnauthorizedError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
} from '../utils/errors.js';
import { UserRole } from '../constants/roles.js';
import { recordAudit } from './auditService.js';

export interface RegisterDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: UserRole;
  clientIp?: string;
  userAgent?: string;
}

export interface LoginDTO {
  email: string;
  password: string;
  clientIp?: string;
  userAgent?: string;
}

export class AuthService {
  static async register(dto: RegisterDTO, actorRole?: UserRole) {
    // Security MC-04: Public registration can only create PATIENT role.
    // Privileged clinical or administrative roles require authenticated HOSPITAL_ADMIN.
    if (dto.role && dto.role !== UserRole.PATIENT && actorRole !== UserRole.HOSPITAL_ADMIN) {
      throw new ForbiddenError('Public registration is restricted to patient accounts only');
    }

    const existing = await prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictError('A user account with this email address already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, config.bcryptSaltRounds);
    const assignedRole = dto.role || UserRole.PATIENT;

    const user = await prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: assignedRole as any,
      },
    });

    // If registered as patient, automatically initialize a patient profile with unique MRN
    let patientProfile = null;
    if (assignedRole === UserRole.PATIENT) {
      const year = new Date().getFullYear();
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const mrn = `MC-${year}-${randomSuffix}`;

      patientProfile = await prisma.patient.create({
        data: {
          userId: user.id,
          mrn,
          firstName: user.firstName,
          lastName: user.lastName,
          dob: new Date('1990-01-01T00:00:00Z'),
          gender: 'NOT_SPECIFIED',
          phone: user.phone || '000-000-0000',
          email: user.email,
        },
      });
    }

    await recordAudit({
      userId: user.id,
      action: 'USER_REGISTERED',
      entity: 'User',
      entityId: user.id,
      ipAddress: dto.clientIp,
      userAgent: dto.userAgent,
      status: 'SUCCESS',
      details: { role: assignedRole },
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      patientId: patientProfile?.id,
    };
  }

  static async login(dto: LoginDTO) {
    const user = await prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        patientProfile: true,
        providerProfile: true,
        staffProfile: true,
      },
    });

    if (!user || !user.isActive) {
      await recordAudit({
        userId: null,
        action: 'LOGIN_FAILED',
        entity: 'User',
        ipAddress: dto.clientIp,
        userAgent: dto.userAgent,
        status: 'DENIED',
        details: { email: dto.email },
      });
      throw new UnauthorizedError('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      await recordAudit({
        userId: user.id,
        action: 'LOGIN_FAILED_PASSWORD',
        entity: 'User',
        entityId: user.id,
        ipAddress: dto.clientIp,
        userAgent: dto.userAgent,
        status: 'DENIED',
      });
      throw new UnauthorizedError('Invalid email or password');
    }

    // Build JWT payload
    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
      patientId: user.patientProfile?.id,
      providerId: user.providerProfile?.id,
      staffId: user.staffProfile?.id,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const { token: rawRefreshToken, hash: refreshHash, expiresAt } = generateRefreshToken();

    // Persist refresh session
    await prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: refreshHash,
        expiresAt,
        ipAddress: dto.clientIp,
        userAgent: dto.userAgent,
      },
    });

    await recordAudit({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      entity: 'User',
      entityId: user.id,
      ipAddress: dto.clientIp,
      userAgent: dto.userAgent,
      status: 'SUCCESS',
    });

    const userProfile = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      phone: user.phone,
      patientProfile: user.patientProfile
        ? {
            id: user.patientProfile.id,
            mrn: user.patientProfile.mrn,
            bloodGroup: user.patientProfile.bloodGroup,
            phone: user.patientProfile.phone,
          }
        : null,
      providerProfile: user.providerProfile
        ? {
            id: user.providerProfile.id,
            specialization: user.providerProfile.specialization,
            licenseNumber: user.providerProfile.licenseNumber,
            departmentId: user.providerProfile.departmentId,
          }
        : null,
      staffProfile: user.staffProfile
        ? {
            id: user.staffProfile.id,
            employeeId: user.staffProfile.employeeId,
            jobTitle: user.staffProfile.jobTitle,
            departmentId: user.staffProfile.departmentId,
          }
        : null,
      patientId: user.patientProfile?.id,
      providerId: user.providerProfile?.id,
      staffId: user.staffProfile?.id,
    };

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: userProfile,
    };
  }

  static async refreshToken(rawRefreshToken: string, clientIp?: string, userAgent?: string) {
    const oldHash = hashToken(rawRefreshToken);

    const session = await prisma.refreshSession.findUnique({
      where: { tokenHash: oldHash },
      include: {
        user: {
          include: {
            patientProfile: true,
            providerProfile: true,
            staffProfile: true,
          },
        },
      },
    });

    if (!session) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Detect reuse of revoked session (Security rotation rule)
    if (session.revokedAt) {
      // Invalidate ALL sessions for this user due to potential token theft
      await prisma.refreshSession.updateMany({
        where: { userId: session.userId },
        data: { revokedAt: new Date() },
      });

      await recordAudit({
        userId: session.userId,
        action: 'REFRESH_TOKEN_REUSE_DETECTED',
        entity: 'RefreshSession',
        entityId: session.id,
        ipAddress: clientIp,
        userAgent,
        status: 'DENIED',
        details: { warning: 'All user sessions revoked due to rotated token replay.' },
      });

      throw new UnauthorizedError('Revoked token replay detected. All active sessions invalidated.');
    }

    if (new Date() > session.expiresAt) {
      throw new UnauthorizedError('Refresh token expired');
    }

    // Rotate: Revoke current session and create new one
    await prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const { token: newRawRefreshToken, hash: newHash, expiresAt } = generateRefreshToken();

    await prisma.refreshSession.create({
      data: {
        userId: session.userId,
        tokenHash: newHash,
        expiresAt,
        ipAddress: clientIp,
        userAgent,
      },
    });

    const tokenPayload: TokenPayload = {
      userId: session.user.id,
      email: session.user.email,
      role: session.user.role as UserRole,
      patientId: session.user.patientProfile?.id,
      providerId: session.user.providerProfile?.id,
      staffId: session.user.staffProfile?.id,
    };

    const newAccessToken = generateAccessToken(tokenPayload);

    const userProfile = {
      id: session.user.id,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      role: session.user.role,
      phone: session.user.phone,
      patientProfile: session.user.patientProfile
        ? {
            id: session.user.patientProfile.id,
            mrn: session.user.patientProfile.mrn,
            bloodGroup: session.user.patientProfile.bloodGroup,
            phone: session.user.patientProfile.phone,
          }
        : null,
      providerProfile: session.user.providerProfile
        ? {
            id: session.user.providerProfile.id,
            specialization: session.user.providerProfile.specialization,
            licenseNumber: session.user.providerProfile.licenseNumber,
            departmentId: session.user.providerProfile.departmentId,
          }
        : null,
      staffProfile: session.user.staffProfile
        ? {
            id: session.user.staffProfile.id,
            employeeId: session.user.staffProfile.employeeId,
            jobTitle: session.user.staffProfile.jobTitle,
            departmentId: session.user.staffProfile.departmentId,
          }
        : null,
      patientId: session.user.patientProfile?.id,
      providerId: session.user.providerProfile?.id,
      staffId: session.user.staffProfile?.id,
    };

    return {
      accessToken: newAccessToken,
      refreshToken: newRawRefreshToken,
      user: userProfile,
    };
  }

  static async logout(rawRefreshToken: string, userId?: string) {
    const oldHash = hashToken(rawRefreshToken);

    await prisma.refreshSession.updateMany({
      where: { tokenHash: oldHash },
      data: { revokedAt: new Date() },
    });

    if (userId) {
      await recordAudit({
        userId,
        action: 'LOGOUT',
        entity: 'RefreshSession',
        status: 'SUCCESS',
      });
    }

    return { message: 'Logged out successfully' };
  }

  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        patientProfile: {
          select: { id: true, mrn: true, bloodGroup: true, phone: true },
        },
        providerProfile: {
          select: { id: true, specialization: true, licenseNumber: true, departmentId: true },
        },
        staffProfile: {
          select: { id: true, employeeId: true, jobTitle: true, departmentId: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User profile not found');
    }

    return {
      ...user,
      patientId: user.patientProfile?.id,
      providerId: user.providerProfile?.id,
      staffId: user.staffProfile?.id,
    };
  }
}
