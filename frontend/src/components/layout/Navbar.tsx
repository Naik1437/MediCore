'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Activity, LogOut, User as UserIcon, Shield } from 'lucide-react';

export function Navbar() {
  const { user, role, logout, isAuthenticated } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-9 h-9 rounded-lg bg-sky-600 flex items-center justify-center text-white shadow-md">
                <Activity className="w-5 h-5" />
              </div>
              <span className="font-bold text-xl text-slate-900 tracking-tight">MediCore</span>
              <span className="text-xs bg-sky-100 text-sky-800 font-semibold px-2 py-0.5 rounded ml-2">Clinical Portal</span>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {isAuthenticated && user ? (
              <div className="flex items-center space-x-4">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-semibold text-slate-800">
                    {user.firstName} {user.lastName}
                  </div>
                  <div className="text-xs text-sky-600 font-medium tracking-wide flex items-center justify-end">
                    <Shield className="w-3 h-3 mr-1" />
                    {role}
                  </div>
                </div>
                <button
                  onClick={() => logout()}
                  className="inline-flex items-center px-3 py-1.5 border border-slate-300 text-xs font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors"
                  aria-label="Logout"
                >
                  <LogOut className="w-4 h-4 mr-1.5" />
                  Logout
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
              >
                <UserIcon className="w-4 h-4 mr-1.5" />
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
