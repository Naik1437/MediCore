'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { UserRole } from '@/types';
import { StateAlert } from '@/components/ui/Alert';

// Role Dashboard components
import { PatientDashboard } from '@/components/dashboards/PatientDashboard';
import { ReceptionistDashboard } from '@/components/dashboards/ReceptionistDashboard';
import { DoctorDashboard } from '@/components/dashboards/DoctorDashboard';
import { NurseDashboard } from '@/components/dashboards/NurseDashboard';
import { LabTechDashboard } from '@/components/dashboards/LabTechDashboard';
import { BillingDashboard } from '@/components/dashboards/BillingDashboard';
import { AdminDashboard } from '@/components/dashboards/AdminDashboard';

export default function DashboardPage() {
  const { user, role, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return <StateAlert type="loading" message="Authenticating session and loading clinical console..." />;
  }

  if (!isAuthenticated || !user) {
    return <StateAlert type="unauthorized" title="Session Expired" message="Please sign in to access your hospital dashboard." />;
  }

  switch (role) {
    case UserRole.PATIENT:
      return <PatientDashboard />;
    case UserRole.RECEPTIONIST:
      return <ReceptionistDashboard />;
    case UserRole.DOCTOR:
      return <DoctorDashboard />;
    case UserRole.NURSE:
      return <NurseDashboard />;
    case UserRole.LAB_TECHNICIAN:
      return <LabTechDashboard />;
    case UserRole.BILLING_OFFICER:
      return <BillingDashboard />;
    case UserRole.HOSPITAL_ADMIN:
      return <AdminDashboard />;
    default:
      return (
        <StateAlert
          type="unauthorized"
          title="Unrecognized Clinical Role"
          message={`Your assigned role (${role}) does not have an active dashboard configuration.`}
        />
      );
  }
}
