import { prisma } from '../prisma.js';
import { recordAudit } from './auditService.js';

export class AdminSummaryService {
  /**
   * Generates high-level operational statistics for hospital management.
   * Strips all patient clinical details, diagnoses, and notes, returning strictly aggregate metrics.
   */
  static async getOperationalSummary(actorUserId?: string) {
    const today = new Date();
    const startOfDay = new Date(today.setUTCHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setUTCHours(23, 59, 59, 999));

    const [
      totalPatients,
      totalStaff,
      totalDepartments,
      totalProviders,
      appointmentsToday,
      activeEncounters,
      pendingLabOrders,
      pendingInvoices,
      waitingListCount,
    ] = await Promise.all([
      prisma.patient.count(),
      prisma.staff.count(),
      prisma.department.count({ where: { isActive: true } }),
      prisma.provider.count({ where: { status: 'ACTIVE' } }),
      prisma.appointment.count({
        where: {
          scheduledStart: { gte: startOfDay, lte: endOfDay },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
      }),
      prisma.encounter.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.labOrder.count({ where: { status: { in: ['ORDERED', 'SAMPLE_COLLECTED', 'IN_PROGRESS'] } } }),
      prisma.invoice.count({ where: { status: 'PENDING' } }),
      prisma.waitingList.count({ where: { status: 'WAITING' } }),
    ]);

    await recordAudit({
      userId: actorUserId,
      action: 'ADMIN_OPERATIONAL_SUMMARY_VIEWED',
      entity: 'HospitalOperationalMetrics',
      status: 'SUCCESS',
    });

    return {
      metrics: {
        totalPatients,
        totalStaff,
        totalDepartments,
        totalProviders,
        appointmentsToday,
        activeEncounters,
        pendingLabOrders,
        pendingInvoices,
        waitingListCount,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
