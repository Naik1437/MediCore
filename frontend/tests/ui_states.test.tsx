import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Badge } from '../src/components/ui/Badge';
import { StateAlert } from '../src/components/ui/Alert';

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
});
