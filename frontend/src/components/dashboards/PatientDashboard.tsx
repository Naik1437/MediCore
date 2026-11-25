'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { Appointment, Invoice, LabResult, Consent, MedicationOrder } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { StateAlert } from '@/components/ui/Alert';
import { Calendar, FileText, FlaskConical, DollarSign, ShieldCheck, XCircle, Check } from 'lucide-react';

export function PatientDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'appointments' | 'prescriptions' | 'labs' | 'billing' | 'consent'>('appointments');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const patientId = user?.patientProfile?.id || user?.patientId;

  // 1. Appointments Query
  const appointmentsQuery = useQuery({
    queryKey: ['patient-appointments', patientId],
    queryFn: () => apiFetch<{ success: boolean; data: Appointment[] }>(`/appointments`),
    enabled: !!patientId,
  });

  // 2. Prescriptions Query
  const prescriptionsQuery = useQuery({
    queryKey: ['patient-prescriptions', patientId],
    queryFn: () => apiFetch<{ success: boolean; data: MedicationOrder[] }>(`/prescriptions/patient/${patientId}`),
    enabled: !!patientId,
  });

  // 3. Lab Results Query
  const labsQuery = useQuery({
    queryKey: ['patient-labs', patientId],
    queryFn: () => apiFetch<{ success: boolean; data: LabResult[] }>(`/lab/results`),
    enabled: !!patientId,
  });

  // 4. Invoices Query
  const invoicesQuery = useQuery({
    queryKey: ['patient-invoices', patientId],
    queryFn: () => apiFetch<{ success: boolean; data: Invoice[] }>(`/billing/invoices`),
    enabled: !!patientId,
  });

  // 5. Consent Query
  const consentsQuery = useQuery({
    queryKey: ['patient-consents', patientId],
    queryFn: () => apiFetch<{ success: boolean; data: Consent[] }>(`/consents/patient/${patientId}`),
    enabled: !!patientId,
  });

  // Cancel Appointment Mutation
  const cancelAppointmentMutation = useMutation({
    mutationFn: (appointmentId: string) =>
      apiFetch(`/appointments/${appointmentId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Cancelled by patient' }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-appointments'] });
      setActionMessage({ type: 'success', text: 'Appointment cancelled successfully.' });
    },
    onError: (err: any) => {
      setActionMessage({ type: 'error', text: err.message || 'Failed to cancel appointment.' });
    },
  });

  // Pay Invoice Mutation
  const payInvoiceMutation = useMutation({
    mutationFn: (invoiceId: string) =>
      apiFetch(`/billing/invoices/${invoiceId}/pay`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-invoices'] });
      setActionMessage({ type: 'success', text: 'Payment processed successfully.' });
    },
    onError: (err: any) => {
      setActionMessage({ type: 'error', text: err.message || 'Payment processing failed.' });
    },
  });

  // Revoke Consent Mutation
  const revokeConsentMutation = useMutation({
    mutationFn: (consentId: string) =>
      apiFetch(`/consents/${consentId}/revoke`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-consents'] });
      queryClient.invalidateQueries({ queryKey: ['patient-encounters'] });
      queryClient.invalidateQueries({ queryKey: ['patient-prescriptions'] });
      queryClient.invalidateQueries({ queryKey: ['patient-lab-results'] });
      queryClient.invalidateQueries({ queryKey: ['patient-appointments'] });
      setActionMessage({ type: 'success', text: 'Data sharing consent has been revoked.' });
    },
    onError: (err: any) => {
      setActionMessage({ type: 'error', text: err.message || 'Failed to revoke consent.' });
    },
  });

  // Grant Consent Mutation
  const grantConsentMutation = useMutation({
    mutationFn: (consentId: string) =>
      apiFetch(`/consents/${consentId}/grant`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-consents'] });
      queryClient.invalidateQueries({ queryKey: ['patient-encounters'] });
      queryClient.invalidateQueries({ queryKey: ['patient-prescriptions'] });
      queryClient.invalidateQueries({ queryKey: ['patient-lab-results'] });
      queryClient.invalidateQueries({ queryKey: ['patient-appointments'] });
      setActionMessage({ type: 'success', text: 'Data sharing access has been granted and restored.' });
    },
    onError: (err: any) => {
      setActionMessage({ type: 'error', text: err.message || 'Failed to grant consent.' });
    },
  });

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome, {user?.firstName} {user?.lastName}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            MRN: <span className="font-mono font-semibold text-sky-700">{user?.patientProfile?.mrn || 'N/A'}</span> | Patient Health Record
          </p>
        </div>
      </div>

      {actionMessage && (
        <StateAlert
          type={actionMessage.type}
          message={actionMessage.text}
          className="cursor-pointer"
          title={actionMessage.type === 'success' ? 'Success' : 'Error'}
        />
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-6 overflow-x-auto text-sm font-medium">
        <button
          onClick={() => setActiveTab('appointments')}
          className={`pb-3 flex items-center space-x-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'appointments' ? 'border-sky-600 text-sky-600 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>My Appointments ({appointmentsQuery.data?.data?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('prescriptions')}
          className={`pb-3 flex items-center space-x-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'prescriptions' ? 'border-sky-600 text-sky-600 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Prescriptions ({prescriptionsQuery.data?.data?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('labs')}
          className={`pb-3 flex items-center space-x-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'labs' ? 'border-sky-600 text-sky-600 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FlaskConical className="w-4 h-4" />
          <span>Diagnostic Results ({labsQuery.data?.data?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('billing')}
          className={`pb-3 flex items-center space-x-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'billing' ? 'border-sky-600 text-sky-600 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Billing & Invoices ({invoicesQuery.data?.data?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('consent')}
          className={`pb-3 flex items-center space-x-2 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'consent' ? 'border-sky-600 text-sky-600 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Consent Preferences ({consentsQuery.data?.data?.length || 0})</span>
        </button>
      </div>

      {/* Tab 1: Appointments */}
      {activeTab === 'appointments' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {appointmentsQuery.isLoading ? (
            <StateAlert type="loading" message="Loading your appointments..." />
          ) : !appointmentsQuery.data?.data?.length ? (
            <StateAlert type="empty" title="No Scheduled Appointments" message="You have no upcoming or past clinical consultations." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Provider</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {appointmentsQuery.data.data.map((appt) => (
                    <tr key={appt.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {new Date(appt.scheduledStart).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        Dr. {appt.provider?.user?.firstName} {appt.provider?.user?.lastName}
                      </td>
                      <td className="py-3 px-4">{appt.department?.name || 'General'}</td>
                      <td className="py-3 px-4 text-slate-600">{appt.reason}</td>
                      <td className="py-3 px-4">
                        <Badge status={appt.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        {appt.status === 'SCHEDULED' && (
                          <button
                            onClick={() => cancelAppointmentMutation.mutate(appt.id)}
                            disabled={cancelAppointmentMutation.isPending}
                            className="text-xs font-semibold text-rose-600 hover:text-rose-800 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Prescriptions */}
      {activeTab === 'prescriptions' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {prescriptionsQuery.isLoading ? (
            <StateAlert type="loading" message="Loading your medications..." />
          ) : !prescriptionsQuery.data?.data?.length ? (
            <StateAlert type="empty" title="No Active Prescriptions" message="No active or past medication orders found." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Medication</th>
                    <th className="py-3 px-4">Dosage</th>
                    <th className="py-3 px-4">Frequency</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Instructions</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {prescriptionsQuery.data.data.map((rx) => (
                    <tr key={rx.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{rx.medicationName}</td>
                      <td className="py-3 px-4">{rx.dosage}</td>
                      <td className="py-3 px-4">{rx.frequency}</td>
                      <td className="py-3 px-4">{rx.duration}</td>
                      <td className="py-3 px-4 text-slate-600">{rx.instructions || 'As directed'}</td>
                      <td className="py-3 px-4">
                        <Badge status={rx.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Lab Results */}
      {activeTab === 'labs' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          {labsQuery.isLoading ? (
            <StateAlert type="loading" message="Retrieving laboratory results..." />
          ) : !labsQuery.data?.data?.length ? (
            <StateAlert type="empty" title="No Laboratory Results" message="No verified diagnostic test records available." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {labsQuery.data.data.map((lab) => (
                <div key={lab.id} className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-sm text-slate-900">{(lab as any).labOrder?.testType || 'Diagnostic Panel'}</h4>
                    <Badge status={lab.status} />
                  </div>
                  <p className="text-xs text-slate-500 mb-3">
                    Verified: {lab.verifiedAt ? new Date(lab.verifiedAt).toLocaleDateString() : 'Pending'}
                  </p>
                  <div className="bg-white p-3 rounded border border-slate-200 text-xs font-mono space-y-1">
                    {Object.entries(lab.resultValues || {}).map(([key, val]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-slate-600 capitalize">{key}:</span>
                        <span className="font-semibold text-slate-900">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                  {lab.interpretation && (
                    <p className="text-xs text-slate-700 mt-2 italic bg-sky-50 p-2 rounded border border-sky-100">
                      Interpretation: {lab.interpretation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Billing */}
      {activeTab === 'billing' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {invoicesQuery.isLoading ? (
            <StateAlert type="loading" message="Loading billing records..." />
          ) : !invoicesQuery.data?.data?.length ? (
            <StateAlert type="empty" title="No Invoices" message="You have no outstanding or past invoices." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Discount</th>
                    <th className="py-3 px-4">Total</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {invoicesQuery.data.data.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">{inv.invoiceNumber}</td>
                      <td className="py-3 px-4">{new Date(inv.dueDate).toLocaleDateString()}</td>
                      <td className="py-3 px-4">${Number(inv.amount).toFixed(2)}</td>
                      <td className="py-3 px-4 text-emerald-600">-${Number(inv.discount).toFixed(2)}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">${Number(inv.totalAmount).toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <Badge status={inv.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        {inv.status === 'PENDING' && (
                          <button
                            onClick={() => payInvoiceMutation.mutate(inv.id)}
                            disabled={payInvoiceMutation.isPending}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-sm transition disabled:opacity-50"
                          >
                            Pay Now
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Consent */}
      {activeTab === 'consent' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="mb-4">
            <h3 className="font-bold text-slate-900 text-base">Clinical Data Governance & Consent</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Control which providers and diagnostic labs may access your clinical records.
            </p>
          </div>

          {consentsQuery.isLoading ? (
            <StateAlert type="loading" message="Loading consent records..." />
          ) : !consentsQuery.data?.data?.length ? (
            <StateAlert type="empty" title="No Consent Directives" message="No data sharing consent records found." />
          ) : (
            <div className="space-y-3">
              {consentsQuery.data.data.map((c) => (
                <div key={c.id} className="p-4 border border-slate-200 rounded-lg flex justify-between items-center bg-slate-50">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-slate-900">{c.consentType}</span>
                      <Badge status={c.status} />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Granted: {new Date(c.grantedAt).toLocaleDateString()} {c.notes && `• Note: ${c.notes}`}
                    </p>
                  </div>
                  {c.status === 'GRANTED' ? (
                    <button
                      onClick={() => revokeConsentMutation.mutate(c.id)}
                      disabled={revokeConsentMutation.isPending}
                      className="px-3 py-1.5 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded text-xs font-semibold transition disabled:opacity-50 flex items-center space-x-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Revoke Access</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => grantConsentMutation.mutate(c.id)}
                      disabled={grantConsentMutation.isPending}
                      className="px-3 py-1.5 border border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded text-xs font-semibold transition disabled:opacity-50 flex items-center space-x-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Grant Access</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

