'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { StateAlert } from '@/components/ui/Alert';
import { UserRole } from '@/types';
import { Shield, Lock, Mail, ArrowRight, UserCheck } from 'lucide-react';

const DEMO_ACCOUNTS = [
  { role: UserRole.DOCTOR, email: 'doctor@medicore.local', label: 'Doctor (Dr. Robert Chen)' },
  { role: UserRole.NURSE, email: 'nurse@medicore.local', label: 'Nurse (Emily Watson, RN)' },
  { role: UserRole.RECEPTIONIST, email: 'receptionist@medicore.local', label: 'Receptionist (Sarah Jenkins)' },
  { role: UserRole.LAB_TECHNICIAN, email: 'labtech@medicore.local', label: 'Lab Tech (Alex Rivera)' },
  { role: UserRole.BILLING_OFFICER, email: 'billing@medicore.local', label: 'Billing Officer (Marcus Vance)' },
  { role: UserRole.HOSPITAL_ADMIN, email: 'admin@medicore.local', label: 'Admin (Arthur Pendelton)' },
  { role: UserRole.PATIENT, email: 'patient@medicore.local', label: 'Patient (Alice Morgan)' },
];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(process.env.NODE_ENV === 'test' ? 'Password123!' : '');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPublicAccess, setIsPublicAccess] = useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const isTunnelOrGateway =
        window.location.port === '8088' ||
        window.location.hostname.includes('trycloudflare.com') ||
        window.location.hostname.includes('cloudflare');
      if (isTunnelOrGateway) {
        setIsPublicAccess(true);
      }
    }
  }, []);

  const isDevOrTest = process.env.NODE_ENV !== 'production' && !isPublicAccess;

  const selectDemoAccount = (accEmail: string) => {
    setEmail(accEmail);
    if (!isPublicAccess) {
      setPassword('Password123!');
    }
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await apiFetch<{
        success: boolean;
        data: {
          accessToken: string;
          refreshToken: string;
          user: any;
        };
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (res?.data) {
        login(
          {
            accessToken: res.data.accessToken,
            refreshToken: res.data.refreshToken,
          },
          res.data.user
        );
        router.push('/dashboard');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-8">
      <div className="bg-white p-8 border border-slate-200 rounded-xl shadow-md">
        <div className="text-center mb-6">
          <div className="inline-flex p-3 rounded-xl bg-sky-100 text-sky-700 mb-3">
            <Shield className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Hospital Portal Login</h2>
          <p className="text-xs text-slate-500 mt-1">Authenticate with your assigned clinical credentials</p>
        </div>

        {errorMessage && (
          <div className="mb-4">
            <StateAlert type="error" message={errorMessage} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Mail className="w-4 h-4" />
              </span>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@medicore.local"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-slate-700 mb-1">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white font-medium text-sm rounded-lg shadow transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {isDevOrTest && (
          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 text-center">
              Development Quick Role Switcher
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => selectDemoAccount(acc.email)}
                  className="text-left px-3 py-2 text-xs rounded border border-slate-200 hover:bg-sky-50 hover:border-sky-300 transition-colors flex items-center justify-between group"
                >
                  <span className="font-medium text-slate-800">{acc.label}</span>
                  <UserCheck className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-600" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}