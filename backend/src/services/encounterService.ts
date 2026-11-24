import { prisma } from '../prisma.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { parsePagination, formatPaginatedResponse } from '../utils/pagination.js';
import { recordAudit } from './auditService.js';

export interface CreateEncounterDTO {
  patientId: string;
  providerId: string;
  appointmentId?: string;
  encounterType?: 'OUTPATIENT' | 'INPATIENT' | 'EMERGENCY';
  notes?: string;
}

export interface AddDiagnosisDTO {
  encounterId: string;
  patientId: string;
  providerId: string;
  icdCode: string;
  description: string;
  type?: 'PRIMARY' | 'SECONDARY';
}

export interface AddMedicationOrderDTO {
  encounterId: string;
  patientId: string;
  providerId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export class EncounterService {
  static async createEncounter(dto: CreateEncounterDTO, actorUserId?: string) {
    const encounter = await prisma.encounter.create({
      data: {
        patientId: dto.patientId,
        providerId: dto.providerId,
        appointmentId: dto.appointmentId || null,
        encounterType: dto.encounterType || 'OUTPATIENT',
        status: 'IN_PROGRESS',
        notes: dto.notes,
      },
    });

    if (dto.appointmentId) {
      await prisma.appointment.update({
        where: { id: dto.appointmentId },
        data: { status: 'IN_PROGRESS' },
      });
    }

    await recordAudit({
      userId: actorUserId,
      action: 'ENCOUNTER_CREATED',
      entity: 'Encounter',
      entityId: encounter.id,
      status: 'SUCCESS',
      details: { patientId: dto.patientId, providerId: dto.providerId },
    });

    return encounter;
  }

  static async getEncounters(query: any, requestingPatientId?: string, actorUserId?: string) {
    const pagination = parsePagination(query);
    const where: any = {};

    if (requestingPatientId) {
      where.patientId = requestingPatientId;
    } else if (query.patientId) {
      where.patientId = query.patientId;
    }

    if (query.providerId) {
      where.providerId = query.providerId;
    }

    const [total, encounters] = await Promise.all([
      prisma.encounter.count({ where }),
      prisma.encounter.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { startedAt: 'desc' },
        include: {
          diagnoses: true,
          medicationOrders: true,
          labOrders: { include: { labResults: true } },
          patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
          provider: {
            include: { user: { select: { firstName: true, lastName: true } } },
          },
        },
      }),
    ]);

    await recordAudit({
      userId: actorUserId,
      action: 'CLINICAL_ENCOUNTERS_VIEWED',
      entity: 'Encounter',
      status: 'SUCCESS',
      details: { count: encounters.length },
    });

    return formatPaginatedResponse(encounters, total, pagination);
  }

  static async addDiagnosis(dto: AddDiagnosisDTO, actorUserId?: string) {
    const encounter = await prisma.encounter.findUnique({
      where: { id: dto.encounterId },
    });

    if (!encounter) {
      throw new NotFoundError(`Encounter ${dto.encounterId} not found`);
    }

    if (encounter.patientId !== dto.patientId) {
      throw new BadRequestError('Encounter patient mismatch');
    }

    const diagnosis = await prisma.diagnosis.create({
      data: {
        encounterId: dto.encounterId,
        patientId: dto.patientId,
        providerId: dto.providerId,
        icdCode: dto.icdCode,
        description: dto.description,
        type: dto.type || 'PRIMARY',
      },
    });

    await recordAudit({
      userId: actorUserId,
      action: 'DIAGNOSIS_RECORDED',
      entity: 'Diagnosis',
      entityId: diagnosis.id,
      status: 'SUCCESS',
      details: { icdCode: dto.icdCode },
    });

    return diagnosis;
  }

  static async addMedicationOrder(dto: AddMedicationOrderDTO, actorUserId?: string) {
    const encounter = await prisma.encounter.findUnique({
      where: { id: dto.encounterId },
    });

    if (!encounter) {
      throw new NotFoundError(`Encounter ${dto.encounterId} not found`);
    }

    if (encounter.patientId !== dto.patientId) {
      throw new BadRequestError('Encounter patient mismatch');
    }

    const medicationOrder = await prisma.medicationOrder.create({
      data: {
        encounterId: dto.encounterId,
        patientId: dto.patientId,
        providerId: dto.providerId,
        medicationName: dto.medicationName,
        dosage: dto.dosage,
        frequency: dto.frequency,
        duration: dto.duration,
        instructions: dto.instructions,
        status: 'ACTIVE',
      },
    });

    await recordAudit({
      userId: actorUserId,
      action: 'MEDICATION_ORDERED',
      entity: 'MedicationOrder',
      entityId: medicationOrder.id,
      status: 'SUCCESS',
      details: { medication: dto.medicationName },
    });

    return medicationOrder;
  }
}
