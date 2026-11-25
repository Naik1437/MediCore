import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma.js';
import { UserRole } from '../constants/roles.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';

export class FHIRController {
  static async getMetadata(req: Request, res: Response) {
    res.status(200).json({
      resourceType: 'CapabilityStatement',
      status: 'active',
      date: new Date().toISOString().split('T')[0],
      publisher: 'MediCore Hospital Platform',
      kind: 'instance',
      fhirVersion: '4.0.1',
      format: ['json'],
      rest: [
        {
          mode: 'server',
          resource: [
            { type: 'Patient', interaction: [{ code: 'read' }, { code: 'search-type' }] },
            { type: 'Appointment', interaction: [{ code: 'read' }, { code: 'search-type' }] },
            { type: 'Encounter', interaction: [{ code: 'read' }, { code: 'search-type' }] },
            { type: 'Observation', interaction: [{ code: 'read' }, { code: 'search-type' }] },
          ],
        },
      ],
    });
  }

  static async getPatient(req: Request, res: Response, next: NextFunction) {
    try {
      const patientId = req.params.id;
      // IDOR & Consent enforcement
      if (req.user?.role === UserRole.PATIENT && req.user.patientId && req.user.patientId !== patientId) {
        throw new ForbiddenError('You can only view your own FHIR patient record');
      }

      if (req.user?.role && req.user.role !== UserRole.PATIENT) {
        const revoked = await prisma.consent.findFirst({
          where: { patientId, status: 'REVOKED' },
        });
        if (revoked) {
          throw new ForbiddenError('FHIR patient exchange blocked: Active consent directive revoked');
        }
      }

      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
      });
      if (!patient) {
        throw new NotFoundError(`FHIR Patient ${patientId} not found`);
      }

      const gender = (patient.gender || 'unknown').toLowerCase();
      res.status(200).json({
        resourceType: 'Patient',
        id: patient.id,
        meta: {
          versionId: '1',
          lastUpdated: patient.updatedAt.toISOString(),
          profile: ['http://hl7.org/fhir/StructureDefinition/Patient'],
        },
        identifier: [
          {
            use: 'usual',
            type: {
              coding: [
                { system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MR', display: 'Medical Record Number' },
              ],
            },
            system: 'http://hospital.medicore.local/mrn',
            value: patient.mrn,
          },
        ],
        active: true,
        name: [
          {
            use: 'official',
            family: patient.lastName,
            given: [patient.firstName],
          },
        ],
        gender: ['male', 'female', 'other'].includes(gender) ? gender : 'unknown',
        birthDate: patient.dob.toISOString().split('T')[0],
        telecom: [
          ...(patient.phone ? [{ system: 'phone', value: patient.phone, use: 'mobile' }] : []),
          ...(patient.email ? [{ system: 'email', value: patient.email }] : []),
        ],
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      const appt = await prisma.appointment.findUnique({
        where: { id: req.params.id },
        include: { patient: true, provider: true },
      });
      if (!appt) {
        throw new NotFoundError(`FHIR Appointment ${req.params.id} not found`);
      }

      if (req.user?.role === UserRole.PATIENT && req.user.patientId && appt.patientId !== req.user.patientId) {
        throw new ForbiddenError('You can only view your own FHIR appointments');
      }

      const statusMap: Record<string, string> = {
        SCHEDULED: 'booked',
        CONFIRMED: 'booked',
        IN_PROGRESS: 'arrived',
        COMPLETED: 'fulfilled',
        CANCELLED: 'cancelled',
        NO_SHOW: 'noshow',
      };

      res.status(200).json({
        resourceType: 'Appointment',
        id: appt.id,
        meta: {
          versionId: '1',
          lastUpdated: appt.updatedAt.toISOString(),
          profile: ['http://hl7.org/fhir/StructureDefinition/Appointment'],
        },
        status: statusMap[appt.status] || 'proposed',
        description: appt.reason,
        start: appt.scheduledStart.toISOString(),
        end: appt.scheduledEnd.toISOString(),
        participant: [
          { actor: { reference: `Patient/${appt.patientId}`, display: `${appt.patient.firstName} ${appt.patient.lastName}` }, status: 'accepted' },
          { actor: { reference: `Practitioner/${appt.providerId}` }, status: 'accepted' },
        ],
      });
    } catch (error) {
      next(error);
    }
  }

  static async getEncounter(req: Request, res: Response, next: NextFunction) {
    try {
      const enc = await prisma.encounter.findUnique({
        where: { id: req.params.id },
        include: { patient: true, provider: true },
      });
      if (!enc) {
        throw new NotFoundError(`FHIR Encounter ${req.params.id} not found`);
      }

      if (req.user?.role === UserRole.PATIENT && req.user.patientId && enc.patientId !== req.user.patientId) {
        throw new ForbiddenError('You can only view your own FHIR encounters');
      }

      if (req.user?.role && req.user.role !== UserRole.PATIENT) {
        const revoked = await prisma.consent.findFirst({
          where: { patientId: enc.patientId, status: 'REVOKED' },
        });
        if (revoked) {
          throw new ForbiddenError('FHIR encounter exchange blocked: Active consent directive revoked');
        }
      }

      const statusMap: Record<string, string> = {
        IN_PROGRESS: 'in-progress',
        COMPLETED: 'finished',
        CANCELLED: 'cancelled',
      };

      res.status(200).json({
        resourceType: 'Encounter',
        id: enc.id,
        meta: {
          versionId: '1',
          lastUpdated: enc.updatedAt.toISOString(),
          profile: ['http://hl7.org/fhir/StructureDefinition/Encounter'],
        },
        status: statusMap[enc.status] || 'in-progress',
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: enc.encounterType === 'EMERGENCY' ? 'EMER' : 'AMB',
          display: enc.encounterType === 'EMERGENCY' ? 'emergency' : 'ambulatory',
        },
        subject: { reference: `Patient/${enc.patientId}` },
        period: {
          start: enc.startedAt.toISOString(),
          end: enc.endedAt ? enc.endedAt.toISOString() : undefined,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async searchObservations(req: Request, res: Response, next: NextFunction) {
    try {
      const patientId = req.query.patient as string | undefined;
      const where: any = {};
      if (patientId) {
        where.patientId = patientId;
      }

      if (req.user?.role === UserRole.PATIENT && req.user.patientId) {
        where.patientId = req.user.patientId;
      } else if (req.user?.role && req.user.role !== UserRole.PATIENT) {
        // Exclude patients with revoked consent
        const revoked = await prisma.consent.findMany({
          where: { status: 'REVOKED' },
          select: { patientId: true },
        });
        if (revoked.length > 0) {
          where.patientId = { notIn: revoked.map((r) => r.patientId) };
        }
      }

      const results = await prisma.labResult.findMany({
        where,
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: { labOrder: true },
      });

      const entries = results.map((r) => ({
        fullUrl: `http://hospital.medicore.local/fhir/r4/Observation/${r.id}`,
        resource: {
          resourceType: 'Observation',
          id: r.id,
          status: 'final',
          category: [
            {
              coding: [
                { system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory', display: 'Laboratory' },
              ],
            },
          ],
          code: {
            text: r.labOrder.testType,
          },
          subject: { reference: `Patient/${r.patientId}` },
          valueString: JSON.stringify(r.resultValues),
          interpretation: r.interpretation ? [{ text: r.interpretation }] : undefined,
          referenceRange: r.referenceRange ? [{ text: r.referenceRange }] : undefined,
        },
      }));

      res.status(200).json({
        resourceType: 'Bundle',
        type: 'searchset',
        total: entries.length,
        entry: entries,
      });
    } catch (error) {
      next(error);
    }
  }
}
