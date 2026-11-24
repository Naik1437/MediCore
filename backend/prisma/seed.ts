import { PrismaClient, Role, AppointmentStatus, EncounterType, EncounterStatus, DiagnosisType, MedicationOrderStatus, LabPriority, LabOrderStatus, LabResultStatus, InvoiceStatus, ConsentType, ConsentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Seeding MediCore Database with Synthetic Healthcare Data ---');

  const defaultPassword = 'Password123!';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  // 1. Departments
  const deptInternalMed = await prisma.department.upsert({
    where: { code: 'INT-MED' },
    update: {},
    create: {
      name: 'Internal Medicine',
      code: 'INT-MED',
      description: 'Primary adult care, chronic illness diagnosis and management',
      isActive: true,
    },
  });

  const deptCardio = await prisma.department.upsert({
    where: { code: 'CARDIO' },
    update: {},
    create: {
      name: 'Cardiology',
      code: 'CARDIO',
      description: 'Comprehensive cardiovascular consultation and diagnostics',
      isActive: true,
    },
  });

  const deptPediatrics = await prisma.department.upsert({
    where: { code: 'PED' },
    update: {},
    create: {
      name: 'Pediatrics',
      code: 'PED',
      description: 'Infant, child and adolescent medical care',
      isActive: true,
    },
  });

  const deptLab = await prisma.department.upsert({
    where: { code: 'LAB-PATH' },
    update: {},
    create: {
      name: 'Clinical Pathology & Laboratory',
      code: 'LAB-PATH',
      description: 'Diagnostic blood, tissue and clinical sample processing',
      isActive: true,
    },
  });

  const deptBilling = await prisma.department.upsert({
    where: { code: 'FIN-REV' },
    update: {},
    create: {
      name: 'Patient Billing & Accounts',
      code: 'FIN-REV',
      description: 'Hospital invoicing, payment reconciliation and insurance processing',
      isActive: true,
    },
  });

  // 2. Users for all 7 roles
  // Role 1: PATIENT
  const userPatient = await prisma.user.upsert({
    where: { email: 'patient@medicore.local' },
    update: { passwordHash },
    create: {
      email: 'patient@medicore.local',
      passwordHash,
      role: Role.PATIENT,
      firstName: 'Alice',
      lastName: 'Morgan',
      phone: '+1-555-0101',
      isActive: true,
    },
  });

  // Role 2: RECEPTIONIST
  const userReceptionist = await prisma.user.upsert({
    where: { email: 'receptionist@medicore.local' },
    update: { passwordHash },
    create: {
      email: 'receptionist@medicore.local',
      passwordHash,
      role: Role.RECEPTIONIST,
      firstName: 'Sarah',
      lastName: 'Jenkins',
      phone: '+1-555-0102',
      isActive: true,
    },
  });

  // Role 3: DOCTOR
  const userDoctor = await prisma.user.upsert({
    where: { email: 'doctor@medicore.local' },
    update: { passwordHash },
    create: {
      email: 'doctor@medicore.local',
      passwordHash,
      role: Role.DOCTOR,
      firstName: 'Dr. Robert',
      lastName: 'Chen',
      phone: '+1-555-0103',
      isActive: true,
    },
  });

  // Role 4: NURSE
  const userNurse = await prisma.user.upsert({
    where: { email: 'nurse@medicore.local' },
    update: { passwordHash },
    create: {
      email: 'nurse@medicore.local',
      passwordHash,
      role: Role.NURSE,
      firstName: 'Emily',
      lastName: 'Watson',
      phone: '+1-555-0104',
      isActive: true,
    },
  });

  // Role 5: LAB_TECHNICIAN
  const userLabTech = await prisma.user.upsert({
    where: { email: 'labtech@medicore.local' },
    update: { passwordHash },
    create: {
      email: 'labtech@medicore.local',
      passwordHash,
      role: Role.LAB_TECHNICIAN,
      firstName: 'Alex',
      lastName: 'Rivera',
      phone: '+1-555-0105',
      isActive: true,
    },
  });

  // Role 6: BILLING_OFFICER
  const userBilling = await prisma.user.upsert({
    where: { email: 'billing@medicore.local' },
    update: { passwordHash },
    create: {
      email: 'billing@medicore.local',
      passwordHash,
      role: Role.BILLING_OFFICER,
      firstName: 'Marcus',
      lastName: 'Vance',
      phone: '+1-555-0106',
      isActive: true,
    },
  });

  // Role 7: HOSPITAL_ADMIN
  const userAdmin = await prisma.user.upsert({
    where: { email: 'admin@medicore.local' },
    update: { passwordHash },
    create: {
      email: 'admin@medicore.local',
      passwordHash,
      role: Role.HOSPITAL_ADMIN,
      firstName: 'Arthur',
      lastName: 'Pendelton',
      phone: '+1-555-0100',
      isActive: true,
    },
  });

  // 3. Provider & Staff profiles
  const provider = await prisma.provider.upsert({
    where: { userId: userDoctor.id },
    update: {},
    create: {
      userId: userDoctor.id,
      departmentId: deptInternalMed.id,
      licenseNumber: 'MD-MED-2024-9871',
      specialization: 'Internal Medicine & Adult Care',
      status: 'ACTIVE',
    },
  });

  await prisma.staff.upsert({
    where: { userId: userReceptionist.id },
    update: {},
    create: {
      userId: userReceptionist.id,
      departmentId: deptInternalMed.id,
      employeeId: 'EMP-REC-001',
      jobTitle: 'Chief Receptionist',
      isActive: true,
    },
  });

  await prisma.staff.upsert({
    where: { userId: userNurse.id },
    update: {},
    create: {
      userId: userNurse.id,
      departmentId: deptInternalMed.id,
      employeeId: 'EMP-NUR-001',
      jobTitle: 'Senior Clinical Nurse',
      isActive: true,
    },
  });

  await prisma.staff.upsert({
    where: { userId: userLabTech.id },
    update: {},
    create: {
      userId: userLabTech.id,
      departmentId: deptLab.id,
      employeeId: 'EMP-LAB-001',
      jobTitle: 'Pathology Diagnostics Specialist',
      isActive: true,
    },
  });

  await prisma.staff.upsert({
    where: { userId: userBilling.id },
    update: {},
    create: {
      userId: userBilling.id,
      departmentId: deptBilling.id,
      employeeId: 'EMP-BIL-001',
      jobTitle: 'Senior Revenue Cycle Officer',
      isActive: true,
    },
  });

  // 4. Provider Schedules (Mon-Fri 09:00 - 17:00)
  for (let day = 1; day <= 5; day++) {
    const existingSchedule = await prisma.providerSchedule.findFirst({
      where: { providerId: provider.id, dayOfWeek: day },
    });
    if (!existingSchedule) {
      await prisma.providerSchedule.create({
        data: {
          providerId: provider.id,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '17:00',
          slotDurationMinutes: 30,
          isActive: true,
        },
      });
    }
  }

  // 5. Patients
  const patient1 = await prisma.patient.upsert({
    where: { mrn: 'MC-2026-0001' },
    update: {},
    create: {
      userId: userPatient.id,
      mrn: 'MC-2026-0001',
      firstName: 'Alice',
      lastName: 'Morgan',
      dob: new Date('1988-06-15T00:00:00Z'),
      gender: 'FEMALE',
      bloodGroup: 'A_POSITIVE',
      phone: '+1-555-0101',
      email: 'patient@medicore.local',
      address: '742 Evergreen Terrace, Sector 4',
      emergencyContact: 'Bob Morgan (Spouse): +1-555-0199',
    },
  });

  const patient2 = await prisma.patient.upsert({
    where: { mrn: 'MC-2026-0002' },
    update: {},
    create: {
      mrn: 'MC-2026-0002',
      firstName: 'Benjamin',
      lastName: 'Sisko',
      dob: new Date('1975-11-20T00:00:00Z'),
      gender: 'MALE',
      bloodGroup: 'O_POSITIVE',
      phone: '+1-555-0202',
      email: 'ben.sisko@synthetic-health.test',
      address: '350 Deep Space Boulevard',
      emergencyContact: 'Jake Sisko (Son): +1-555-0299',
    },
  });

  // 6. Patient Consent
  await prisma.consent.createMany({
    data: [
      {
        patientId: patient1.id,
        providerId: provider.id,
        consentType: ConsentType.DATA_SHARING,
        status: ConsentStatus.GRANTED,
        notes: 'Full consent granted for treatment and lab diagnostics.',
      },
      {
        patientId: patient2.id,
        providerId: provider.id,
        consentType: ConsentType.DATA_SHARING,
        status: ConsentStatus.GRANTED,
        notes: 'Standard outpatient care consent.',
      },
    ],
    skipDuplicates: true,
  });

  // 7. Appointments & Clinical Encounter
  const apptStart = new Date(Date.now() + 24 * 3600 * 1000);
  apptStart.setHours(10, 0, 0, 0);
  const apptEnd = new Date(apptStart.getTime() + 30 * 60 * 1000);

  const appointment = await prisma.appointment.create({
    data: {
      patientId: patient1.id,
      providerId: provider.id,
      departmentId: deptInternalMed.id,
      scheduledStart: apptStart,
      scheduledEnd: apptEnd,
      status: AppointmentStatus.SCHEDULED,
      reason: 'Routine quarterly diabetes and hypertension follow-up',
    },
  });

  // Create an existing encounter
  const encounter = await prisma.encounter.create({
    data: {
      patientId: patient1.id,
      providerId: provider.id,
      appointmentId: appointment.id,
      encounterType: EncounterType.OUTPATIENT,
      status: EncounterStatus.COMPLETED,
      startedAt: new Date(Date.now() - 3600 * 1000),
      endedAt: new Date(),
      notes: 'Patient reports mild fatigue. Blood pressure slightly elevated. Requested routine panel.',
    },
  });

  // Diagnosis
  await prisma.diagnosis.create({
    data: {
      encounterId: encounter.id,
      patientId: patient1.id,
      providerId: provider.id,
      icdCode: 'I10',
      description: 'Essential (primary) hypertension',
      type: DiagnosisType.PRIMARY,
    },
  });

  // Prescription / Medication Order
  await prisma.medicationOrder.create({
    data: {
      encounterId: encounter.id,
      patientId: patient1.id,
      providerId: provider.id,
      medicationName: 'Lisinopril 10mg',
      dosage: '10mg orally',
      frequency: 'Once daily with water',
      duration: '30 days',
      instructions: 'Take in the morning; monitor blood pressure weekly.',
      status: MedicationOrderStatus.ACTIVE,
    },
  });

  // Lab Order & Result
  const labOrder = await prisma.labOrder.create({
    data: {
      encounterId: encounter.id,
      patientId: patient1.id,
      providerId: provider.id,
      departmentId: deptLab.id,
      testType: 'Comprehensive Metabolic Panel (CMP)',
      priority: LabPriority.ROUTINE,
      status: LabOrderStatus.COMPLETED,
      clinicalNotes: 'Check electrolyte balance, renal function and fasting glucose.',
    },
  });

  await prisma.labResult.create({
    data: {
      labOrderId: labOrder.id,
      patientId: patient1.id,
      technicianId: userLabTech.id,
      resultValues: {
        glucose: '98 mg/dL',
        bun: '14 mg/dL',
        creatinine: '0.9 mg/dL',
        sodium: '140 mmol/L',
        potassium: '4.2 mmol/L',
      },
      referenceRange: 'Normal ranges: Glucose 70-99, Creatinine 0.6-1.2',
      interpretation: 'All values within normal clinical thresholds.',
      status: LabResultStatus.FINAL,
      verifiedAt: new Date(),
    },
  });

  // Billing Invoice
  await prisma.invoice.create({
    data: {
      patientId: patient1.id,
      encounterId: encounter.id,
      invoiceNumber: 'INV-2026-0001',
      amount: 150.00,
      tax: 0.00,
      discount: 20.00,
      totalAmount: 130.00,
      status: InvoiceStatus.PENDING,
      dueDate: new Date(Date.now() + 14 * 24 * 3600 * 1000),
    },
  });

  // Initial Audit Log
  await prisma.auditRecord.create({
    data: {
      userId: userAdmin.id,
      action: 'SYSTEM_BOOTSTRAP',
      entity: 'SystemConfig',
      entityId: 'ROOT',
      ipAddress: '127.0.0.1',
      userAgent: 'MediCore-CLI-Seeder/1.0',
      status: 'SUCCESS',
      details: {
        description: 'Initial synthetic healthcare seed data generated for 7 development roles.',
      },
    },
  });

  console.log('✓ Synthetic seed data successfully loaded for all 7 roles:');
  console.log('  1. PATIENT: patient@medicore.local / Password123!');
  console.log('  2. RECEPTIONIST: receptionist@medicore.local / Password123!');
  console.log('  3. DOCTOR: doctor@medicore.local / Password123!');
  console.log('  4. NURSE: nurse@medicore.local / Password123!');
  console.log('  5. LAB_TECHNICIAN: labtech@medicore.local / Password123!');
  console.log('  6. BILLING_OFFICER: billing@medicore.local / Password123!');
  console.log('  7. HOSPITAL_ADMIN: admin@medicore.local / Password123!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
