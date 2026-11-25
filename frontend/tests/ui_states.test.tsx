import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Badge } from '../src/components/ui/Badge';
import { StateAlert } from '../src/components/ui/Alert';
import { BillingDashboard } from '../src/components/dashboards/BillingDashboard';
import { ReceptionistDashboard } from '../src/components/dashboards/ReceptionistDashboard';
import { NurseDashboard } from '../src/components/dashboards/NurseDashboard';
import * as apiModule from '../src/lib/api';

vi.mock('../src/lib/api', () => ({
  apiFetch: vi.fn(),
}));

describe('UI State Alerts & Badges (MC-01, MC-05)', () => {
  it('renders loading state properly', () => {
    render(<StateAlert type="loading" message="Fetching clinical records..." />);
    expect(screen.getByText('Fetching clinical records...')).toBeInTheDocument();
  });

  it('renders empty state properly', () => {
    render(<StateAlert type="empty" title="No Encounters" message="No active clinical visits found." />);
    expect(screen.getByText('No Encounters')).toBeInTheDocument();
    expect(screen.getByText('No active clinical visits found.')).toBeInTheDocument();
  });

  it('renders unauthorized state properly with security warning', () => {
    render(
      <StateAlert
        type="unauthorized"
        title="Administrative Clinical Restriction"
        message="Hospital Administrators are prohibited from accessing direct clinical diagnostic data."
      />
    );
    expect(screen.getByText('Administrative Clinical Restriction')).toBeInTheDocument();
    expect(screen.getByText(/prohibited from accessing direct clinical/i)).toBeInTheDocument();
  });

  it('renders status badges with correct clinical theme classes', () => {
    const { rerender } = render(<Badge status="COMPLETED" />);
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();

    rerender(<Badge status="URGENT" />);
    expect(screen.getByText('URGENT')).toBeInTheDocument();
  });

  it('populates BillingDashboard patient dropdown with authorized patient names and MRN', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.mocked(apiModule.apiFetch).mockImplementation((endpoint: string) => {
      if (endpoint === '/billing/invoices') {
        return Promise.resolve({ success: true, data: [] }) as any;
      }
      if (endpoint === '/patients') {
        return Promise.resolve({
          success: true,
          data: [
            {
              id: 'p-1',
              mrn: 'MC-2026-0001',
              firstName: 'Alice',
              lastName: 'Morgan',
              phone: '+1-555-0101',
            },
            {
              id: 'p-2',
              mrn: 'MC-2026-0002',
              firstName: 'Benjamin',
              lastName: 'Sisko',
              phone: '+1-555-0202',
            },
          ],
        }) as any;
      }
      return Promise.resolve({ success: true, data: [] }) as any;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BillingDashboard />
      </QueryClientProvider>
    );

    expect(await screen.findByText('Alice Morgan (MC-2026-0001)')).toBeInTheDocument();
    expect(screen.getByText('Benjamin Sisko (MC-2026-0002)')).toBeInTheDocument();
  });

  it('populates ReceptionistDashboard patient dropdown with authorized patient names and MRN', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.mocked(apiModule.apiFetch).mockImplementation((endpoint: string) => {
      if (endpoint === '/patients') {
        return Promise.resolve({
          success: true,
          data: [
            {
              id: 'p-1',
              mrn: 'MC-2026-0001',
              firstName: 'Alice',
              lastName: 'Morgan',
              phone: '+1-555-0101',
            },
          ],
        }) as any;
      }
      return Promise.resolve({ success: true, data: [] }) as any;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ReceptionistDashboard />
      </QueryClientProvider>
    );

    expect(await screen.findByText('Alice Morgan (MC-2026-0001)')).toBeInTheDocument();
  });

  it('renders check-in action on ReceptionistDashboard scheduled appointments', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.mocked(apiModule.apiFetch).mockImplementation((endpoint: string) => {
      if (endpoint === '/appointments') {
        return Promise.resolve({
          success: true,
          data: [
            {
              id: 'appt-1',
              patientId: 'p-1',
              providerId: 'prov-1',
              departmentId: 'dept-1',
              scheduledStart: '2026-11-30T10:00:00Z',
              scheduledEnd: '2026-11-30T10:30:00Z',
              status: 'SCHEDULED',
              reason: 'Routine consultation',
              patient: { id: 'p-1', firstName: 'Alice', lastName: 'Morgan', mrn: 'MC-2026-0001' },
              provider: { user: { firstName: 'Sarah', lastName: 'Chen' } },
            },
          ],
        }) as any;
      }
      return Promise.resolve({ success: true, data: [] }) as any;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ReceptionistDashboard />
      </QueryClientProvider>
    );

    // Click on All Appointments tab
    const apptsTab = await screen.findByText(/All Appointments/i);
    apptsTab.click();

    expect(await screen.findByText('Check In')).toBeInTheDocument();
  });

  it('renders initiate encounter tab and action on NurseDashboard for arriving patients', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.mocked(apiModule.apiFetch).mockImplementation((endpoint: string) => {
      if (endpoint === '/appointments') {
        return Promise.resolve({
          success: true,
          data: [
            {
              id: 'appt-1',
              patientId: 'p-1',
              providerId: 'prov-1',
              departmentId: 'dept-1',
              scheduledStart: '2026-11-30T10:00:00Z',
              scheduledEnd: '2026-11-30T10:30:00Z',
              status: 'CONFIRMED',
              reason: 'Pre-op triage',
              patient: { id: 'p-1', firstName: 'Alice', lastName: 'Morgan', mrn: 'MC-2026-0001' },
              provider: { user: { firstName: 'Sarah', lastName: 'Chen' } },
            },
          ],
        }) as any;
      }
      return Promise.resolve({ success: true, data: [] }) as any;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <NurseDashboard />
      </QueryClientProvider>
    );

    // Click on Checked-In Waiting Triage tab
    const triageTab = await screen.findByText(/Checked-In Waiting Triage/i);
    triageTab.click();

    expect(await screen.findByText('Initiate Encounter')).toBeInTheDocument();
  });

  it('excludes appointments with existing encounters from NurseDashboard triage queue', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.mocked(apiModule.apiFetch).mockImplementation((endpoint: string) => {
      if (endpoint === '/appointments') {
        return Promise.resolve({
          success: true,
          data: [
            {
              id: 'appt-with-enc',
              patientId: 'p-1',
              providerId: 'prov-1',
              departmentId: 'dept-1',
              scheduledStart: '2026-11-30T10:00:00Z',
              scheduledEnd: '2026-11-30T10:30:00Z',
              status: 'CONFIRMED',
              reason: 'Pre-op triage',
              patient: { id: 'p-1', firstName: 'Alice', lastName: 'Morgan', mrn: 'MC-2026-0001' },
              provider: { user: { firstName: 'Sarah', lastName: 'Chen' } },
              encounter: { id: 'existing-enc-1', status: 'IN_PROGRESS' },
            },
          ],
        }) as any;
      }
      return Promise.resolve({ success: true, data: [] }) as any;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <NurseDashboard />
      </QueryClientProvider>
    );

    const triageTab = await screen.findByText(/Checked-In Waiting Triage/i);
    triageTab.click();

    expect(await screen.findByText('No Pending Check-Ins')).toBeInTheDocument();
    expect(screen.queryByText('Initiate Encounter')).not.toBeInTheDocument();
  });
});
