import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  Wrench,
  Phone,
  Users,
  Check,
  LogOut,
} from 'lucide-react';

export const WorkerProfilePage: React.FC = () => {
  const { activeWorker, workers, complaints, setRole, logout } = useApp();
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900">Worker Profile</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Field technician profile, operational specialty, and profile switcher.
        </p>
      </div>

      {activeWorker ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold text-lg shadow-xs">
                {activeWorker.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">{activeWorker.name}</h2>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                    Active Technician
                  </span>
                </div>
                <div className="text-xs text-amber-700 font-semibold flex items-center gap-1.5 mt-0.5">
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Specialty: {activeWorker.specialty}</span>
                </div>
              </div>
            </div>
          </div>

          {activeWorker.contactNumber && (
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Phone className="w-4 h-4 text-slate-400" />
              <span>Contact: {activeWorker.contactNumber}</span>
            </div>
          )}

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-500">
            Field workers are created and maintained by Community Managers. Worker assignments and verified completions update directly across all portal dashboards.
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
          No worker profile is currently selected.
        </div>
      )}

      {/* Switch Worker Profiles */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900">Available Worker Profiles ({workers.length})</h3>
          </div>
          <Link
            to="/manager/workers"
            className="text-xs text-teal-800 font-bold hover:underline"
          >
            Manage in Manager Portal &rarr;
          </Link>
        </div>

        {workers.length === 0 ? (
          <div className="text-xs text-slate-500 py-4 text-center italic">
            No worker profiles exist yet. Create a worker from the Manager portal.
          </div>
        ) : (
          <div className="space-y-2">
            {workers.map((w) => {
              const isSelected = activeWorker?.id === w.id;
              const assignedTasks = complaints.filter(
                (c) => c.assignedWorkerId === w.id && (c.status === 'Assigned' || c.status === 'In Progress')
              ).length;

              return (
                <div
                  key={w.id}
                  onClick={() => setRole('Worker', undefined, w.id)}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    isSelected
                      ? 'border-amber-500 bg-amber-50/50 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/40 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                      isSelected ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {w.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{w.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {w.specialty} • {assignedTasks} active task{assignedTasks !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>

                  {isSelected ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                      <Check className="w-3.5 h-3.5" />
                      <span>Active</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRole('Worker', undefined, w.id);
                      }}
                      className="text-xs font-semibold text-slate-600 hover:text-amber-700 px-2 py-1 rounded hover:bg-slate-200"
                    >
                      Switch to this worker
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Session & Security */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Session & Security</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            End your active technician session and return to the main landing page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            logout();
            navigate('/', { replace: true, state: { loggedOut: true, message: 'You have been logged out successfully.' } });
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          aria-label="Sign out of worker session"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};
