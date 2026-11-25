'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserRole } from '@/types';
import { apiFetch } from './api';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (tokens: { accessToken: string; refreshToken: string }, user: User) => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeUserProfile(rawUser: any): User {
  if (!rawUser) return rawUser;

  const patientProfile = rawUser.patientProfile || (rawUser.patientId ? {
    id: rawUser.patientId,
    mrn: rawUser.mrn || 'N/A',
    bloodGroup: rawUser.bloodGroup,
    phone: rawUser.phone || '',
  } : null);

  const providerProfile = rawUser.providerProfile || (rawUser.providerId ? {
    id: rawUser.providerId,
    specialization: rawUser.specialization || '',
    licenseNumber: rawUser.licenseNumber || '',
    departmentId: rawUser.departmentId || '',
  } : null);

  const staffProfile = rawUser.staffProfile || (rawUser.staffId ? {
    id: rawUser.staffId,
    employeeId: rawUser.employeeId || '',
    jobTitle: rawUser.jobTitle || '',
    departmentId: rawUser.departmentId || '',
  } : null);

  return {
    ...rawUser,
    patientProfile,
    providerProfile,
    staffProfile,
    patientId: patientProfile?.id || rawUser.patientId || null,
    providerId: providerProfile?.id || rawUser.providerId || null,
    staffId: staffProfile?.id || rawUser.staffId || null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      if (typeof window === 'undefined') return;
      const storedToken = localStorage.getItem('medicore_access_token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      setAccessToken(storedToken);
      try {
        const res = await apiFetch<{ success: boolean; data: User }>('/auth/me');
        if (res?.data) {
          const normalized = normalizeUserProfile(res.data);
          setUser(normalized);
          setRole(normalized.role);
        }
      } catch (err) {
        // If expired and refresh fails, clear tokens
        localStorage.removeItem('medicore_access_token');
        localStorage.removeItem('medicore_refresh_token');
        setUser(null);
        setRole(null);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  const login = (tokens: { accessToken: string; refreshToken: string }, userData: User) => {
    localStorage.setItem('medicore_access_token', tokens.accessToken);
    localStorage.setItem('medicore_refresh_token', tokens.refreshToken);
    setAccessToken(tokens.accessToken);
    const normalized = normalizeUserProfile(userData);
    setUser(normalized);
    setRole(normalized.role);
  };

  const logout = async () => {
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('medicore_refresh_token') : null;
    if (refreshToken) {
      try {
        await apiFetch('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      } catch (e) {
        // ignore network error on logout
      }
    }
    localStorage.removeItem('medicore_access_token');
    localStorage.removeItem('medicore_refresh_token');
    setUser(null);
    setRole(null);
    setAccessToken(null);
    window.location.href = '/login';
  };

  const refreshProfile = async () => {
    try {
      const res = await apiFetch<{ success: boolean; data: User }>('/auth/me');
      if (res?.data) {
        const normalized = normalizeUserProfile(res.data);
        setUser(normalized);
        setRole(normalized.role);
      }
    } catch (e) {
      // ignore
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        accessToken,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
