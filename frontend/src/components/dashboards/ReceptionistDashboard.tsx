'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Patient, Provider, Department, Appointment, WaitingListItem } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { StateAlert } from '@/components/ui/Alert';
import { UserPlus, Calendar, Clock, ListOrdered, CheckCircle2, AlertTriangle } from 'lucide-react';

export function ReceptionistDashboard() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'register' | 'booking' | 'appointments' | 'waitingList'>('booking');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New Patient Form state
  const [newPatient, setNewPatient] = useState({
    firstName: '',
    lastName: '',
    dob: '1995-05-15',
    gender: 'FEMALE',
    phone: '+1-555-0303',
    email: '',
    bloodGroup: 'O_POSITIVE',
    address: '124 Hospital Way',
  });

  // Booking Form state
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [selectedDate, setSelectedDate] = useState('2026-11-30');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [appointmentReason, setAppointmentReason] = useState('General clinical follow-up');

  // Waiting List Form state
  const [waitPriority, setWaitPriority] = useState<'LOW' | 'NORMAL' | 'URGENT'>('NORMAL');
  const [waitNotes, setWaitNotes] = useState('Urgent consultation requested upon cancellation');

  // 1. Patients Query
  const patientsQuery = useQuery({
    queryKey: ['receptionist-patients'],
    queryFn: () => apiFetch<{ success: boolean; data: Patient[] }>('/patients'),
  });

  // 2. Departments Query
  const departmentsQuery = useQuery({
    queryKey: ['departments'],
    queryFn: () => apiFetch<{ success: boolean; data: Department[] }>('/departments'),
  });

  // 3. Providers Query
  const providersQuery = useQuery({
    queryKey: ['providers', selectedDeptId],
    queryFn: () => apiFetch<{ success: boolean; data: Provider[] }>(`/providers${selectedDeptId ? `?departmentId=${selectedDeptId}` : ''}`),
  });

  // 4. Availability Query
  const availabilityQuery = useQuery({
    queryKey: ['availability', selectedProviderId, selectedDate],
    queryFn: () => apiFetch<{ success: boolean; data: { slots: Array<{ start: string; end: string; available: boolean }> } }>(
      `/providers/${selectedProviderId}/availability?date=${selectedDate}`
    ),
    enabled: !!selectedProviderId && !!selectedDate,
  });

  // 5. Appointments Query
  const appointmentsQuery = useQuery({
    queryKey: ['all-appointments'],
    queryFn: () => apiFetch<{ success: boolean; data: Appointment[] }>('/appointments'),
  });

  // 6. Waiting List Query
  const waitingListQuery = useQuery({
    queryKey: ['waiting-list'],
    queryFn: () => apiFetch<{ success: boolean; data: WaitingListItem[] }>('/waiting-list'),
  });

  // Patient Registration Mutation
  const registerPatientMutation = useMutation({
    mutationFn: (data: typeof newPatient) =>
      apiFetch('/patients', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['receptionist-patients'] });
      setFeedback({ type: 'success', message: `Patient registered with MRN: ${res.data.mrn}` });
      setNewPatient({ firstName: '', lastName: '', dob: '1995-05-15', gender: 'FEMALE', phone: '', email: '', bloodGroup: 'O_POSITIVE', address: '' });
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to register patient.' });
    },
  });

  // Book Appointment Mutation (concurrency protected)
  const bookAppointmentMutation = useMutation({
    mutationFn: (slot: { start: string; end: string }) =>
      apiFetch('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId: selectedPatientId,
          providerId: selectedProviderId,
          departmentId: selectedDeptId || departmentsQuery.data?.data?.[0]?.id,
          scheduledStart: slot.start,
          scheduledEnd: slot.end,
          reason: appointmentReason,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      setFeedback({ type: 'success', message: 'Appointment booked successfully with concurrency protection.' });
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.message || 'Appointment booking failed.' });
    },
  });

  // Add to Waiting List Mutation
  const addWaitingListMutation = useMutation({
    mutationFn: () =>
      apiFetch('/waiting-list', {
        method: 'POST',
        body: JSON.stringify({
          patientId: selectedPatientId,
          departmentId: selectedDeptId || departmentsQuery.data?.data?.[0]?.id,
          providerId: selectedProviderId || undefined,
          priority: waitPriority,
          notes: waitNotes,
          requestedDate: new Date(selectedDate).toISOString(),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiting-list'] });
      setFeedback({ type: 'success', message: 'Patient placed on department waiting list.' });
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to add to waiting list.' });
    },
  });

  // Cancel Appointment Mutation
  const cancelAppointmentMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/appointments/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Cancelled by receptionist' }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      setFeedback({ type: 'success', message: 'Appointment cancelled.' });
    },
  });

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Reception & Patient Scheduling</h1>
        <p className="text-xs text-slate-500 mt-1">Manage intake, check real-time provider slots, and schedule appointments.</p>
      </div>

      {feedback && (
        <StateAlert
          type={feedback.type}
          message={feedback.message}
          title={feedback.type === 'success' ? 'Confirmed' : 'Booking Alert'}
        />
      )}

      {/* Navigation tabs */}
      <div className="flex border-b border-slate-200 space-x-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('booking')}
          className={`pb-3 flex items-center space-x-2 border-b-2 transition ${
            activeTab === 'booking' ? 'border-sky-600 text-sky-600 font-semibold' : 'border-transparent text-slate-500'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Book Appointment</span>
        </button>
        <button
          onClick={() => setActiveTab('register')}
          className={`pb-3 flex items-center space-x-2 border-b-2 transition ${
            activeTab === 'register' ? 'border-sky-600 text-sky-600 font-semibold' : 'border-transparent text-slate-500'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>Register New Patient</span>
        </button>
        <button
          onClick={() => setActiveTab('appointments')}
          className={`pb-3 flex items-center space-x-2 border-b-2 transition ${
            activeTab === 'appointments' ? 'border-sky-600 text-sky-600 font-semibold' : 'border-transparent text-slate-500'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>All Appointments ({appointmentsQuery.data?.data?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('waitingList')}
          className={`pb-3 flex items-center space-x-2 border-b-2 transition ${
            activeTab === 'waitingList' ? 'border-sky-600 text-sky-600 font-semibold' : 'border-transparent text-slate-500'
          }`}
        >
          <ListOrdered className="w-4 h-4" />
          <span>Waiting List ({waitingListQuery.data?.data?.length || 0})</span>
        </button>
      </div>

      {/* Tab: Booking */}
      {activeTab === 'booking' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm md:col-span-1 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b pb-2">1. Select Patient & Provider</h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Patient</label>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded"
              >
                <option value="">-- Choose Patient --</option>
                {patientsQuery.data?.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} ({p.mrn})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
              <select
                value={selectedDeptId}
                onChange={(e) => {
                  setSelectedDeptId(e.target.value);
                  setSelectedProviderId('');
                }}
                className="w-full text-xs p-2 border border-slate-300 rounded"
              >
                <option value="">-- All Departments --</option>
                {departmentsQuery.data?.data?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Attending Provider</label>
              <select
                value={selectedProviderId}
                onChange={(e) => setSelectedProviderId(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded"
              >
                <option value="">-- Select Provider --</option>
                {providersQuery.data?.data?.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    Dr. {pr.user.firstName} {pr.user.lastName} ({pr.specialization})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Consultation Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Visit</label>
              <input
                type="text"
                value={appointmentReason}
                onChange={(e) => setAppointmentReason(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded"
              />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm md:col-span-2">
            <h3 className="font-bold text-sm text-slate-900 border-b pb-2 mb-4">
              2. Available Schedule Slots ({selectedDate})
            </h3>

            {!selectedProviderId ? (
              <StateAlert type="info" message="Select an attending provider to calculate real-time available appointment slots." />
            ) : availabilityQuery.isLoading ? (
              <StateAlert type="loading" message="Computing time-zone aware availability slots..." />
            ) : !availabilityQuery.data?.data?.slots?.length ? (
              <div className="space-y-4">
                <StateAlert
                  type="empty"
                  title="No Scheduled Slots Today"
                  message="This provider has no active duty hours or slots configured for this calendar date."
                />
                {selectedPatientId && (
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-xs text-amber-800 mb-2 font-medium">Add patient to priority waiting list instead?</p>
                    <button
                      onClick={() => addWaitingListMutation.mutate()}
                      disabled={addWaitingListMutation.isPending}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold"
                    >
                      Place on Waiting List
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {availabilityQuery.data.data.slots.map((slot, idx) => {
                  const startTime = new Date(slot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const endTime = new Date(slot.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <button
                      key={idx}
                      disabled={!slot.available || !selectedPatientId || bookAppointmentMutation.isPending}
                      onClick={() => bookAppointmentMutation.mutate(slot)}
                      className={`p-3 rounded-lg border text-left transition flex flex-col justify-between ${
                        slot.available
                          ? 'bg-sky-50 border-sky-300 hover:bg-sky-100 hover:border-sky-400 cursor-pointer'
                          : 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <span className="font-semibold text-xs text-slate-900">{startTime} - {endTime}</span>
                      <span className={`text-[10px] mt-2 font-medium ${slot.available ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {slot.available ? 'Available' : 'Booked'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Patient Registration */}
      {activeTab === 'register' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm max-w-2xl">
          <h3 className="font-bold text-sm text-slate-900 mb-4">Patient Registration (Auto-generates Unique MRN)</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              registerPatientMutation.mutate(newPatient);
            }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs"
          >
            <div>
              <label className="block font-semibold text-slate-700 mb-1">First Name *</label>
              <input
                required
                value={newPatient.firstName}
                onChange={(e) => setNewPatient({ ...newPatient, firstName: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Last Name *</label>
              <input
                required
                value={newPatient.lastName}
                onChange={(e) => setNewPatient({ ...newPatient, lastName: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Date of Birth *</label>
              <input
                type="date"
                required
                value={newPatient.dob}
                onChange={(e) => setNewPatient({ ...newPatient, dob: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Gender *</label>
              <select
                value={newPatient.gender}
                onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded"
              >
                <option value="FEMALE">Female</option>
                <option value="MALE">Male</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Phone *</label>
              <input
                required
                value={newPatient.phone}
                onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Blood Group</label>
              <input
                value={newPatient.bloodGroup}
                onChange={(e) => setNewPatient({ ...newPatient, bloodGroup: e.target.value })}
                placeholder="e.g. O_POSITIVE"
                className="w-full p-2 border border-slate-300 rounded"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Residential Address</label>
              <input
                value={newPatient.address}
                onChange={(e) => setNewPatient({ ...newPatient, address: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded"
              />
            </div>
            <div className="sm:col-span-2 pt-2">
              <button
                type="submit"
                disabled={registerPatientMutation.isPending}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded font-semibold transition disabled:opacity-50"
              >
                {registerPatientMutation.isPending ? 'Registering...' : 'Register Patient'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab: All Appointments */}
      {activeTab === 'appointments' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {appointmentsQuery.isLoading ? (
            <StateAlert type="loading" message="Loading appointments..." />
          ) : !appointmentsQuery.data?.data?.length ? (
            <StateAlert type="empty" title="No Scheduled Appointments" />
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Provider</th>
                  <th className="py-3 px-4">Schedule</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {appointmentsQuery.data.data.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {a.patient?.firstName} {a.patient?.lastName} ({a.patient?.mrn})
                    </td>
                    <td className="py-3 px-4">Dr. {a.provider?.user?.firstName} {a.provider?.user?.lastName}</td>
                    <td className="py-3 px-4">{new Date(a.scheduledStart).toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <Badge status={a.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      {a.status === 'SCHEDULED' && (
                        <button
                          onClick={() => cancelAppointmentMutation.mutate(a.id)}
                          className="text-rose-600 hover:text-rose-800 font-semibold"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: Waiting List */}
      {activeTab === 'waitingList' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {waitingListQuery.isLoading ? (
            <StateAlert type="loading" message="Loading waiting list..." />
          ) : !waitingListQuery.data?.data?.length ? (
            <StateAlert type="empty" title="Waiting List Empty" message="No patients are currently on standby for slots." />
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {waitingListQuery.data.data.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {w.patient?.firstName} {w.patient?.lastName} ({w.patient?.mrn})
                    </td>
                    <td className="py-3 px-4">{w.department?.name || 'General Medicine'}</td>
                    <td className="py-3 px-4">
                      <Badge status={w.priority} />
                    </td>
                    <td className="py-3 px-4">
                      <Badge status={w.status} />
                    </td>
                    <td className="py-3 px-4 text-slate-600">{w.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
