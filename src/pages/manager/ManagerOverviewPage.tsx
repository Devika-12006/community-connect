import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  ClipboardList,
  AlertOctagon,
  Wrench,
  CheckCircle2,
  Users,
  Flame,
  ArrowRight,
  FolderOpen,
} from 'lucide-react';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PriorityBadge } from '../../components/common/PriorityBadge';
import { COMPLAINT_CATEGORIES } from '../../types';

export const ManagerOverviewPage: React.FC = () => {
  const { complaints, workers } = useApp();
  const navigate = useNavigate();

  // Metrics derived strictly from local records
  const totalComplaints = complaints.length;

  const unassignedComplaints = complaints.filter(
    (c) =>
      c.status !== 'Closed' &&
      c.status !== 'Rejected' &&
      (!c.assignedWorkerId || c.status === 'Submitted' || c.status === 'Under Review')
  );

  const inProgressComplaints = complaints.filter(
    (c) => c.status === 'In Progress' || c.status === 'Assigned'
  );

  const resolvedAndClosed = complaints.filter(
    (c) => c.status === 'Resolved' || c.status === 'Closed'
  );

  const urgentComplaints = complaints.filter(
    (c) => c.priority === 'Urgent' && c.status !== 'Closed' && c.status !== 'Rejected'
  );

  // Complaints requiring urgent or triage action
  const actionRequired = complaints
    .filter(
      (c) =>
        c.status === 'Submitted' ||
        c.status === 'Under Review' ||
        c.status === 'Reopened' ||
        c.completionAwaitingReview ||
        c.priority === 'Urgent'
    )
    .filter((c) => c.status !== 'Closed' && c.status !== 'Rejected')
    .slice(0, 5);

  // Category counts
  const categoryCounts = COMPLAINT_CATEGORIES.map((cat) => ({
    category: cat,
    count: complaints.filter((c) => c.category === cat).length,
  })).filter((item) => item.count > 0);

  // Worker workload stats
  const workerWorkload = workers.map((w) => {
    const assignedTasks = complaints.filter(
      (c) => c.assignedWorkerId === w.id && (c.status === 'Assigned' || c.status === 'In Progress')
    ).length;
    const completedTasks = complaints.filter(
      (c) => c.assignedWorkerId === w.id && (c.status === 'Resolved' || c.status === 'Closed')
    ).length;
    return {
      worker: w,
      assignedTasks,
      completedTasks,
    };
  });

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">Community Management Overview</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Real-time status of all reported issues, triage queue, and field team allocation.
          </p>
        </div>

        <div className="flex gap-2.5">
          <Link
            to="/manager/complaints"
            className="px-4 py-2 bg-teal-800 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>Triage Complaints</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Primary Metrics Grid (Strictly derived from local records) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Filed</span>
            <ClipboardList className="w-4 h-4 text-teal-700" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{totalComplaints}</div>
          <div className="text-[11px] text-slate-400 mt-1">All time complaints</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Unassigned</span>
            <AlertOctagon className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-800">
            {unassignedComplaints.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Pending allocation</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-teal-700 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">In Progress</span>
            <Wrench className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-teal-800">
            {inProgressComplaints.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Assigned or active work</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Resolved/Closed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-800">
            {resolvedAndClosed.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Completed repairs</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-red-700 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Urgent Active</span>
            <Flame className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-red-700">
            {urgentComplaints.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">High-priority attention</div>
        </div>
      </div>

      {/* Center Layout: Action Queue + Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Urgent & Action Needed Queue */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Complaints Requiring Action</h2>
              <p className="text-xs text-slate-500">Unassigned, reopened, urgent, or awaiting review</p>
            </div>
            <Link
              to="/manager/complaints"
              className="text-xs font-bold text-teal-800 hover:text-teal-900 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {actionRequired.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2 opacity-80" />
              <div className="font-semibold text-slate-700">No action-pending complaints</div>
              <div>All current tickets are assigned and being resolved.</div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {actionRequired.map((c) => (
                <div
                  key={c.id}
                  onClick={() => navigate(`/manager/complaints?selected=${c.id}`)}
                  className="p-4 hover:bg-slate-50/80 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {c.reference}
                      </span>
                      <span className="text-xs font-medium text-slate-500">
                        {c.category}
                      </span>
                      <PriorityBadge priority={c.priority} />
                      {c.completionAwaitingReview && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                          Review Evidence
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 truncate">{c.title}</h3>
                    <div className="text-xs text-slate-500 truncate">
                      {c.block} • Reported by {c.residentName}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 shrink-0">
                    <StatusBadge status={c.status} size="sm" />
                    <span className="text-xs font-bold text-teal-800">
                      Manage &rarr;
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col">
          <div className="border-b border-slate-100 pb-3 mb-4">
            <h2 className="text-base font-bold text-slate-900">Category Breakdown</h2>
            <p className="text-xs text-slate-500">Distribution across community facilities</p>
          </div>

          {categoryCounts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 text-center text-slate-400 text-xs">
              <FolderOpen className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <div>No complaint categories reported yet.</div>
            </div>
          ) : (
            <div className="space-y-3.5 flex-1">
              {categoryCounts.map((item) => {
                const percentage = Math.round((item.count / totalComplaints) * 100) || 0;
                return (
                  <div key={item.category} className="space-y-1 text-xs">
                    <div className="flex justify-between font-semibold text-slate-700">
                      <span>{item.category}</span>
                      <span className="text-slate-500">{item.count} ({percentage}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-700 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Worker Workload Summary */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Field Worker Workload</h2>
            <p className="text-xs text-slate-500">Active assignments and completed repairs per worker</p>
          </div>
          <Link
            to="/manager/workers"
            className="text-xs font-bold text-teal-800 hover:text-teal-900"
          >
            Manage Workers ({workers.length})
          </Link>
        </div>

        {workers.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-xs">
            <Users className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            <div className="font-semibold text-slate-800 mb-1">No worker profiles created yet</div>
            <p className="text-slate-500 mb-3">Create workers to assign maintenance complaints and monitor field progress.</p>
            <Link
              to="/manager/workers"
              className="inline-block px-4 py-2 bg-teal-800 hover:bg-teal-700 text-white rounded-xl text-xs font-bold"
            >
              Create First Worker
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {workerWorkload.map(({ worker, assignedTasks, completedTasks }) => (
              <div
                key={worker.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900">{worker.name}</div>
                    <div className="text-[11px] text-slate-500">{worker.specialty}</div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      worker.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {worker.active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center pt-2 border-t border-slate-200/60">
                  <div className="p-2 bg-white rounded-lg border border-slate-100">
                    <div className="text-base font-black text-amber-700">{assignedTasks}</div>
                    <div className="text-[10px] text-slate-500 font-semibold uppercase">Active Tasks</div>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-100">
                    <div className="text-base font-black text-emerald-700">{completedTasks}</div>
                    <div className="text-[10px] text-slate-500 font-semibold uppercase">Completed</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
