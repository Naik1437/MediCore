'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Activity, ShieldCheck, HeartPulse, Stethoscope, UserCheck, ArrowRight } from 'lucide-react';

export default function HomePage() {
  const { isAuthenticated, role, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated && role) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, role, isLoading, router]);

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-sky-100 text-sky-800 text-xs font-semibold mb-6">
          <Activity className="w-4 h-4" />
          <span>Integrated Healthcare Platform</span>
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl">
          Clinical Operations & Patient Care
        </h1>
        <p className="mt-4 text-base text-slate-600">
          Zero-trust role-based portal for clinical encounters, doctor diagnostics, nurse vitals, lab results, patient registration, and consent governance.
        </p>

        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/login"
            className="px-6 py-3 rounded-lg bg-sky-600 text-white font-semibold text-sm shadow hover:bg-sky-700 transition flex items-center space-x-2"
          >
            <span>Access Clinical Portal</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
            <HeartPulse className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 text-base mb-1">Patient Experience</h3>
          <p className="text-xs text-slate-600">
            Self-service appointment scheduling, verified diagnostic results, prescription orders, and fine-grained consent revocations.
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center mb-4">
            <Stethoscope className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 text-base mb-1">Care Workflows</h3>
          <p className="text-xs text-slate-600">
            Real-time encounter status transitions, ICD-10 diagnostic coding, medication fulfillment, and laboratory order queues.
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center mb-4">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 text-base mb-1">Data Governance</h3>
          <p className="text-xs text-slate-600">
            Strict default-deny RBAC, IDOR protection, forensic audit logging, and clinical isolation restricting administrative PHI reads.
          </p>
        </div>
      </div>
    </div>
  );
}
