import { z } from 'zod';
import { UserRole } from '../constants/roles.js';

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    phone: z.string().optional(),
    role: z.nativeEnum(UserRole).default(UserRole.PATIENT),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(10, 'Refresh token is required'),
  }),
});

export const createPatientSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    dob: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid date of birth format',
    }),
    gender: z.string().min(1, 'Gender is required'),
    bloodGroup: z.string().optional(),
    phone: z.string().min(5, 'Phone number is required'),
    email: z.string().email().optional(),
    address: z.string().optional(),
    emergencyContact: z.string().optional(),
  }),
});

export const createDepartmentSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Department name is required'),
    code: z.string().min(2, 'Department code is required').toUpperCase(),
    description: z.string().optional(),
  }),
});

export const createScheduleSchema = z.object({
  body: z.object({
    providerId: z.string().uuid(),
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:MM'),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:MM'),
    slotDurationMinutes: z.number().int().min(10).max(120).default(30),
  }),
});

export const createAppointmentSchema = z.object({
  body: z.object({
    patientId: z.string().uuid(),
    providerId: z.string().uuid(),
    departmentId: z.string().uuid(),
    scheduledStart: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid start date format',
    }),
    scheduledEnd: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid end date format',
    }),
    reason: z.string().min(3, 'Appointment reason is required'),
  }),
});

export const createEncounterSchema = z.object({
  body: z.object({
    patientId: z.string().uuid(),
    providerId: z.string().uuid(),
    appointmentId: z.string().uuid().optional(),
    encounterType: z.enum(['OUTPATIENT', 'INPATIENT', 'EMERGENCY']).default('OUTPATIENT'),
    notes: z.string().optional(),
  }),
});

export const createDiagnosisSchema = z.object({
  body: z.object({
    patientId: z.string().uuid(),
    providerId: z.string().uuid(),
    encounterId: z.string().uuid(),
    icdCode: z.string().min(2, 'ICD-10 code is required'),
    description: z.string().min(3, 'Diagnosis description is required'),
    type: z.enum(['PRIMARY', 'SECONDARY']).default('PRIMARY'),
  }),
});

export const createMedicationOrderSchema = z.object({
  body: z.object({
    encounterId: z.string().uuid(),
    patientId: z.string().uuid(),
    providerId: z.string().uuid(),
    medicationName: z.string().min(2, 'Medication name is required'),
    dosage: z.string().min(1, 'Dosage is required'),
    frequency: z.string().min(1, 'Frequency is required'),
    duration: z.string().min(1, 'Duration is required'),
    instructions: z.string().optional(),
  }),
});

export const createLabOrderSchema = z.object({
  body: z.object({
    encounterId: z.string().uuid(),
    patientId: z.string().uuid(),
    providerId: z.string().uuid(),
    departmentId: z.string().uuid(),
    testType: z.string().min(2, 'Test type is required'),
    priority: z.enum(['STAT', 'URGENT', 'ROUTINE']).default('ROUTINE'),
    clinicalNotes: z.string().optional(),
  }),
});

export const recordLabResultSchema = z.object({
  body: z.object({
    labOrderId: z.string().uuid(),
    patientId: z.string().uuid(),
    resultValues: z.record(z.any()),
    referenceRange: z.string().optional(),
    interpretation: z.string().optional(),
    status: z.enum(['PRELIMINARY', 'FINAL', 'AMENDED']).default('FINAL'),
  }),
});

export const createInvoiceSchema = z.object({
  body: z.object({
    patientId: z.string().uuid(),
    encounterId: z.string().uuid().optional(),
    amount: z.number().positive(),
    tax: z.number().min(0).default(0),
    discount: z.number().min(0).default(0),
    dueDate: z.string().refine((val) => !isNaN(Date.parse(val))),
  }),
});

export const createConsentSchema = z.object({
  body: z.object({
    patientId: z.string().uuid(),
    providerId: z.string().uuid().optional(),
    consentType: z.enum(['DATA_SHARING', 'TREATMENT', 'RESEARCH', 'BILLING']).default('DATA_SHARING'),
    status: z.enum(['GRANTED', 'REVOKED']).default('GRANTED'),
    expiresAt: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export const updateEncounterStatusSchema = z.object({
  body: z.object({
    status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
    notes: z.string().optional(),
  }),
});

export const updateMedicationOrderStatusSchema = z.object({
  body: z.object({
    status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED', 'DISPENSED']),
  }),
});

export const updateLabOrderStatusSchema = z.object({
  body: z.object({
    status: z.enum(['ORDERED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  }),
});

export const createWaitingListItemSchema = z.object({
  body: z.object({
    patientId: z.string().uuid(),
    departmentId: z.string().uuid(),
    providerId: z.string().uuid().optional(),
    priority: z.enum(['LOW', 'NORMAL', 'URGENT']).default('NORMAL'),
    notes: z.string().optional(),
    requestedDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid requested date format',
    }),
  }),
});

export const updateWaitingListStatusSchema = z.object({
  body: z.object({
    status: z.enum(['WAITING', 'SCHEDULED', 'CANCELLED', 'EXPIRED']),
    notes: z.string().optional(),
  }),
});
