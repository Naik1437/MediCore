import { prisma } from '../prisma.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { parsePagination, formatPaginatedResponse } from '../utils/pagination.js';
import { recordAudit } from './auditService.js';

export interface CreateWaitingListDTO {
  patientId: string;
  departmentId: string;
  providerId?: string;
  priority?: 'LOW' | 'NORMAL' | 'URGENT';
  notes?: string;
  requestedDate: string;
}

export class WaitingListService {
  static async create(dto: CreateWaitingListDTO, actorUserId?: string) {
    const item = await prisma.waitingList.create({
      data: {
        patientId: dto.patientId,
        departmentId: dto.departmentId,
        providerId: dto.providerId || null,
        priority: dto.priority || 'NORMAL',
        status: 'WAITING',
        notes: dto.notes,
        requestedDate: new Date(dto.requestedDate),
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
        department: { select: { id: true, name: true, code: true } },
        provider: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    await recordAudit({
      userId: actorUserId,
      action: 'WAITING_LIST_ADDED',
      entity: 'WaitingList',
      entityId: item.id,
      status: 'SUCCESS',
      details: { patientId: dto.patientId, priority: item.priority },
    });

    return item;
  }

  static async list(query: any) {
    const pagination = parsePagination(query);
    const where: any = {};

    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;

    const [total, items] = await Promise.all([
      prisma.waitingList.count({ where }),
      prisma.waitingList.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { requestedDate: 'asc' },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
          department: { select: { id: true, name: true, code: true } },
          provider: {
            include: { user: { select: { firstName: true, lastName: true } } },
          },
        },
      }),
    ]);

    return formatPaginatedResponse(items, total, pagination);
  }

  static async updateStatus(id: string, newStatus: string, actorUserId?: string, notes?: string) {
    const item = await prisma.waitingList.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundError(`Waiting list entry ${id} not found`);
    }

    const current = item.status;
    if (current === 'SCHEDULED' || current === 'CANCELLED' || current === 'EXPIRED') {
      throw new BadRequestError(`Cannot transition waiting list entry from terminal status '${current}'`);
    }

    const validNext = ['SCHEDULED', 'CANCELLED', 'EXPIRED'];
    if (!validNext.includes(newStatus)) {
      throw new BadRequestError(`Invalid waiting list status transition from '${current}' to '${newStatus}'`);
    }

    const updated = await prisma.waitingList.update({
      where: { id },
      data: {
        status: newStatus as any,
        notes: notes ? (item.notes ? `${item.notes}\n[Status Change]: ${notes}` : notes) : undefined,
      },
    });

    await recordAudit({
      userId: actorUserId,
      action: 'WAITING_LIST_STATUS_TRANSITION',
      entity: 'WaitingList',
      entityId: id,
      status: 'SUCCESS',
      details: { previousStatus: current, newStatus },
    });

    return updated;
  }
}
