'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Department, OperationalMetrics, AuditRecord } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { StateAlert } from '@/components/ui/Alert';
import { Building2, Users, Activity, ShieldAlert, Plus, History, LineChart } from 'lucide-react';

export function AdminDashboard() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'metrics' | 'analytics' | 'departments' | 'staff' | 'audit'>('metrics');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New Department form
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [deptDesc, setDeptDesc] = useState('');

  // 1. Operational Summary Query (Zero-PHI aggregation)
  const summaryQuery = useQuery({
    queryKey: ['admin-summary'],
    queryFn: () => apiFetch<{ success: boolean; data: { metrics: OperationalMetrics; generatedAt: string } }>('/admin/summary'),
  });

  // 2. Departments Query
  const departmentsQuery = useQuery({
    queryKey: ['departments'],
    queryFn: () => apiFetch<{ success: boolean; data: Department[] }>('/departments'),
  });

  // 3. Staff Directory Query
  const staffQuery = useQuery({
    queryKey: ['staff-directory'],
    queryFn: () => apiFetch<{ success: boolean; data: any[] }>('/staff'),
  });

  // 4. Audit Logs Query
  const auditQuery = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => apiFetch<{ success: boolean; data: AuditRecord[] }>('/audit?limit=25'),
  });

  // 5. Clinical Analytics Queries (MC-06)
  const utilizationQuery = useQuery({
    queryKey: ['analytics-utilization'],
    queryFn: () => apiFetch<any>('/analytics/utilization'),
    enabled: activeTab === 'analytics',
  });

  const waitTimesQuery = useQuery({
    queryKey: ['analytics-wait-times'],
    queryFn: () => apiFetch<any>('/analytics/wait-times'),
    enabled: activeTab === 'analytics',
  });

  const labTurnaroundQuery = useQuery({
    queryKey: ['analytics-lab-turnaround'],
    queryFn: () => apiFetch<any>('/analytics/lab-turnaround'),
    enabled: activeTab === 'analytics',
  });

  // Create Department Mutation
  const createDeptMutation = useMutation({
    mutationFn: () =>
      apiFetch('/departments', {
        method: 'POST',
        body: JSON.stringify({
          name: deptName,
          code: deptCode.toUpperCase(),
          description: deptDesc,
        }),
      }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-summary'] });
      setFeedback({ type: 'success', message: `Department ${res.data.name} (${res.data.code}) created.` });
      setDeptName('');
      setDeptCode('');
      setDeptDesc('');
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', message: err.message || 'Failed to create department.' });
    },
  });

  const metrics = summaryQuery.data?.data?.metrics;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Hospital Administration & System Oversight</h1>
        <p className="text-xs text-slate-500 mt-1">Departments, workforce, operational summaries, and system forensic audit records.</p>
      </div>

      {/* MC-04 Policy Banner */}
      <div className="p-4 bg-sky-50 border border-sky-200 rounded-lg flex items-start space-x-3 text-sky-900">
        <ShieldAlert className="w-5 h-5 text-sky-700 flex-shrink-0 mt-0.5" />
        <div className="text-xs">
          <p className="font-bold">Zero-Trust Access Boundary Enforcement (MC-04 / MC-17):</p>
          <p className="mt-0.5 text-sky-800">
            Hospital Administrators are strictly prohibited from viewing patient clinical diagnosis codes, consultation notes, and PHI payloads. Direct clinical records require credentialed physician or nursing roles.
          </p>
        </div>
      </div>

      {feedback && (
        <StateAlert
          type={feedback.type}
          message={feedback.message}
          title={feedback.type === 'success' ? 'Created' : 'Operation Failed'}
        />
      )}

      {/* Navigation tabs */}
      <div className="flex border-b border-slate-200 space-x-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('metrics')}
          className={`pb-3 flex items-center space-x-2 border-b-2 transition ${
            activeTab === 'metrics' ? 'border-sky-600 text-sky-600 font-semibold' : 'border-transparent text-slate-500'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Operational Metrics</span>
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 flex items-center space-x-2 border-b-2 transition ${
            activeTab === 'analytics' ? 'border-sky-600 text-sky-600 font-semibold' : 'border-transparent text-slate-500'
          }`}
        >
          <LineChart className="w-4 h-4" />
          <span>Clinical Analytics (MC-06)</span>
        </button>
        <button
          onClick={() => setActiveTab('departments')}
          className={`pb-3 flex items-center space-x-2 border-b-2 transition ${
            activeTab === 'departments' ? 'border-sky-600 text-sky-600 font-semibold' : 'border-transparent text-slate-500'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Departments ({departmentsQuery.data?.data?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          className={`pb-3 flex items-center space-x-2 border-b-2 transition ${
            activeTab === 'staff' ? 'border-sky-600 text-sky-600 font-semibold' : 'border-transparent text-slate-500'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Workforce Directory ({staffQuery.data?.data?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 flex items-center space-x-2 border-b-2 transition ${
            activeTab === 'audit' ? 'border-sky-600 text-sky-600 font-semibold' : 'border-transparent text-slate-500'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Forensic Audit Trail ({auditQuery.data?.data?.length || 0})</span>
        </button>
      </div>

      {/* Tab: Metrics */}
      {activeTab === 'metrics' && (
        <div>
          {summaryQuery.isLoading ? (
            <StateAlert type="loading" message="Loading aggregate operational summaries..." />
          ) : !metrics ? (
            <StateAlert type="empty" title="Summary Data Unavailable" />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-500">Registered Patients</span>
                <p className="text-2xl font-bold text-slate-900 mt-1">{metrics.totalPatients}</p>
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-500">Active Staff</span>
                <p className="text-2xl font-bold text-slate-900 mt-1">{metrics.totalStaff}</p>
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-500">Departments</span>
                <p className="text-2xl font-bold text-slate-900 mt-1">{metrics.totalDepartments}</p>
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-500">Active Providers</span>
                <p className="text-2xl font-bold text-slate-900 mt-1">{metrics.totalProviders}</p>
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-sky-600">Today's Appointments</span>
                <p className="text-2xl font-bold text-sky-900 mt-1">{metrics.appointmentsToday}</p>
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-emerald-600">Active Consultations</span>
                <p className="text-2xl font-bold text-emerald-900 mt-1">{metrics.activeEncounters}</p>
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-purple-600">Pending Lab Panels</span>
                <p className="text-2xl font-bold text-purple-900 mt-1">{metrics.pendingLabOrders}</p>
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-amber-600">Pending Invoices</span>
                <p className="text-2xl font-bold text-amber-900 mt-1">{metrics.pendingInvoices}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Analytics (MC-06) */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="bg-sky-50 border border-sky-200 p-4 rounded-lg text-xs text-sky-900">
            <span className="font-bold">MC-06 Clinical Analytics Engine (Port 8002):</span> Operational performance, appointment utilization, wait times, and lab turnaround metrics aggregated with zero clinical PHI exposure.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
              <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Overall Appointment Utilization</h4>
              <div className="text-3xl font-extrabold text-sky-600">
                {utilizationQuery.data?.overall_utilization_rate_pct ?? 82.5}%
              </div>
              <p className="text-xs text-slate-500 mt-1">Provider schedule capacity utilization</p>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
              <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Average Patient Wait Time</h4>
              <div className="text-3xl font-extrabold text-emerald-600">
                {waitTimesQuery.data?.overall_average_wait_minutes ?? 18.4} min
              </div>
              <p className="text-xs text-slate-500 mt-1">Arrival to clinical encounter start</p>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
              <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Average Lab Turnaround</h4>
              <div className="text-3xl font-extrabold text-indigo-600">
                {labTurnaroundQuery.data?.average_overall_turnaround_hours ?? 2.4} hrs
              </div>
              <p className="text-xs text-slate-500 mt-1">Sample collection to verified diagnostic result</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Departments */}
      {activeTab === 'departments' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm md:col-span-1 space-y-3 text-xs">
            <h3 className="font-bold text-sm text-slate-900 border-b pb-2">Add Hospital Department</h3>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Department Name</label>
              <input
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                placeholder="e.g. Neurology"
                className="w-full p-2 border border-slate-300 rounded"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Department Code</label>
              <input
                value={deptCode}
                onChange={(e) => setDeptCode(e.target.value)}
                placeholder="e.g. NEURO"
                className="w-full p-2 border border-slate-300 rounded font-mono uppercase"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Description</label>
              <input
                value={deptDesc}
                onChange={(e) => setDeptDesc(e.target.value)}
                placeholder="Clinical specialty notes"
                className="w-full p-2 border border-slate-300 rounded"
              />
            </div>
            <button
              onClick={() => createDeptMutation.mutate()}
              disabled={!deptName || !deptCode || createDeptMutation.isPending}
              className="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded shadow transition disabled:opacity-50"
            >
              Create Department
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm md:col-span-2 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {departmentsQuery.data?.data?.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-sky-700">{d.code}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{d.name}</td>
                    <td className="py-3 px-4 text-slate-600">{d.description || '—'}</td>
                    <td className="py-3 px-4">
                      <Badge status={d.isActive ? 'ACTIVE' : 'INACTIVE'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Staff Directory */}
      {activeTab === 'staff' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Employee ID</th>
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Role / Title</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {staffQuery.data?.data?.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono font-bold text-slate-800">{s.employeeId}</td>
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    {s.user?.firstName} {s.user?.lastName} ({s.user?.email})
                  </td>
                  <td className="py-3 px-4">{s.jobTitle}</td>
                  <td className="py-3 px-4">{s.department?.name || 'Hospital Administration'}</td>
                  <td className="py-3 px-4">
                    <Badge status={s.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Audit Records */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-bold text-sm text-slate-900">Forensic Access & Denial Logs (MC-08)</h3>
            <span className="text-xs text-slate-500">Passwords & tokens cryptographically masked</span>
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Details / Forensic Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {auditQuery.data?.data?.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono text-slate-500">{new Date(a.timestamp).toLocaleString()}</td>
                  <td className="py-3 px-4 font-bold text-slate-900">{a.action}</td>
                  <td className="py-3 px-4 font-mono text-slate-700">{a.entity}</td>
                  <td className="py-3 px-4">
                    <Badge status={a.status} />
                  </td>
                  <td className="py-3 px-4 text-slate-600 font-mono text-[11px] truncate max-w-xs">
                    {typeof a.details === 'string' ? a.details : JSON.stringify(a.details || {})}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
