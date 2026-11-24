import { prisma } from '../prisma.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import { parsePagination, formatPaginatedResponse } from '../utils/pagination.js';
import { recordAudit } from './auditService.js';

export interface CreatePatientDTO {
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  bloodGroup?: string;
  phone: string;
  email?: string;
  address?: string;
  emergencyContact?: string;
  userId?: string;
}

export class PatientService {
  static async createPatient(dto: CreatePatientDTO, actorUserId?: string) {
    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const mrn = `MC-${year}-${randomSuffix}`;

    const patient = await prisma.patient.create({
      data: {
        mrn,
        firstName: dto.firstName,
        lastName: dto.lastName,
        dob: new Date(dto.dob),
        gender: dto.gender,
        bloodGroup: dto.bloodGroup,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        emergencyContact: dto.emergencyContact,
        userId: dto.userId || null,
      },
    });

    await recordAudit({
      userId: actorUserId,
      action: 'PATIENT_REGISTERED',
      entity: 'Patient',
      entityId: patient.id,
      status: 'SUCCESS',
      details: { mrn: patient.mrn },
    });

    return patient;
  }

  static async getPatients(query: any) {
    const pagination = parsePagination(query);
    const search = query.search as string;

    const where: any = {};
    if (search) {
      where.OR = [
        { mrn: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const [total, patients] = await Promise.all([
      prisma.patient.count({ where }),
      prisma.patient.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return formatPaginatedResponse(patients, total, pagination);
  }

  static async getPatientById(id: string, actorUserId?: string) {
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        consents: { where: { status: 'GRANTED' } },
      },
    });

    if (!patient) {
      throw new NotFoundError(`Patient with ID ${id} not found`);
    }

    // Audit sensitive patient record access
    await recordAudit({
      userId: actorUserId,
      action: 'PATIENT_RECORD_VIEWED',
      entity: 'Patient',
      entityId: patient.id,
      status: 'SUCCESS',
      details: { mrn: patient.mrn },
    });

    return patient;
  }
}
