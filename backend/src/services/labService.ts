import { prisma } from '../prisma.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { parsePagination, formatPaginatedResponse } from '../utils/pagination.js';
import { recordAudit } from './auditService.js';

export interface CreateLabOrderDTO {
  encounterId: string;
  patientId: string;
  providerId: string;
  departmentId: string;
  testType: string;
  priority?: 'STAT' | 'URGENT' | 'ROUTINE';
  clinicalNotes?: string;
}

export interface RecordLabResultDTO {
  labOrderId: string;
  patientId: string;
  technicianId: string;
  resultValues: Record<string, any>;
  referenceRange?: string;
  interpretation?: string;
  status?: 'PRELIMINARY' | 'FINAL' | 'AMENDED';
}

export class LabService {
  static async createLabOrder(dto: CreateLabOrderDTO, actorUserId?: string) {
    const order = await prisma.labOrder.create({
      data: {
        encounterId: dto.encounterId,
        patientId: dto.patientId,
        providerId: dto.providerId,
        departmentId: dto.departmentId,
        testType: dto.testType,
        priority: dto.priority || 'ROUTINE',
        status: 'ORDERED',
        clinicalNotes: dto.clinicalNotes,
      },
    });

    await recordAudit({
      userId: actorUserId,
      action: 'LAB_ORDER_CREATED',
      entity: 'LabOrder',
      entityId: order.id,
      status: 'SUCCESS',
      details: { testType: dto.testType, priority: dto.priority },
    });

    return order;
  }

  static async getLabOrders(query: any, requestingPatientId?: string) {
    const pagination = parsePagination(query);
    const where: any = {};

    if (requestingPatientId) {
      where.patientId = requestingPatientId;
    } else if (query.patientId) {
      where.patientId = query.patientId;
    }

    if (query.status) {
      where.status = query.status;
    }

    const [total, orders] = await Promise.all([
      prisma.labOrder.count({ where }),
      prisma.labOrder.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
          labResults: true,
        },
      }),
    ]);

    return formatPaginatedResponse(orders, total, pagination);
  }

  /**
   * Records a laboratory result with strict validation preventing incorrect lab-result-to-patient associations.
   */
  static async recordLabResult(dto: RecordLabResultDTO, actorUserId?: string) {
    const labOrder = await prisma.labOrder.findUnique({
      where: { id: dto.labOrderId },
    });

    if (!labOrder) {
      throw new NotFoundError(`Lab order ${dto.labOrderId} does not exist`);
    }

    // CRITICAL SECURITY & CLINICAL INTEGRITY CHECK:
    // Prevent incorrect lab-result-to-patient associations
    if (labOrder.patientId !== dto.patientId) {
      await recordAudit({
        userId: actorUserId,
        action: 'LAB_RESULT_PATIENT_MISMATCH_REJECTED',
        entity: 'LabResult',
        entityId: dto.labOrderId,
        status: 'DENIED',
        details: {
          orderPatientId: labOrder.patientId,
          providedPatientId: dto.patientId,
        },
      });

      throw new BadRequestError(
        'Integrity violation: The specified patient does not match the patient associated with this laboratory order'
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const createdResult = await tx.labResult.create({
        data: {
          labOrderId: dto.labOrderId,
          patientId: dto.patientId,
          technicianId: dto.technicianId,
          resultValues: dto.resultValues,
          referenceRange: dto.referenceRange,
          interpretation: dto.interpretation,
          status: dto.status || 'FINAL',
          verifiedAt: new Date(),
        },
      });

      await tx.labOrder.update({
        where: { id: dto.labOrderId },
        data: { status: 'COMPLETED' },
      });

      return createdResult;
    });

    await recordAudit({
      userId: actorUserId,
      action: 'LAB_RESULT_RECORDED',
      entity: 'LabResult',
      entityId: result.id,
      status: 'SUCCESS',
      details: { labOrderId: dto.labOrderId, status: result.status },
    });

    return result;
  }

  static async getLabResults(query: any, requestingPatientId?: string) {
    const pagination = parsePagination(query);
    const where: any = {};

    if (requestingPatientId) {
      where.patientId = requestingPatientId;
    } else if (query.patientId) {
      where.patientId = query.patientId;
    }

    const [total, results] = await Promise.all([
      prisma.labResult.count({ where }),
      prisma.labResult.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          labOrder: true,
          patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
          technician: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    ]);

    return formatPaginatedResponse(results, total, pagination);
  }

  static async updateOrderStatus(id: string, newStatus: string, actorUserId?: string) {
    const order = await prisma.labOrder.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundError(`Lab order ${id} not found`);
    }

    const current = order.status;
    if (current === 'COMPLETED' || current === 'CANCELLED') {
      throw new BadRequestError(`Cannot transition lab order from terminal status '${current}'`);
    }

    const validNext: Record<string, string[]> = {
      ORDERED: ['SAMPLE_COLLECTED', 'CANCELLED'],
      SAMPLE_COLLECTED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
    };

    if (!validNext[current] || !validNext[current].includes(newStatus)) {
      throw new BadRequestError(`Invalid lab order status transition from '${current}' to '${newStatus}'`);
    }

    const updated = await prisma.labOrder.update({
      where: { id },
      data: { status: newStatus as any },
    });

    await recordAudit({
      userId: actorUserId,
      action: 'LAB_ORDER_STATUS_TRANSITION',
      entity: 'LabOrder',
      entityId: id,
      status: 'SUCCESS',
      details: { previousStatus: current, newStatus },
    });

    return updated;
  }
}
