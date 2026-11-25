import { Router } from 'express';
import { AuthController } from '../../controllers/authController.js';
import {
  PatientController,
  AppointmentController,
  EncounterController,
  LabController,
  BillingController,
  ConsentController,
  AdminStaffController,
  WaitingListController,
} from '../../controllers/clinicalControllers.js';
import { HealthController } from '../../controllers/healthController.js';
import { AnalyticsController } from '../../controllers/analyticsController.js';
import { FHIRController } from '../../controllers/fhirController.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { requireRoles } from '../../middlewares/authorize.js';
import { enforceClinicalAccess } from '../../middlewares/clinicalAccess.js';
import { validate } from '../../middlewares/validate.js';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  createPatientSchema,
  createDepartmentSchema,
  createScheduleSchema,
  createAppointmentSchema,
  createEncounterSchema,
  createDiagnosisSchema,
  createMedicationOrderSchema,
  createLabOrderSchema,
  recordLabResultSchema,
  createInvoiceSchema,
  createConsentSchema,
  updateEncounterStatusSchema,
  updateMedicationOrderStatusSchema,
  updateLabOrderStatusSchema,
  createWaitingListItemSchema,
  updateWaitingListStatusSchema,
} from '../../validators/schemas.js';
import { UserRole } from '../../constants/roles.js';

const router = Router();

// Health endpoints
router.get('/health/live', HealthController.live);
router.get('/health/ready', HealthController.ready);

// Auth endpoints
router.post('/auth/register', validate(registerSchema), AuthController.register);
router.post('/auth/login', validate(loginSchema), AuthController.login);
router.post('/auth/refresh', validate(refreshTokenSchema), AuthController.refreshToken);
router.post('/auth/logout', AuthController.logout);
router.get('/auth/me', authenticate, AuthController.me);

// Patients endpoints
router.post(
  '/patients',
  authenticate,
  requireRoles(UserRole.PATIENT, UserRole.RECEPTIONIST, UserRole.HOSPITAL_ADMIN, UserRole.DOCTOR),
  validate(createPatientSchema),
  PatientController.create
);
router.get(
  '/patients',
  authenticate,
  requireRoles(UserRole.RECEPTIONIST, UserRole.DOCTOR, UserRole.NURSE, UserRole.HOSPITAL_ADMIN, UserRole.BILLING_OFFICER),
  PatientController.list
);
router.get(
  '/patients/:id',
  authenticate,
  requireRoles(UserRole.PATIENT, UserRole.RECEPTIONIST, UserRole.DOCTOR, UserRole.NURSE, UserRole.HOSPITAL_ADMIN),
  PatientController.getById
);

// Departments & Staff endpoints
router.get('/departments', authenticate, AdminStaffController.listDepartments);
router.post(
  '/departments',
  authenticate,
  requireRoles(UserRole.HOSPITAL_ADMIN),
  validate(createDepartmentSchema),
  AdminStaffController.createDepartment
);
router.get(
  '/staff',
  authenticate,
  requireRoles(UserRole.HOSPITAL_ADMIN, UserRole.RECEPTIONIST),
  AdminStaffController.listStaff
);

// Providers & Schedules
router.get('/providers', authenticate, AdminStaffController.listProviders);
router.get('/providers/:id/availability', authenticate, AppointmentController.getAvailability);
router.post(
  '/providers/schedules',
  authenticate,
  requireRoles(UserRole.DOCTOR, UserRole.HOSPITAL_ADMIN),
  validate(createScheduleSchema),
  AdminStaffController.createSchedule
);

// Appointments
router.post(
  '/appointments',
  authenticate,
  requireRoles(UserRole.PATIENT, UserRole.RECEPTIONIST, UserRole.DOCTOR, UserRole.NURSE),
  validate(createAppointmentSchema),
  AppointmentController.book
);
router.get(
  '/appointments',
  authenticate,
  requireRoles(UserRole.PATIENT, UserRole.RECEPTIONIST, UserRole.DOCTOR, UserRole.NURSE),
  AppointmentController.list
);
router.get(
  '/appointments/:id',
  authenticate,
  requireRoles(UserRole.PATIENT, UserRole.RECEPTIONIST, UserRole.DOCTOR, UserRole.NURSE, UserRole.HOSPITAL_ADMIN),
  AppointmentController.getById
);
router.post(
  '/appointments/:id/cancel',
  authenticate,
  requireRoles(UserRole.PATIENT, UserRole.RECEPTIONIST, UserRole.DOCTOR, UserRole.NURSE),
  AppointmentController.cancel
);
router.post(
  '/appointments/:id/check-in',
  authenticate,
  requireRoles(UserRole.RECEPTIONIST, UserRole.NURSE, UserRole.DOCTOR),
  AppointmentController.checkIn
);

// Encounters & Clinical Data
// Enforce clinical access rule: HOSPITAL_ADMIN explicitly restricted!
router.post(
  '/encounters',
  authenticate,
  enforceClinicalAccess,
  requireRoles(UserRole.DOCTOR, UserRole.NURSE),
  validate(createEncounterSchema),
  EncounterController.create
);
router.get(
  '/encounters',
  authenticate,
  enforceClinicalAccess,
  requireRoles(UserRole.DOCTOR, UserRole.NURSE, UserRole.PATIENT),
  EncounterController.list
);
router.get(
  '/encounters/:id',
  authenticate,
  enforceClinicalAccess,
  requireRoles(UserRole.DOCTOR, UserRole.NURSE, UserRole.PATIENT),
  EncounterController.getById
);
router.post(
  '/encounters/:id/diagnoses',
  authenticate,
  enforceClinicalAccess,
  requireRoles(UserRole.DOCTOR),
  validate(createDiagnosisSchema),
  EncounterController.addDiagnosis
);
router.post(
  '/encounters/:id/prescriptions',
  authenticate,
  enforceClinicalAccess,
  requireRoles(UserRole.DOCTOR),
  validate(createMedicationOrderSchema),
  EncounterController.addPrescription
);
router.patch(
  '/encounters/:id/status',
  authenticate,
  enforceClinicalAccess,
  requireRoles(UserRole.DOCTOR, UserRole.NURSE),
  validate(updateEncounterStatusSchema),
  EncounterController.updateStatus
);
router.patch(
  '/prescriptions/:id/status',
  authenticate,
  requireRoles(UserRole.DOCTOR, UserRole.NURSE, UserRole.BILLING_OFFICER),
  validate(updateMedicationOrderStatusSchema),
  EncounterController.updateMedicationStatus
);
router.get(
  '/prescriptions/patient/:patientId',
  authenticate,
  enforceClinicalAccess,
  requireRoles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.NURSE),
  EncounterController.getPatientPrescriptions
);

// Laboratory Orders & Results
router.post(
  '/lab/orders',
  authenticate,
  enforceClinicalAccess,
  requireRoles(UserRole.DOCTOR, UserRole.NURSE),
  validate(createLabOrderSchema),
  LabController.createOrder
);
router.get(
  '/lab/orders',
  authenticate,
  enforceClinicalAccess,
  requireRoles(UserRole.DOCTOR, UserRole.NURSE, UserRole.LAB_TECHNICIAN, UserRole.PATIENT),
  LabController.listOrders
);
router.patch(
  '/lab/orders/:id/status',
  authenticate,
  enforceClinicalAccess,
  requireRoles(UserRole.LAB_TECHNICIAN, UserRole.DOCTOR, UserRole.NURSE),
  validate(updateLabOrderStatusSchema),
  LabController.updateOrderStatus
);
router.post(
  '/lab/results',
  authenticate,
  enforceClinicalAccess,
  requireRoles(UserRole.LAB_TECHNICIAN, UserRole.DOCTOR),
  validate(recordLabResultSchema),
  LabController.recordResult
);
router.get(
  '/lab/results',
  authenticate,
  enforceClinicalAccess,
  requireRoles(UserRole.DOCTOR, UserRole.NURSE, UserRole.LAB_TECHNICIAN, UserRole.PATIENT),
  LabController.listResults
);

// Billing & Invoices
router.post(
  '/billing/invoices',
  authenticate,
  requireRoles(UserRole.BILLING_OFFICER, UserRole.HOSPITAL_ADMIN),
  validate(createInvoiceSchema),
  BillingController.createInvoice
);
router.get(
  '/billing/invoices',
  authenticate,
  requireRoles(UserRole.BILLING_OFFICER, UserRole.HOSPITAL_ADMIN, UserRole.PATIENT),
  BillingController.listInvoices
);
router.post(
  '/billing/invoices/:id/pay',
  authenticate,
  requireRoles(UserRole.BILLING_OFFICER, UserRole.PATIENT),
  BillingController.pay
);

// Consents
router.post(
  '/consents',
  authenticate,
  requireRoles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.NURSE),
  validate(createConsentSchema),
  ConsentController.recordConsent
);
router.post(
  '/consents/:id/revoke',
  authenticate,
  requireRoles(UserRole.PATIENT),
  ConsentController.revokeConsent
);
router.post(
  '/consents/:id/grant',
  authenticate,
  requireRoles(UserRole.PATIENT),
  ConsentController.grantConsent
);
router.get(
  '/consents/patient/:patientId',
  authenticate,
  requireRoles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.NURSE, UserRole.HOSPITAL_ADMIN),
  ConsentController.getByPatient
);

// Audit Records (Admin only)
router.get(
  '/audit',
  authenticate,
  requireRoles(UserRole.HOSPITAL_ADMIN),
  AdminStaffController.listAuditLogs
);

// Admin Operational Metrics & Summaries (Admin only, Zero-PHI aggregation)
router.get(
  '/admin/summary',
  authenticate,
  requireRoles(UserRole.HOSPITAL_ADMIN),
  AdminStaffController.getOperationalSummary
);

// Waiting List Workflows (MC-07)
router.post(
  '/waiting-list',
  authenticate,
  requireRoles(UserRole.PATIENT, UserRole.RECEPTIONIST, UserRole.DOCTOR, UserRole.NURSE, UserRole.HOSPITAL_ADMIN),
  validate(createWaitingListItemSchema),
  WaitingListController.create
);
router.get(
  '/waiting-list',
  authenticate,
  requireRoles(UserRole.RECEPTIONIST, UserRole.DOCTOR, UserRole.NURSE, UserRole.HOSPITAL_ADMIN),
  WaitingListController.list
);
router.patch(
  '/waiting-list/:id/status',
  authenticate,
  requireRoles(UserRole.RECEPTIONIST, UserRole.HOSPITAL_ADMIN),
  validate(updateWaitingListStatusSchema),
  WaitingListController.updateStatus
);

// Clinical Analytics & Intelligence (MC-06 - Port 8002 integration)
router.get(
  '/analytics/utilization',
  authenticate,
  requireRoles(UserRole.HOSPITAL_ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST),
  AnalyticsController.getUtilization
);
router.get(
  '/analytics/wait-times',
  authenticate,
  requireRoles(UserRole.HOSPITAL_ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.RECEPTIONIST),
  AnalyticsController.getWaitTimes
);
router.get(
  '/analytics/lab-turnaround',
  authenticate,
  requireRoles(UserRole.HOSPITAL_ADMIN, UserRole.LAB_TECHNICIAN, UserRole.DOCTOR),
  AnalyticsController.getLabTurnaround
);
router.get(
  '/analytics/population-health',
  authenticate,
  requireRoles(UserRole.HOSPITAL_ADMIN, UserRole.DOCTOR),
  AnalyticsController.getPopulationHealth
);

// FHIR R4 Interoperability Endpoints (MC-08)
router.get('/fhir/r4/metadata', FHIRController.getMetadata);
router.get(
  '/fhir/r4/Patient/:id',
  authenticate,
  requireRoles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.NURSE, UserRole.RECEPTIONIST),
  FHIRController.getPatient
);
router.get(
  '/fhir/r4/Appointment/:id',
  authenticate,
  requireRoles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.NURSE, UserRole.RECEPTIONIST),
  FHIRController.getAppointment
);
router.get(
  '/fhir/r4/Encounter/:id',
  authenticate,
  enforceClinicalAccess,
  requireRoles(UserRole.DOCTOR, UserRole.NURSE, UserRole.PATIENT),
  FHIRController.getEncounter
);
router.get(
  '/fhir/r4/Observation',
  authenticate,
  requireRoles(UserRole.DOCTOR, UserRole.NURSE, UserRole.LAB_TECHNICIAN, UserRole.PATIENT),
  FHIRController.searchObservations
);

export default router;
