'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Encounter, Department, Appointment } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { StateAlert } from '@/components/ui/Alert';
import { Stethoscope, CheckCircle, FileText, FlaskConical, AlertCircle, Plus, CalendarCheck, UserCheck } from 'lucide-react';

export function DoctorDashboard() {
  const queryClient = useQueryClient();
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(null);
  const [activeTab, setActiveTab] = useState<'consultations' | 'scheduledQueue'>('consultations');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Diagnosis Modal state
  const [showDiagModal, setShowDiagModal] = useState(false);
  const [icdCode, setIcdCode] = useState('I10');
  const [diagDesc, setDiagDesc] = useState('Essential (primary) hypertension');

  // Prescription Modal state
  const [showRxModal, setShowRxModal] = useState(false);
  const [medName, setMedName] = useState('Amlodipine 5mg');
  const [dosage, setDosage] = useState('5mg daily');
  const [frequency, setFrequency] = useState('Once daily');
  const [duration, setDuration] = useState('30 days');

  // Lab Order Modal state
  const [showLabModal, setShowLabModal] = useState(false);
  const [testType, setTestType] = useState('Comprehensive Metabolic Panel (CMP)');
  const [priority, setPriority] = useState<'ROUTINE' | 'URGENT' | 'STAT'>('ROUTINE');

  // 1. Encounters Query
  const encountersQuery = useQuery({
    queryKey: ['doctor-encounters'],
    queryFn: () => apiFetch<{ success: boolean; data: Encounter[] }>('/encounters'),
  });

  // 2. Doctor Appointments Query (checked-in / scheduled for physician)
  const appointmentsQuery = useQuery({
    queryKey: ['doctor-appointments'],
    queryFn: () => apiFetch<{ success: boolean; data: Appointment[] }>('/appointments'),
  });

  useEffect(() => {
    if (selectedEncounter && encountersQuery.data?.data) {
      const refreshed = encountersQuery.data.data.find((e: any) => e.id === selectedEncounter.id);
      if (refreshed) {
        setSelectedEncounter(refreshed);
      }
    }
  }, [encountersQuery.data]);

  // 3. Departments Query
  const departmentsQuery = useQuery({
    queryKey: ['departments'],
    queryFn: () => apiFetch<{ success: boolean; data: Department[] }>('/departments'),
  });

  // Initiate Consultation Mutation (creates encounter from appointment)
  const initiateConsultationMutation = useMutation({
    mutationFn: (appt: Appointment) =>
      apiFetch<{ success: boolean; data: Encounter }>('/encounters', {
        method: 'POST',
        body: JSON.stringify({
          patientId: appt.patientId,
          providerId: appt.providerId,
          appointmentId: appt.id,
          encounterType: 'OUTPATIENT',
          notes: `Consultation started for: ${appt.reason}`,
        }),
      }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['doctor-encounters'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['nurse-encounters'] });
      setFeedback({ type: 'success', message: `Consultation encounter initiated for ${res.data.patient?.firstName || 'patient'}.` });
      setSelectedEncounter(res.data);
      setActiveTab('consultations');
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to initiate consultation.' });
    },
  });

  // Transition Encounter Status Mutation
  const transitionEncounterMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      apiFetch(`/encounters/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes }),
      }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['doctor-encounters'] });
      setFeedback({ type: 'success', message: `Encounter status updated to ${res.data.status}.` });
      if (selectedEncounter?.id === res.data.id) {
        setSelectedEncounter(res.data);
      }
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.message || 'Status transition failed.' });
    },
  });

  // Add Diagnosis Mutation
  const addDiagnosisMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/encounters/${selectedEncounter?.id}/diagnoses`, {
        method: 'POST',
        body: JSON.stringify({
          encounterId: selectedEncounter?.id,
          patientId: selectedEncounter?.patientId,
          providerId: selectedEncounter?.providerId,
          icdCode,
          description: diagDesc,
          type: 'PRIMARY',
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-encounters'] });
      setShowDiagModal(false);
      setFeedback({ type: 'success', message: 'ICD diagnosis successfully recorded on encounter.' });
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to record diagnosis.' });
    },
  });

  // Add Prescription Mutation
  const addPrescriptionMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/encounters/${selectedEncounter?.id}/prescriptions`, {
        method: 'POST',
        body: JSON.stringify({
          encounterId: selectedEncounter?.id,
          patientId: selectedEncounter?.patientId,
          providerId: selectedEncounter?.providerId,
          medicationName: medName,
          dosage,
          frequency,
          duration,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-encounters'] });
      setShowRxModal(false);
      setFeedback({ type: 'success', message: 'Prescription order created and queued.' });
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to order prescription.' });
    },
  });

  // Add Lab Order Mutation
  const addLabOrderMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/lab/orders`, {
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
      queryClient.invalidateQueries({ queryKey: ['doctor-encounters'] });
      setShowLabModal(false);
      setFeedback({ type: 'success', message: 'Laboratory diagnostic order dispatched.' });
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to create lab order.' });
    },
  });

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Physician Clinical Care Desk</h1>
          <p className="text-xs text-slate-500 mt-1">Manage clinical encounters, ICD-10 diagnostics, prescriptions, and lab orders.</p>
        </div>
      </div>

      {feedback && (
        <StateAlert
          type={feedback.type}
          message={feedback.message}
          title={feedback.type === 'success' ? 'Clinical Action Complete' : 'Error'}
        />
      )}

      {/* Navigation tabs */}
      <div className="flex border-b border-slate-200 space-x-6 text-xs">
        <button
          onClick={() => setActiveTab('consultations')}
          className={`pb-3 flex items-center space-x-2 border-b-2 transition ${
            activeTab === 'consultations' ? 'border-sky-600 text-sky-600 font-semibold' : 'border-transparent text-slate-500'
          }`}
        >
          <Stethoscope className="w-4 h-4" />
          <span>Active Consultations ({encountersQuery.data?.data?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('scheduledQueue')}
          className={`pb-3 flex items-center space-x-2 border-b-2 transition ${
            activeTab === 'scheduledQueue' ? 'border-sky-600 text-sky-600 font-semibold' : 'border-transparent text-slate-500'
          }`}
        >
          <CalendarCheck className="w-4 h-4" />
          <span>
            Scheduled / Checked-In Queue (
            {appointmentsQuery.data?.data?.filter((a) => !a.encounter && (a.status === 'CONFIRMED' || a.status === 'SCHEDULED')).length || 0}
            )
          </span>
        </button>
      </div>

      {activeTab === 'scheduledQueue' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Arrived & Scheduled Patients</h3>
            <p className="text-xs text-slate-500 mt-1">Directly initiate or resume physician consultation for scheduled appointments.</p>
          </div>

          {appointmentsQuery.isLoading ? (
            <StateAlert type="loading" message="Loading appointment schedule..." />
          ) : !appointmentsQuery.data?.data?.filter((a) => !a.encounter && (a.status === 'CONFIRMED' || a.status === 'SCHEDULED')).length ? (
            <StateAlert type="empty" title="Queue Empty" message="No pending appointments awaiting consultation." />
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
                        Schedule: {new Date(appt.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | Reason: {appt.reason}
                      </p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge status={appt.status} />
                      <button
                        onClick={() => initiateConsultationMutation.mutate(appt)}
                        disabled={initiateConsultationMutation.isPending}
                        className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded font-semibold transition disabled:opacity-50 flex items-center space-x-1"
                      >
                        <Stethoscope className="w-3.5 h-3.5 mr-1" />
                        <span>Start Consultation</span>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'consultations' && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Encounters List */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm md:col-span-1">
          <h3 className="font-bold text-sm text-slate-900 border-b pb-2 mb-3">Active Consultations</h3>
          {encountersQuery.isLoading ? (
            <StateAlert type="loading" message="Loading assigned encounters..." />
          ) : !encountersQuery.data?.data?.length ? (
            <StateAlert type="empty" title="No Active Encounters" />
          ) : (
            <div className="space-y-2">
              {encountersQuery.data.data.map((enc) => (
                <button
                  key={enc.id}
                  onClick={() => setSelectedEncounter(enc)}
                  className={`w-full text-left p-3 rounded-lg border transition ${
                    selectedEncounter?.id === enc.id
                      ? 'border-sky-500 bg-sky-50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-xs text-slate-900">
                      {enc.patient?.firstName} {enc.patient?.lastName}
                    </span>
                    <Badge status={enc.status} />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 font-mono">MRN: {enc.patient?.mrn}</p>
                  <p className="text-[11px] text-slate-600 truncate mt-1">{enc.notes || 'Routine consultation'}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Encounter Care Console */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm md:col-span-2">
          {!selectedEncounter ? (
            <StateAlert type="info" message="Select a clinical consultation from the left to view vitals, order labs, or record diagnoses." />
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-start border-b pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Patient: {selectedEncounter.patient?.firstName} {selectedEncounter.patient?.lastName}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">MRN: {selectedEncounter.patient?.mrn}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge status={selectedEncounter.status} />
                  {selectedEncounter.status === 'IN_PROGRESS' && (
                    <button
                      onClick={() =>
                        transitionEncounterMutation.mutate({
                          id: selectedEncounter.id,
                          status: 'COMPLETED',
                          notes: 'Encounter concluded by attending physician.',
                        })
                      }
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-sm transition"
                    >
                      Complete Encounter
                    </button>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowDiagModal(true)}
                  disabled={selectedEncounter.status === 'COMPLETED'}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded text-xs font-semibold flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Diagnosis</span>
                </button>
                <button
                  onClick={() => setShowRxModal(true)}
                  disabled={selectedEncounter.status === 'COMPLETED'}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Prescribe Medication</span>
                </button>
                <button
                  onClick={() => setShowLabModal(true)}
                  disabled={selectedEncounter.status === 'COMPLETED'}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Order Diagnostic Lab</span>
                </button>
              </div>

              {/* Diagnoses Recorded */}
              <div>
                <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider mb-2">Diagnoses Recorded</h4>
                {!selectedEncounter.diagnoses?.length ? (
                  <p className="text-xs text-slate-500 italic">No diagnoses recorded for this session yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedEncounter.diagnoses.map((d) => (
                      <div key={d.id} className="p-2.5 rounded bg-slate-50 border border-slate-200 text-xs flex justify-between">
                        <div>
                          <span className="font-mono font-bold text-sky-700 mr-2">[{d.icdCode}]</span>
                          <span className="text-slate-800 font-medium">{d.description}</span>
                        </div>
                        <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded uppercase font-semibold">
                          {d.type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Prescriptions Recorded */}
              <div>
                <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider mb-2">Medication Orders</h4>
                {!selectedEncounter.medicationOrders?.length ? (
                  <p className="text-xs text-slate-500 italic">No medications prescribed during this encounter.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedEncounter.medicationOrders.map((rx) => (
                      <div key={rx.id} className="p-2.5 rounded bg-slate-50 border border-slate-200 text-xs flex justify-between items-center">
                        <div>
                          <span className="font-bold text-slate-900 mr-2">{rx.medicationName}</span>
                          <span className="text-slate-600">({rx.dosage} • {rx.frequency} • {rx.duration})</span>
                        </div>
                        <Badge status={rx.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Modal: Diagnosis */}
      {showDiagModal && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-base text-slate-900">Record ICD-10 Diagnosis</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ICD-10 Code</label>
              <input
                value={icdCode}
                onChange={(e) => setIcdCode(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Diagnosis Description</label>
              <textarea
                value={diagDesc}
                onChange={(e) => setDiagDesc(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded"
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowDiagModal(false)}
                className="px-3 py-1.5 border border-slate-300 rounded text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => addDiagnosisMutation.mutate()}
                disabled={addDiagnosisMutation.isPending}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded text-xs font-semibold disabled:opacity-50"
              >
                Save Diagnosis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Prescription */}
      {showRxModal && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-3 text-xs">
            <h3 className="font-bold text-base text-slate-900">Prescribe Medication Order</h3>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Medication Name</label>
              <input
                value={medName}
                onChange={(e) => setMedName(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded font-semibold"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Dosage</label>
                <input
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Frequency</label>
                <input
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Duration</label>
              <input
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-3">
              <button
                onClick={() => setShowRxModal(false)}
                className="px-3 py-1.5 border border-slate-300 rounded font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => addPrescriptionMutation.mutate()}
                disabled={addPrescriptionMutation.isPending}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold disabled:opacity-50"
              >
                Sign Prescription
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Lab Order */}
      {showLabModal && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 text-xs">
            <h3 className="font-bold text-base text-slate-900">Order Laboratory Panel</h3>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Diagnostic Test Type</label>
              <input
                value={testType}
                onChange={(e) => setTestType(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Clinical Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full p-2 border border-slate-300 rounded"
              >
                <option value="ROUTINE">Routine</option>
                <option value="URGENT">Urgent</option>
                <option value="STAT">STAT (Emergency)</option>
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
                onClick={() => addLabOrderMutation.mutate()}
                disabled={addLabOrderMutation.isPending}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold disabled:opacity-50"
              >
                Dispatch Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
