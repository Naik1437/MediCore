import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import LoginPage from '../src/app/login/page';
import { AuthProvider } from '../src/lib/auth-context';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: vi.fn() }),
}));

// Mock apiFetch
const mockApiFetch = vi.fn();
vi.mock('../src/lib/api', () => ({
  apiFetch: (...args: any[]) => mockApiFetch(...args),
  ApiError: class ApiError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'ApiError';
    }
  },
}));

describe('Frontend Login Page & Role Selection (MC-01)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders login form with inputs and quick role buttons', () => {
    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );

    expect(screen.getByText('Hospital Portal Login')).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByText('Doctor (Dr. Robert Chen)')).toBeInTheDocument();
    expect(screen.getByText('Admin (Arthur Pendelton)')).toBeInTheDocument();
  });

  it('populates credentials when quick role switcher button is clicked', () => {
    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );

    const docBtn = screen.getByText('Doctor (Dr. Robert Chen)');
    fireEvent.click(docBtn);

    const emailInput = screen.getByLabelText(/Email Address/i) as HTMLInputElement;
    expect(emailInput.value).toBe('doctor@medicore.local');
  });

  it('displays API error message on invalid credentials', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('Invalid email or password'));

    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );

    const emailInput = screen.getByLabelText(/Email Address/i);
    const submitBtn = screen.getByRole('button', { name: /Sign In/i });

    fireEvent.change(emailInput, { target: { value: 'wrong@medicore.local' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Invalid email or password/i)).toBeInTheDocument();
    });
  });

  it('successfully logs in and navigates to dashboard on valid credentials', async () => {
    mockApiFetch.mockResolvedValueOnce({
      success: true,
      data: {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: 'user-1',
          email: 'doctor@medicore.local',
          role: 'DOCTOR',
          firstName: 'Robert',
          lastName: 'Chen',
        },
      },
    });

    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );

    const docBtn = screen.getByText('Doctor (Dr. Robert Chen)');
    fireEvent.click(docBtn);

    const submitBtn = screen.getByRole('button', { name: /Sign In/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
      expect(localStorage.getItem('medicore_access_token')).toBe('mock-access-token');
    });
  });

  it('normalizes patientProfile and mrn on patient login', async () => {
    mockApiFetch.mockResolvedValueOnce({
      success: true,
      data: {
        accessToken: 'mock-patient-access-token',
        refreshToken: 'mock-patient-refresh-token',
        user: {
          id: 'patient-user-1',
          email: 'patient@medicore.local',
          role: 'PATIENT',
          firstName: 'Alice',
          lastName: 'Morgan',
          patientProfile: {
            id: 'patient-uuid-1',
            mrn: 'MRN-2026-0001',
            bloodGroup: 'O_POSITIVE',
            phone: '555-0100',
          },
          patientId: 'patient-uuid-1',
        },
      },
    });

    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );

    const patientBtn = screen.getByText('Patient (Alice Morgan)');
    fireEvent.click(patientBtn);

    const submitBtn = screen.getByRole('button', { name: /Sign In/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
      expect(localStorage.getItem('medicore_access_token')).toBe('mock-patient-access-token');
    });
  });
});

