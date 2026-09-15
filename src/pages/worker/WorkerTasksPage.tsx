import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PriorityBadge } from '../../components/common/PriorityBadge';
import {
  Wrench,
  MapPin,
  Calendar,
  ArrowRight,
  RotateCcw,
  CheckCircle,
} from 'lucide-react';

export const WorkerTasksPage: React.FC = () => {
  const { activeWorker, workers, complaints } = useApp();
  const navigate = useNavigate();

  // If no worker is active or none exist
  if (!activeWorker) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center bg-white rounded-2xl border border-slate-200 p-8 shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto mb-4 border border-amber-200">
          <Wrench className="w-7 h-7" />
        </div>
        <h2 className="text-base font-bold text-slate-900 mb-2">No Active Worker Profile</h2>
        {workers.length === 0 ? (
          <>
            <p className="text-xs text-slate-500 mb-6">
              No worker profiles yet. Create a worker from the Manager portal.
            </p>
            <Link
              to="/manager/workers"
              className="inline-block px-4 py-2.5 bg-teal-800 hover:bg-teal-700 text-white rounded-xl text-xs font-bold"
            >
              Go to Manager Portal
            </Link>
          </>
        ) : (
          <>
            <p className="text-xs text-slate-500 mb-6">
              Please select a worker profile using the role switcher in the top bar to view assigned tasks.
            </p>
          </>
        )}
      </div>
    );
  }

  // Filter tasks assigned to active worker that are active (not resolved/closed/rejected)
  const myTasks = complaints
    .filter(
      (c) =>
        c.assignedWorkerId === activeWorker.id &&
        c.status !== 'Resolved' &&
        c.status !== 'Closed' &&
        c.status !== 'Rejected'
    )
    .sort((a, b) => {
      // Sort urgent tasks first, then older tasks
      if (a.priority === 'Urgent' && b.priority !== 'Urgent') return -1;
      if (b.priority === 'Urgent' && a.priority !== 'Urgent') return 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">
            Active Maintenance Queue
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            Assigned Tasks for {activeWorker.name}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Specialty: <strong className="text-slate-700">{activeWorker.specialty}</strong> • Showing active repair tickets
          </p>
        </div>

        <div className="px-3.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900 w-fit">
          {myTasks.length} Active Task{myTasks.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Task List */}
      {myTasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs">
          <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto mb-3 opacity-80" />
          <h2 className="text-base font-bold text-slate-900 mb-1">All Caught Up!</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            You have no pending maintenance tasks assigned right now. As community management allocates issues, they will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {myTasks.map((task) => (
            <div
              key={task.id}
              onClick={() => navigate(`/worker/tasks/${task.id}`)}
              className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs hover:shadow-md transition-all cursor-pointer space-y-3 ${
                task.priority === 'Urgent'
                  ? 'border-red-300 ring-1 ring-red-200'
                  : 'border-slate-200 hover:border-amber-500/60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                      {task.reference}
                    </span>
                    <span className="text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                      {task.category}
                    </span>
                    <PriorityBadge priority={task.priority} />
                    {task.completionAwaitingReview && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                        Completion Awaiting Review
                      </span>
                    )}
                    {task.correctionReason && !task.completionAwaitingReview && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300 text-[10px] font-bold flex items-center gap-1">
                        <RotateCcw className="w-3 h-3" />
                        <span>Correction Requested</span>
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">{task.title}</h3>
                </div>

                <StatusBadge status={task.status} size="sm" />
              </div>

              {/* Correction Alert callout if present */}
              {task.correctionReason && !task.completionAwaitingReview && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  <span className="font-bold block mb-0.5">Manager Correction Request:</span>
                  <p className="text-[11px] text-amber-800">{task.correctionReason}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-500 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5 truncate">
                  <MapPin className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                  <span className="truncate">{task.block} • {task.specificLocation}</span>
                </div>

                <div className="flex items-center sm:justify-end gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    Assigned:{' '}
                    {task.assignedAt
                      ? new Date(task.assignedAt).toLocaleDateString()
                      : new Date(task.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-xs">
                <span className="text-[11px] text-slate-400">
                  Reported by {task.residentName} (Flat {task.residentFlat})
                </span>
                <span className="text-amber-700 font-bold flex items-center gap-1">
                  <span>Open Task Details</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
