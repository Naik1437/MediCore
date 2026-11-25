export enum UserRole {
  PATIENT = 'PATIENT',
  RECEPTIONIST = 'RECEPTIONIST',
  DOCTOR = 'DOCTOR',
  NURSE = 'NURSE',
  LAB_TECHNICIAN = 'LAB_TECHNICIAN',
  BILLING_OFFICER = 'BILLING_OFFICER',
  HOSPITAL_ADMIN = 'HOSPITAL_ADMIN',
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone?: string;
  patientProfile?: { id: string; mrn: string; bloodGroup?: string; phone: string } | null;
  providerProfile?: { id: string; specialization: string; licenseNumber: string; departmentId: string } | null;
  staffProfile?: { id: string; employeeId: string; jobTitle: string; departmentId: string } | null;
  patientId?: string | null;
  providerId?: string | null;
  staffId?: string | null;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
}

export interface Patient {
  id: string;
  userId?: string | null;
  mrn: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  bloodGroup?: string;
  phone: string;
  email?: string;
  address?: string;
  emergencyContact?: string;
  createdAt: string;
}

export interface Provider {
  id: string;
  userId: string;
  departmentId: string;
  licenseNumber: string;
  specialization: string;
  status: string;
  user: { firstName: string; lastName: string; email: string };
  department?: Department;
  schedules?: ProviderSchedule[];
}

export interface ProviderSchedule {
  id: string;
  providerId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  isActive: boolean;
}

export interface Appointment {
  id: string;
  patientId: string;
  providerId: string;
  departmentId: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  reason: string;
  cancellationReason?: string;
  patient?: { id: string; firstName: string; lastName: string; mrn: string };
  provider?: { user: { firstName: string; lastName: string } };
  department?: { id: string; name: string; code: string };
  encounter?: { id: string; status: string } | null;
}

export interface Encounter {
  id: string;
  patientId: string;
  providerId: string;
  appointmentId?: string;
  encounterType: 'OUTPATIENT' | 'INPATIENT' | 'EMERGENCY';
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  startedAt: string;
  endedAt?: string;
  notes?: string;
  diagnoses?: Diagnosis[];
  medicationOrders?: MedicationOrder[];
  labOrders?: LabOrder[];
  patient?: { id: string; firstName: string; lastName: string; mrn: string };
  provider?: { user: { firstName: string; lastName: string } };
}

export interface Diagnosis {
  id: string;
  encounterId: string;
  patientId: string;
  providerId: string;
  icdCode: string;
  description: string;
  type: 'PRIMARY' | 'SECONDARY';
  createdAt: string;
}

export interface MedicationOrder {
  id: string;
  encounterId: string;
  patientId: string;
  providerId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'DISPENSED';
  createdAt: string;
  provider?: { user: { firstName: string; lastName: string } };
}

export interface LabOrder {
  id: string;
  encounterId: string;
  patientId: string;
  providerId: string;
  departmentId: string;
  testType: string;
  priority: 'STAT' | 'URGENT' | 'ROUTINE';
  status: 'ORDERED' | 'SAMPLE_COLLECTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  clinicalNotes?: string;
  createdAt: string;
  patient?: { id: string; firstName: string; lastName: string; mrn: string };
  labResults?: LabResult[];
}

export interface LabResult {
  id: string;
  labOrderId: string;
  patientId: string;
  technicianId: string;
  resultValues: Record<string, any>;
  referenceRange?: string;
  interpretation?: string;
  status: 'PRELIMINARY' | 'FINAL' | 'AMENDED';
  verifiedAt?: string;
  createdAt: string;
  technician?: { firstName: string; lastName: string };
}

export interface Invoice {
  id: string;
  patientId: string;
  encounterId?: string;
  invoiceNumber: string;
  amount: number;
  tax: number;
  discount: number;
  totalAmount: number;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED' | 'REFUNDED';
  dueDate: string;
  paidAt?: string;
  patient?: { firstName: string; lastName: string; mrn: string };
}

export interface Consent {
  id: string;
  patientId: string;
  providerId?: string;
  consentType: 'DATA_SHARING' | 'TREATMENT' | 'RESEARCH' | 'BILLING';
  status: 'GRANTED' | 'REVOKED' | 'EXPIRED';
  grantedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  notes?: string;
  provider?: { user: { firstName: string; lastName: string } };
}

export interface WaitingListItem {
  id: string;
  patientId: string;
  departmentId: string;
  providerId?: string;
  priority: 'LOW' | 'NORMAL' | 'URGENT';
  status: 'WAITING' | 'SCHEDULED' | 'CANCELLED' | 'EXPIRED';
  notes?: string;
  requestedDate: string;
  patient?: { firstName: string; lastName: string; mrn: string };
  department?: { name: string; code: string };
  provider?: { user: { firstName: string; lastName: string } };
}

export interface AuditRecord {
  id: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  ipAddress?: string | null;
  status: string;
  details?: any;
  timestamp: string;
}

export interface OperationalMetrics {
  totalPatients: number;
  totalStaff: number;
  totalDepartments: number;
  totalProviders: number;
  appointmentsToday: number;
  activeEncounters: number;
  pendingLabOrders: number;
  pendingInvoices: number;
  waitingListCount: number;
}

