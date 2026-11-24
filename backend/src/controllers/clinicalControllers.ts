import { Request, Response, NextFunction } from 'express';
import { PatientService } from '../services/patientService.js';
import { AppointmentService } from '../services/appointmentService.js';
import { EncounterService } from '../services/encounterService.js';
import { LabService } from '../services/labService.js';
import { BillingService } from '../services/billingService.js';
import { ConsentService } from '../services/consentService.js';
import { DepartmentService, StaffService, ProviderService } from '../services/adminStaffService.js';
import { prisma } from '../prisma.js';
import { parsePagination, formatPaginatedResponse } from '../utils/pagination.js';
import { ForbiddenError } from '../utils/errors.js';
import { UserRole } from '../constants/roles.js';

export class PatientController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const patient = await PatientService.createPatient(req.body, req.user?.userId);
      res.status(201).json({ success: true, data: patient });
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PatientService.getPatients(req.query);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      // IDOR protection
      if (req.user?.role === UserRole.PATIENT && req.user.patientId !== req.params.id) {
        throw new ForbiddenError('You can only access your own patient profile');
      }
      const patient = await PatientService.getPatientById(req.params.id, req.user?.userId);
      res.status(200).json({ success: true, data: patient });
    } catch (error) {
      next(error);
    }
  }
}

export class AppointmentController {
  static async book(req: Request, res: Response, next: NextFunction) {
    try {
      // If caller is patient, ensure they can only book for themselves
      if (req.user?.role === UserRole.PATIENT && req.user.patientId && req.body.patientId !== req.user.patientId) {
        throw new ForbiddenError('Patients can only schedule appointments for their own profile');
      }

      const appointment = await AppointmentService.bookAppointment(req.body, req.user?.userId);
      res.status(201).json({ success: true, data: appointment });
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const requestingPatientId = req.user?.role === UserRole.PATIENT ? req.user.patientId : undefined;
      const result = await AppointmentService.getAppointments(req.query, requestingPatientId);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  static async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await AppointmentService.cancelAppointment(
        req.params.id,
        req.body?.reason || 'Cancelled by requester',
        req.user?.userId
      );
      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
}

export class EncounterController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const encounter = await EncounterService.createEncounter(req.body, req.user?.userId);
      res.status(201).json({ success: true, data: encounter });
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const requestingPatientId = req.user?.role === UserRole.PATIENT ? req.user.patientId : undefined;
      const result = await EncounterService.getEncounters(req.query, requestingPatientId, req.user?.userId);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  static async addDiagnosis(req: Request, res: Response, next: NextFunction) {
    try {
      const diagnosis = await EncounterService.addDiagnosis(
        { ...req.body, encounterId: req.params.id },
        req.user?.userId
      );
      res.status(201).json({ success: true, data: diagnosis });
    } catch (error) {
      next(error);
    }
  }

  static async addPrescription(req: Request, res: Response, next: NextFunction) {
    try {
      const prescription = await EncounterService.addMedicationOrder(
        { ...req.body, encounterId: req.params.id },
        req.user?.userId
      );
      res.status(201).json({ success: true, data: prescription });
    } catch (error) {
      next(error);
    }
  }
}

export class LabController {
  static async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await LabService.createLabOrder(req.body, req.user?.userId);
      res.status(201).json({ success: true, data: order });
    } catch (error) {
      next(error);
    }
  }

  static async listOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const requestingPatientId = req.user?.role === UserRole.PATIENT ? req.user.patientId : undefined;
      const result = await LabService.getLabOrders(req.query, requestingPatientId);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  static async recordResult(req: Request, res: Response, next: NextFunction) {
    try {
      const technicianId = req.user?.userId as string;
      const result = await LabService.recordLabResult(
        { ...req.body, technicianId },
        req.user?.userId
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async listResults(req: Request, res: Response, next: NextFunction) {
    try {
      const requestingPatientId = req.user?.role === UserRole.PATIENT ? req.user.patientId : undefined;
      const result = await LabService.getLabResults(req.query, requestingPatientId);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}

export class BillingController {
  static async createInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const invoice = await BillingService.createInvoice(req.body, req.user?.userId);
      res.status(201).json({ success: true, data: invoice });
    } catch (error) {
      next(error);
    }
  }

  static async listInvoices(req: Request, res: Response, next: NextFunction) {
    try {
      const requestingPatientId = req.user?.role === UserRole.PATIENT ? req.user.patientId : undefined;
      const result = await BillingService.getInvoices(req.query, requestingPatientId);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  static async pay(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await BillingService.payInvoice(req.params.id, req.user?.userId);
      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }
}

export class ConsentController {
  static async recordConsent(req: Request, res: Response, next: NextFunction) {
    try {
      if (req.user?.role === UserRole.PATIENT && req.user.patientId && req.body.patientId !== req.user.patientId) {
        throw new ForbiddenError('Patients can only modify their own consent records');
      }
      const consent = await ConsentService.recordConsent(req.body, req.user?.userId);
      res.status(201).json({ success: true, data: consent });
    } catch (error) {
      next(error);
    }
  }

  static async revokeConsent(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await ConsentService.revokeConsent(req.params.id, req.user?.userId);
      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  static async getByPatient(req: Request, res: Response, next: NextFunction) {
    try {
      if (req.user?.role === UserRole.PATIENT && req.user.patientId !== req.params.patientId) {
        throw new ForbiddenError('Patients can only view their own consent records');
      }
      const list = await ConsentService.getPatientConsents(req.params.patientId);
      res.status(200).json({ success: true, data: list });
    } catch (error) {
      next(error);
    }
  }
}

export class AdminStaffController {
  static async listDepartments(req: Request, res: Response, next: NextFunction) {
    try {
      const depts = await DepartmentService.listDepartments();
      res.status(200).json({ success: true, data: depts });
    } catch (error) {
      next(error);
    }
  }

  static async createDepartment(req: Request, res: Response, next: NextFunction) {
    try {
      const dept = await DepartmentService.createDepartment(req.body);
      res.status(201).json({ success: true, data: dept });
    } catch (error) {
      next(error);
    }
  }

  static async listStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const staff = await StaffService.listStaff();
      res.status(200).json({ success: true, data: staff });
    } catch (error) {
      next(error);
    }
  }

  static async listProviders(req: Request, res: Response, next: NextFunction) {
    try {
      const providers = await ProviderService.listProviders(req.query.departmentId as string);
      res.status(200).json({ success: true, data: providers });
    } catch (error) {
      next(error);
    }
  }

  static async createSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const schedule = await ProviderService.createSchedule(req.body);
      res.status(201).json({ success: true, data: schedule });
    } catch (error) {
      next(error);
    }
  }

  static async listAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = parsePagination(req.query);
      const where: any = {};
      if (req.query.action) where.action = req.query.action as string;
      if (req.query.entity) where.entity = req.query.entity as string;

      const [total, records] = await Promise.all([
        prisma.auditRecord.count({ where }),
        prisma.auditRecord.findMany({
          where,
          skip: pagination.skip,
          take: pagination.limit,
          orderBy: { timestamp: 'desc' },
        }),
      ]);

      res.status(200).json({
        success: true,
        ...formatPaginatedResponse(records, total, pagination),
      });
    } catch (error) {
      next(error);
    }
  }
}
