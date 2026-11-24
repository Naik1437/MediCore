import React from 'react';
import { AlertCircle, CheckCircle, Info, Loader2, ShieldAlert } from 'lucide-react';

interface StateAlertProps {
  type: 'loading' | 'empty' | 'unauthorized' | 'error' | 'success' | 'info';
  title?: string;
  message?: string;
  className?: string;
  children?: React.ReactNode;
}

export function StateAlert({ type, title, message, className = '', children }: StateAlertProps) {
  if (type === 'loading') {
    return (
      <div className={`flex flex-col items-center justify-center p-8 bg-white border border-slate-200 rounded-lg shadow-sm ${className}`} role="status">
        <Loader2 className="w-8 h-8 text-sky-600 animate-spin mb-2" />
        <p className="text-sm font-medium text-slate-700">{message || 'Loading clinical data...'}</p>
      </div>
    );
  }

  if (type === 'empty') {
    return (
      <div className={`flex flex-col items-center justify-center p-8 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-center ${className}`}>
        <Info className="w-8 h-8 text-slate-400 mb-2" />
        <h4 className="text-sm font-semibold text-slate-700">{title || 'No Records Found'}</h4>
        <p className="text-xs text-slate-500 mt-1">{message || 'There are no active records matching this criterion.'}</p>
        {children && <div className="mt-4">{children}</div>}
      </div>
    );
  }

  if (type === 'unauthorized') {
    return (
      <div className={`p-6 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 ${className}`} role="alert">
        <div className="flex items-start">
          <ShieldAlert className="w-6 h-6 text-rose-600 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-base font-semibold">{title || 'Access Restricted'}</h4>
            <p className="text-sm text-rose-700 mt-1">
              {message || 'You do not have the necessary clinical role permissions to access these records.'}
            </p>
            {children}
          </div>
        </div>
      </div>
    );
  }

  if (type === 'error') {
    return (
      <div className={`p-4 bg-red-50 border border-red-200 rounded-lg text-red-900 ${className}`} role="alert">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            {title && <h4 className="text-sm font-semibold">{title}</h4>}
            <p className="text-sm text-red-700">{message || 'An unexpected operation error occurred.'}</p>
            {children}
          </div>
        </div>
      </div>
    );
  }

  if (type === 'success') {
    return (
      <div className={`p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 ${className}`}>
        <div className="flex items-start">
          <CheckCircle className="w-5 h-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            {title && <h4 className="text-sm font-semibold">{title}</h4>}
            <p className="text-sm text-emerald-700">{message}</p>
            {children}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
