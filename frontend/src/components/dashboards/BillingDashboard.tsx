'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Invoice, Patient } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { StateAlert } from '@/components/ui/Alert';
import { DollarSign, FilePlus, CreditCard, CheckCircle } from 'lucide-react';

export function BillingDashboard() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Invoice creation form state
  const [patientId, setPatientId] = useState('');
  const [amount, setAmount] = useState('250.00');
  const [tax, setTax] = useState('0.00');
  const [discount, setDiscount] = useState('25.00');
  const [dueDate, setDueDate] = useState('2026-12-15');

  // 1. Invoices Query
  const invoicesQuery = useQuery({
    queryKey: ['billing-invoices'],
    queryFn: () => apiFetch<{ success: boolean; data: Invoice[] }>('/billing/invoices'),
  });

  // 2. Patients Query
  const patientsQuery = useQuery({
    queryKey: ['billing-patients'],
    queryFn: () => apiFetch<{ success: boolean; data: Patient[] }>('/patients'),
  });

  // Create Invoice Mutation
  const createInvoiceMutation = useMutation({
    mutationFn: () =>
      apiFetch('/billing/invoices', {
        method: 'POST',
        body: JSON.stringify({
          patientId,
          amount: parseFloat(amount),
          tax: parseFloat(tax),
          discount: parseFloat(discount),
          dueDate: new Date(dueDate).toISOString(),
        }),
      }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
      setFeedback({ type: 'success', message: `Invoice ${res.data.invoiceNumber} generated.` });
      setPatientId('');
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to create invoice.' });
    },
  });

  // Process Payment Mutation
  const payInvoiceMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/billing/invoices/${id}/pay`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
      setFeedback({ type: 'success', message: 'Invoice marked as paid and reconciled.' });
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.message || 'Payment processing failed.' });
    },
  });

  // Aggregate metrics
  const totalBilled = invoicesQuery.data?.data?.reduce((sum, i) => sum + Number(i.totalAmount), 0) || 0;
  const pendingCount = invoicesQuery.data?.data?.filter((i) => i.status === 'PENDING').length || 0;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hospital Billing & Accounts</h1>
          <p className="text-xs text-slate-500 mt-1">Invoice reconciliation, patient billing, and payment processing.</p>
        </div>
        <div className="flex space-x-4 text-right">
          <div className="bg-sky-50 px-4 py-2 rounded-lg border border-sky-200">
            <span className="text-[10px] text-sky-700 font-semibold uppercase">Total Volume</span>
            <p className="text-base font-bold text-sky-900">${totalBilled.toFixed(2)}</p>
          </div>
          <div className="bg-amber-50 px-4 py-2 rounded-lg border border-amber-200">
            <span className="text-[10px] text-amber-700 font-semibold uppercase">Pending Invoices</span>
            <p className="text-base font-bold text-amber-900">{pendingCount}</p>
          </div>
        </div>
      </div>

      {feedback && (
        <StateAlert
          type={feedback.type}
          message={feedback.message}
          title={feedback.type === 'success' ? 'Confirmed' : 'Error'}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Create Invoice Form */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm md:col-span-1 space-y-4 text-xs">
          <h3 className="font-bold text-sm text-slate-900 border-b pb-2">Generate Patient Invoice</h3>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Select Patient</label>
            <select
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded"
            >
              <option value="">-- Choose Patient --</option>
              {patientsQuery.data?.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName} ({p.mrn})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Service Amount ($)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded font-semibold"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Discount ($)</label>
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded"
            />
          </div>

          <button
            onClick={() => createInvoiceMutation.mutate()}
            disabled={!patientId || createInvoiceMutation.isPending}
            className="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded shadow transition disabled:opacity-50"
          >
            Create Hospital Invoice
          </button>
        </div>

        {/* Invoices List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm md:col-span-2 overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-bold text-sm text-slate-900">Hospital Billing Ledger</h3>
          </div>
          {invoicesQuery.isLoading ? (
            <StateAlert type="loading" message="Loading billing records..." />
          ) : !invoicesQuery.data?.data?.length ? (
            <StateAlert type="empty" title="Ledger Empty" />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Patient</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Net Total</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {invoicesQuery.data.data.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{inv.invoiceNumber}</td>
                      <td className="py-3 px-4">
                        {inv.patient?.firstName} {inv.patient?.lastName} ({inv.patient?.mrn})
                      </td>
                      <td className="py-3 px-4">{new Date(inv.dueDate).toLocaleDateString()}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">${Number(inv.totalAmount).toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <Badge status={inv.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        {inv.status === 'PENDING' && (
                          <button
                            onClick={() => payInvoiceMutation.mutate(inv.id)}
                            disabled={payInvoiceMutation.isPending}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-sm transition disabled:opacity-50"
                          >
                            Reconcile
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
      </div>
    </div>
  );
}
