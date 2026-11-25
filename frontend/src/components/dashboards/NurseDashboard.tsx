'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Encounter, Department, Appointment } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { StateAlert } from '@/components/ui/Alert';
import { HeartPulse, FlaskConical, FileText, CheckCircle2, UserCheck, Stethoscope } from 'lucide-react';

export function NurseDashboard() {
  const queryClient = useQueryClient();
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(null);
  const [activeTab, setActiveTab] = useState<'queue' | 'triageAppointments'>('queue');
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

  // 2. Checked-in Appointments Query (for initiating triage encounter)
  const appointmentsQuery = useQuery({
    queryKey: ['nurse-appointments'],
    queryFn: () => apiFetch<{ success: boolean; data: Appointment[] }>('/appointments'),
  });

  // 3. Departments Query
  const departmentsQuery = useQuery({
    queryKey: ['departments'],
    queryFn: () => apiFetch<{ success: boolean; data: Department[] }>('/departments'),
  });

  useEffect(() => {
    if (selectedEncounter && encountersQuery.data?.data) {
      const refreshed = encountersQuery.data.data.find((e: any) => e.id === selectedEncounter.id);
      if (refreshed) {
        setSelectedEncounter(refreshed);
      }
    }
  }, [encountersQuery.data]);

  // Start Encounter from Checked-In Appointment Mutation
  const startEncounterMutation = useMutation({
    mutationFn: (appt: Appointment) =>
      apiFetch<{ success: boolean; data: Encounter }>('/encounters', {
        method: 'POST',
        body: JSON.stringify({
          patientId: appt.patientId,
          providerId: appt.providerId,
          appointmentId: appt.id,
          encounterType: 'OUTPATIENT',
          notes: `Triage initiated by nursing staff for: ${appt.reason}`,
        }),
      }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['nurse-encounters'] });
      queryClient.invalidateQueries({ queryKey: ['nurse-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-encounters'] });
      setFeedback({ type: 'success', message: `Clinical encounter initiated for ${res.data.patient?.firstName || 'patient'}. Ready for triage & consultation.` });
      setSelectedEncounter(res.data);
      setActiveTab('queue');
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to initiate encounter.' });
    },
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

      {/* Navigation tabs */}
      <div className="flex border-b border-slate-200 space-x-6 text-xs">
        <button
          onClick={() => setActiveTab('queue')}
          className={`pb-3 flex items-center space-x-2 border-b-2 transition ${
            activeTab === 'queue' ? 'border-sky-600 text-sky-600 font-semibold' : 'border-transparent text-slate-500'
          }`}
        >
          <HeartPulse className="w-4 h-4" />
          <span>Active Encounters ({encountersQuery.data?.data?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('triageAppointments')}
          className={`pb-3 flex items-center space-x-2 border-b-2 transition ${
            activeTab === 'triageAppointments' ? 'border-sky-600 text-sky-600 font-semibold' : 'border-transparent text-slate-500'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>
            Checked-In Waiting Triage (
            {appointmentsQuery.data?.data?.filter((a) => !a.encounter && (a.status === 'CONFIRMED' || a.status === 'SCHEDULED')).length || 0}
            )
          </span>
        </button>
      </div>

      {activeTab === 'triageAppointments' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Arrived Patients Awaiting Encounter Initiation</h3>
            <p className="text-xs text-slate-500 mt-1">Initiate clinical encounter to begin nursing triage, vital signs recording and consultation queueing.</p>
          </div>

          {appointmentsQuery.isLoading ? (
            <StateAlert type="loading" message="Loading appointments queue..." />
          ) : !appointmentsQuery.data?.data?.filter((a) => !a.encounter && (a.status === 'CONFIRMED' || a.status === 'SCHEDULED')).length ? (
            <StateAlert type="empty" title="No Pending Check-Ins" message="All checked-in patients have encounters initiated or no new arrivals." />
          ) : (
            <div className="divide-y divide-slate-100">
              {appointmentsQuery.data.data
                .filter((a) => !a.encounter && (a.status === 'CONFIRMED' || a.status === 'SCHEDULED'))
                .map((appt) => (
                  <div key={appt.id} className="py-3 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-slate-900">{appt.patient?.firstName} {appt.patient?.lastName}</span>
                      <span className="ml-2 font-mono text-[11px] text-slate-500">MRN: {appt.patient?.mrn}</span>
                      <p className="text-slate-600 text-[11px] mt-0.5">
                        Attending: Dr. {appt.provider?.user?.firstName} {appt.provider?.user?.lastName} | Reason: {appt.reason}
                      </p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge status={appt.status} />
                      <button
                        onClick={() => startEncounterMutation.mutate(appt)}
                        disabled={startEncounterMutation.isPending}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold transition disabled:opacity-50 flex items-center space-x-1"
                      >
                        <Stethoscope className="w-3.5 h-3.5 mr-1" />
                        <span>Initiate Encounter</span>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'queue' && (
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
      )}

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
