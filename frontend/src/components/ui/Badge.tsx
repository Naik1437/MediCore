import React from 'react';

interface BadgeProps {
  status: string;
  className?: string;
}

export function Badge({ status, className = '' }: BadgeProps) {
  const normalized = status.toUpperCase();

  let colorClasses = 'bg-slate-100 text-slate-800 border-slate-300';

  if (['SCHEDULED', 'ACTIVE', 'IN_PROGRESS', 'WAITING'].includes(normalized)) {
    colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (['COMPLETED', 'GRANTED', 'PAID', 'FINAL'].includes(normalized)) {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (['CANCELLED', 'REVOKED', 'NO_SHOW', 'EXPIRED'].includes(normalized)) {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (['PENDING', 'ORDERED', 'PRELIMINARY', 'SAMPLE_COLLECTED'].includes(normalized)) {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (['STAT', 'URGENT'].includes(normalized)) {
    colorClasses = 'bg-red-100 text-red-800 font-bold border-red-300 animate-pulse';
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClasses} ${className}`}
    >
      {status}
    </span>
  );
}
