export enum UserRole {
  PATIENT = 'PATIENT',
  RECEPTIONIST = 'RECEPTIONIST',
  DOCTOR = 'DOCTOR',
  NURSE = 'NURSE',
  LAB_TECHNICIAN = 'LAB_TECHNICIAN',
  BILLING_OFFICER = 'BILLING_OFFICER',
  HOSPITAL_ADMIN = 'HOSPITAL_ADMIN',
}

export const ALL_ROLES = Object.values(UserRole);

// Clinical roles permitted to access clinical data (encounters, diagnoses, clinical notes, prescriptions)
export const CLINICAL_ROLES: UserRole[] = [
  UserRole.DOCTOR,
  UserRole.NURSE,
];

// Diagnostic roles permitted to handle lab orders and results
export const DIAGNOSTIC_ROLES: UserRole[] = [
  UserRole.DOCTOR,
  UserRole.NURSE,
  UserRole.LAB_TECHNICIAN,
];

// Administrative roles that can manage users, staff, infrastructure
export const ADMINISTRATIVE_ROLES: UserRole[] = [
  UserRole.HOSPITAL_ADMIN,
];

// Reception roles permitted for registration, appointments, waiting lists
export const RECEPTION_ROLES: UserRole[] = [
  UserRole.RECEPTIONIST,
  UserRole.HOSPITAL_ADMIN,
];

// Billing roles
export const BILLING_ROLES: UserRole[] = [
  UserRole.BILLING_OFFICER,
  UserRole.HOSPITAL_ADMIN,
];
