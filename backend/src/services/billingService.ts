import { prisma } from '../prisma.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { parsePagination, formatPaginatedResponse } from '../utils/pagination.js';
import { recordAudit } from './auditService.js';

export interface CreateInvoiceDTO {
  patientId: string;
  encounterId?: string;
  amount: number;
  tax?: number;
  discount?: number;
  dueDate: string;
}

export class BillingService {
  static async createInvoice(dto: CreateInvoiceDTO, actorUserId?: string) {
    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${year}-${randomSuffix}`;

    const totalAmount = dto.amount + (dto.tax || 0) - (dto.discount || 0);

    const invoice = await prisma.invoice.create({
      data: {
        patientId: dto.patientId,
        encounterId: dto.encounterId || null,
        invoiceNumber,
        amount: dto.amount,
        tax: dto.tax || 0,
        discount: dto.discount || 0,
        totalAmount,
        status: 'PENDING',
        dueDate: new Date(dto.dueDate),
      },
    });

    await recordAudit({
      userId: actorUserId,
      action: 'INVOICE_CREATED',
      entity: 'Invoice',
      entityId: invoice.id,
      status: 'SUCCESS',
      details: { invoiceNumber, totalAmount },
    });

    return invoice;
  }

  static async getInvoices(query: any, requestingPatientId?: string) {
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

    const [total, invoices] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
        },
      }),
    ]);

    return formatPaginatedResponse(invoices, total, pagination);
  }

  static async payInvoice(invoiceId: string, actorUserId?: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundError(`Invoice ${invoiceId} not found`);
    }

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    });

    await recordAudit({
      userId: actorUserId,
      action: 'INVOICE_PAID',
      entity: 'Invoice',
      entityId: invoiceId,
      status: 'SUCCESS',
    });

    return updated;
  }
}
