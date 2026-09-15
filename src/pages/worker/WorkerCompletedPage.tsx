import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PriorityBadge } from '../../components/common/PriorityBadge';
import {
  Calendar,
  MapPin,
  Star,
  FileCheck,
} from 'lucide-react';

export const WorkerCompletedPage: React.FC = () => {
  const { activeWorker, complaints } = useApp();
  const navigate = useNavigate();

  if (!activeWorker) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center">
        <p className="text-xs text-slate-500 mb-4">Please select a worker profile from the top bar.</p>
      </div>
    );
  }

  // Filter tasks assigned to active worker that are Resolved or Closed
  const completedTasks = complaints
    .filter(
      (c) =>
        c.assignedWorkerId === activeWorker.id &&
        (c.status === 'Resolved' || c.status === 'Closed')
    )
    .sort((a, b) => new Date(b.resolvedAt || b.updatedAt).getTime() - new Date(a.resolvedAt || a.updatedAt).getTime());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900">Completed Work History</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Repairs verified by management and completed by {activeWorker.name}.
        </p>
      </div>

      {completedTasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs">
          <FileCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900 mb-1">No completed work records yet</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Once you complete assigned tasks and management approves the evidence, your resolved tickets will be cataloged here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {completedTasks.map((t) => (
            <div
              key={t.id}
              onClick={() => navigate(`/worker/tasks/${t.id}`)}
              className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs hover:border-emerald-600 transition-colors cursor-pointer space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                      {t.reference}
                    </span>
                    <span className="text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                      {t.category}
                    </span>
                    <PriorityBadge priority={t.priority} />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">{t.title}</h3>
                </div>

                <StatusBadge status={t.status} size="sm" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-500 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5 truncate">
                  <MapPin className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                  <span className="truncate">{t.block} • {t.specificLocation}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    Resolved:{' '}
                    {t.resolvedAt ? new Date(t.resolvedAt).toLocaleDateString() : 'Yes'}
                  </span>
                </div>

                {t.rating && (
                  <div className="flex items-center gap-1.5 text-amber-700 font-bold sm:justify-end">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    <span>Resident Rating: {t.rating} / 5</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
