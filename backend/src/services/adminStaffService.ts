import { prisma } from '../prisma.js';
import { NotFoundError } from '../utils/errors.js';

export class DepartmentService {
  static async listDepartments() {
    return prisma.department.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  static async createDepartment(data: { name: string; code: string; description?: string }) {
    return prisma.department.create({
      data: {
        name: data.name,
        code: data.code.toUpperCase(),
        description: data.description,
      },
    });
  }
}

export class StaffService {
  static async listStaff() {
    return prisma.staff.findMany({
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        department: { select: { id: true, name: true, code: true } },
      },
    });
  }
}

export class ProviderService {
  static async listProviders(departmentId?: string) {
    const where: any = { status: 'ACTIVE' };
    if (departmentId) {
      where.departmentId = departmentId;
    }
    return prisma.provider.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        department: { select: { id: true, name: true, code: true } },
        schedules: { where: { isActive: true } },
      },
    });
  }

  static async createSchedule(data: {
    providerId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    slotDurationMinutes?: number;
  }) {
    return prisma.providerSchedule.create({
      data: {
        providerId: data.providerId,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        slotDurationMinutes: data.slotDurationMinutes || 30,
      },
    });
  }
}
