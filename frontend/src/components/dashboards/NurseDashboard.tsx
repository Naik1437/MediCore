'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Encounter, Department } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { StateAlert } from '@/components/ui/Alert';
import { HeartPulse, FlaskConical, FileText, CheckCircle2 } from 'lucide-react';

export function NurseDashboard() {
  const queryClient = useQueryClient();
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(null);
  const [notesUpdate, setNotesUpdate] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Lab modal state
  const [showLabModal, setShowLabModal] = useState(false);
  const [testType, setTestType] = useState('Urinalysis Complete Panel');
  const [priority, setPriority] = useState<'ROUTINE' | 'URGENT'>('ROUTINE');

  // 1. Encounters Query
  const encountersQuery = useQuery({
    queryKey: ['nurse-encounters'],
    queryFn: () => apiFetch<{ success: boolean; data: Encounter[] }>('/encounters'),
  });

  // 2. Departments Query
  const departmentsQuery = useQuery({
    queryKey: ['departments'],
    queryFn: () => apiFetch<{ success: boolean; data: Department[] }>('/departments'),
  });

  // Update Encounter Notes Mutation
  const updateNotesMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/encounters/${selectedEncounter?.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: selectedEncounter?.status,
          notes: notesUpdate,
        }),
      }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['nurse-encounters'] });
      setFeedback({ type: 'success', message: 'Nurse clinical care notes logged successfully.' });
      setNotesUpdate('');
      setSelectedEncounter(res.data);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to update notes.' });
    },
  });

  // Order Lab Mutation
  const orderLabMutation = useMutation({
    mutationFn: () =>
      apiFetch('/lab/orders', {
        method: 'POST',
        body: JSON.stringify({
          encounterId: selectedEncounter?.id,
          patientId: selectedEncounter?.patientId,
          providerId: selectedEncounter?.providerId,
          departmentId: departmentsQuery.data?.data?.[0]?.id,
          testType,
          priority,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nurse-encounters'] });
      setShowLabModal(false);
      setFeedback({ type: 'success', message: 'Diagnostic lab order placed.' });
    },
  });

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Clinical Nursing Station</h1>
        <p className="text-xs text-slate-500 mt-1">Patient triage, vitals observation, and lab sample collection queues.</p>
      </div>

      {feedback && (
        <StateAlert
          type={feedback.type}
          message={feedback.message}
          title={feedback.type === 'success' ? 'Recorded' : 'Error'}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Encounters Queue */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm md:col-span-1">
          <h3 className="font-bold text-sm text-slate-900 border-b pb-2 mb-3">Patient Inpatient / Outpatient Queue</h3>
          {encountersQuery.isLoading ? (
            <StateAlert type="loading" message="Loading active queue..." />
          ) : !encountersQuery.data?.data?.length ? (
            <StateAlert type="empty" title="Queue Empty" />
          ) : (
            <div className="space-y-2">
              {encountersQuery.data.data.map((enc) => (
                <button
                  key={enc.id}
                  onClick={() => setSelectedEncounter(enc)}
                  className={`w-full text-left p-3 rounded-lg border transition ${
                    selectedEncounter?.id === enc.id ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-xs text-slate-900">
                      {enc.patient?.firstName} {enc.patient?.lastName}
                    </span>
                    <Badge status={enc.status} />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">MRN: {enc.patient?.mrn}</p>
                  <p className="text-[11px] text-slate-600 truncate mt-1">Dr. {enc.provider?.user?.lastName}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Encounter Care Console */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm md:col-span-2">
          {!selectedEncounter ? (
            <StateAlert type="info" message="Select a patient from the queue to view orders or log triage vitals." />
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-start border-b pb-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {selectedEncounter.patient?.firstName} {selectedEncounter.patient?.lastName}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">MRN: {selectedEncounter.patient?.mrn}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge status={selectedEncounter.status} />
                  <button
                    onClick={() => setShowLabModal(true)}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold"
                  >
                    Order Lab
                  </button>
                </div>
              </div>

              {/* Log Vitals & Clinical Notes */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider">Log Patient Vitals & Clinical Progress</h4>
                <textarea
                  value={notesUpdate}
                  onChange={(e) => setNotesUpdate(e.target.value)}
                  placeholder="e.g. BP: 120/80 mmHg | Heart Rate: 72 bpm | SpO2: 98% | Temperature: 98.6F..."
                  rows={3}
                  className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  onClick={() => updateNotesMutation.mutate()}
                  disabled={!notesUpdate.trim() || updateNotesMutation.isPending}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded text-xs font-semibold disabled:opacity-50"
                >
                  Save Nursing Observation
                </button>
              </div>

              {/* Consultation History */}
              <div>
                <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider mb-2">Previous Consultation Notes</h4>
                <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs text-slate-800 whitespace-pre-line font-mono">
                  {selectedEncounter.notes || 'No notes on file.'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lab Modal */}
      {showLabModal && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 text-xs">
            <h3 className="font-bold text-base text-slate-900">Place Nursing Diagnostic Order</h3>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Test Type</label>
              <input
                value={testType}
                onChange={(e) => setTestType(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full p-2 border border-slate-300 rounded"
              >
                <option value="ROUTINE">Routine</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowLabModal(false)}
                className="px-3 py-1.5 border border-slate-300 rounded font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => orderLabMutation.mutate()}
                disabled={orderLabMutation.isPending}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold disabled:opacity-50"
              >
                Submit Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
