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

  static async updateStatus(id: string, newStatus: string, actorUserId?: string, notes?: string) {
    const encounter = await prisma.encounter.findUnique({ where: { id } });
    if (!encounter) {
      throw new NotFoundError(`Encounter ${id} not found`);
    }

    const current = encounter.status;

    if (current === 'COMPLETED' || current === 'CANCELLED') {
      throw new BadRequestError(`Cannot transition encounter from terminal status '${current}'`);
    }

    const validNext: Record<string, string[]> = {
      PLANNED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
    };

    if (!validNext[current] || !validNext[current].includes(newStatus)) {
      throw new BadRequestError(`Invalid encounter status transition from '${current}' to '${newStatus}'`);
    }

    const isEnding = newStatus === 'COMPLETED' || newStatus === 'CANCELLED';

    const updated = await prisma.encounter.update({
      where: { id },
      data: {
        status: newStatus as any,
        endedAt: isEnding ? new Date() : undefined,
        notes: notes ? (encounter.notes ? `${encounter.notes}\n[Update]: ${notes}` : notes) : undefined,
      },
    });

    if (encounter.appointmentId && isEnding) {
      await prisma.appointment.update({
        where: { id: encounter.appointmentId },
        data: { status: newStatus === 'COMPLETED' ? 'COMPLETED' : 'CANCELLED' },
      });
    }

    await recordAudit({
      userId: actorUserId,
      action: 'ENCOUNTER_STATUS_TRANSITION',
      entity: 'Encounter',
      entityId: id,
      status: 'SUCCESS',
      details: { previousStatus: current, newStatus },
    });

    return updated;
  }

  static async updateMedicationOrderStatus(id: string, newStatus: string, actorUserId?: string) {
    const order = await prisma.medicationOrder.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundError(`Medication order ${id} not found`);
    }

    const current = order.status;
    if (current === 'COMPLETED' || current === 'CANCELLED') {
      throw new BadRequestError(`Cannot transition prescription from terminal status '${current}'`);
    }

    const validNext: Record<string, string[]> = {
      ACTIVE: ['DISPENSED', 'COMPLETED', 'CANCELLED'],
      DISPENSED: ['COMPLETED', 'CANCELLED'],
    };

    if (!validNext[current] || !validNext[current].includes(newStatus)) {
      throw new BadRequestError(`Invalid prescription status transition from '${current}' to '${newStatus}'`);
    }

    const updated = await prisma.medicationOrder.update({
      where: { id },
      data: { status: newStatus as any },
    });

    await recordAudit({
      userId: actorUserId,
      action: 'MEDICATION_STATUS_TRANSITION',
      entity: 'MedicationOrder',
      entityId: id,
      status: 'SUCCESS',
      details: { previousStatus: current, newStatus },
    });

    return updated;
  }

  static async getPatientPrescriptions(patientId: string) {
    return prisma.medicationOrder.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        provider: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });
  }
}
