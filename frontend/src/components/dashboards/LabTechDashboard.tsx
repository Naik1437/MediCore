'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { LabOrder, LabResult } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { StateAlert } from '@/components/ui/Alert';
import { FlaskConical, CheckCircle, FileCheck, ArrowRight } from 'lucide-react';

export function LabTechDashboard() {
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Result submission form state
  const [resultValKey1, setResultValKey1] = useState('bloodGlucose');
  const [resultValVal1, setResultValVal1] = useState('95 mg/dL');
  const [resultValKey2, setResultValKey2] = useState('hemoglobin');
  const [resultValVal2, setResultValVal2] = useState('14.2 g/dL');
  const [referenceRange, setReferenceRange] = useState('Glucose: 70-99 mg/dL | Hb: 13.5-17.5 g/dL');
  const [interpretation, setInterpretation] = useState('Normal diagnostic clinical findings.');

  // 1. Lab Orders Query
  const ordersQuery = useQuery({
    queryKey: ['lab-orders'],
    queryFn: () => apiFetch<{ success: boolean; data: LabOrder[] }>('/lab/orders'),
  });

  // 2. Lab Results Query
  const resultsQuery = useQuery({
    queryKey: ['all-lab-results'],
    queryFn: () => apiFetch<{ success: boolean; data: LabResult[] }>('/lab/results'),
  });

  // Transition Order Status Mutation
  const transitionStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiFetch(`/lab/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
      setFeedback({ type: 'success', message: `Order status updated to ${res.data.status}.` });
      if (selectedOrder?.id === res.data.id) {
        setSelectedOrder(res.data);
      }
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.message || 'Status transition failed.' });
    },
  });

  // Record Lab Result Mutation
  const recordResultMutation = useMutation({
    mutationFn: () => {
      const resultValues: Record<string, string> = {};
      if (resultValKey1) resultValues[resultValKey1] = resultValVal1;
      if (resultValKey2) resultValues[resultValKey2] = resultValVal2;

      return apiFetch('/lab/results', {
        method: 'POST',
        body: JSON.stringify({
          labOrderId: selectedOrder?.id,
          patientId: selectedOrder?.patientId,
          resultValues,
          referenceRange,
          interpretation,
          status: 'FINAL',
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
      queryClient.invalidateQueries({ queryKey: ['all-lab-results'] });
      setSelectedOrder(null);
      setFeedback({ type: 'success', message: 'Diagnostic result verified and finalized. Order completed.' });
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to submit lab result.' });
    },
  });

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Pathology & Laboratory Diagnostic Station</h1>
        <p className="text-xs text-slate-500 mt-1">Process pending orders, record assay results, and dispatch clinical verifications.</p>
      </div>

      {feedback && (
        <StateAlert
          type={feedback.type}
          message={feedback.message}
          title={feedback.type === 'success' ? 'Completed' : 'Validation Error'}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Pending Orders Queue */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm md:col-span-1">
          <h3 className="font-bold text-sm text-slate-900 border-b pb-2 mb-3">Diagnostic Orders Queue</h3>
          {ordersQuery.isLoading ? (
            <StateAlert type="loading" message="Loading orders..." />
          ) : !ordersQuery.data?.data?.length ? (
            <StateAlert type="empty" title="No Lab Orders" />
          ) : (
            <div className="space-y-2">
              {ordersQuery.data.data.map((order) => (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`w-full text-left p-3 rounded-lg border transition ${
                    selectedOrder?.id === order.id ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-xs text-slate-900 truncate">{order.testType}</span>
                    <Badge status={order.status} />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Patient: {order.patient?.firstName} {order.patient?.lastName} ({order.patient?.mrn})
                  </p>
                  <span className="inline-block mt-1">
                    <Badge status={order.priority} />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Order Actions & Result Entry */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm md:col-span-2">
          {!selectedOrder ? (
            <StateAlert type="info" message="Select a diagnostic test from the queue to transition sample status or record finalized results." />
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-start border-b pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedOrder.testType}</h3>
                  <p className="text-xs text-slate-500">
                    Patient: {selectedOrder.patient?.firstName} {selectedOrder.patient?.lastName} • MRN: {selectedOrder.patient?.mrn}
                  </p>
                </div>
                <Badge status={selectedOrder.status} />
              </div>

              {/* Status Transition Lifecycle */}
              <div>
                <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider mb-2">Controlled Sample Workflow</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedOrder.status === 'ORDERED' && (
                    <button
                      onClick={() => transitionStatusMutation.mutate({ id: selectedOrder.id, status: 'SAMPLE_COLLECTED' })}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold"
                    >
                      Mark Sample Collected
                    </button>
                  )}
                  {selectedOrder.status === 'SAMPLE_COLLECTED' && (
                    <button
                      onClick={() => transitionStatusMutation.mutate({ id: selectedOrder.id, status: 'IN_PROGRESS' })}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded text-xs font-semibold"
                    >
                      Begin Analysis (In Progress)
                    </button>
                  )}
                  {selectedOrder.status !== 'COMPLETED' && selectedOrder.status !== 'CANCELLED' && (
                    <button
                      onClick={() => transitionStatusMutation.mutate({ id: selectedOrder.id, status: 'CANCELLED' })}
                      className="px-3 py-1.5 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded text-xs font-semibold"
                    >
                      Cancel Order
                    </button>
                  )}
                </div>
              </div>

              {/* Result Submission Form */}
              {selectedOrder.status !== 'COMPLETED' && selectedOrder.status !== 'CANCELLED' && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4 text-xs">
                  <h4 className="font-bold text-sm text-slate-900">Record & Finalize Diagnostic Values</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Parameter 1</label>
                      <input
                        value={resultValKey1}
                        onChange={(e) => setResultValKey1(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Measured Value</label>
                      <input
                        value={resultValVal1}
                        onChange={(e) => setResultValVal1(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Parameter 2</label>
                      <input
                        value={resultValKey2}
                        onChange={(e) => setResultValKey2(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Measured Value</label>
                      <input
                        value={resultValVal2}
                        onChange={(e) => setResultValVal2(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Clinical Reference Range</label>
                    <input
                      value={referenceRange}
                      onChange={(e) => setReferenceRange(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Technician Interpretation</label>
                    <textarea
                      value={interpretation}
                      onChange={(e) => setInterpretation(e.target.value)}
                      rows={2}
                      className="w-full p-2 border border-slate-300 rounded"
                    />
                  </div>

                  <button
                    onClick={() => recordResultMutation.mutate()}
                    disabled={recordResultMutation.isPending}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold shadow transition disabled:opacity-50"
                  >
                    Finalize & Submit Diagnostic Result
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
