import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  PlusCircle,
  Clock,
  Wrench,
  CheckCircle2,
  FileText,
  ArrowRight,
  AlertCircle,
  Building,
  UserPlus,
} from 'lucide-react';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PriorityBadge } from '../../components/common/PriorityBadge';

export const ResidentDashboard: React.FC = () => {
  const { activeResident, complaints, residents } = useApp();
  const navigate = useNavigate();

  // If no resident is selected or none exist
  if (!activeResident) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center mx-auto mb-4">
          <UserPlus className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">No Resident Profile Active</h2>
        <p className="text-sm text-slate-600 mb-6">
          {residents.length === 0
            ? 'Set up a resident profile to begin reporting and tracking maintenance issues in your community.'
            : 'Please select or activate a resident profile to see your personal complaint dashboard.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/resident/profile')}
          className="px-5 py-2.5 bg-teal-800 hover:bg-teal-700 text-white text-sm font-bold rounded-xl shadow-xs cursor-pointer"
        >
          {residents.length === 0 ? 'Create Resident Profile' : 'Select Resident Profile'}
        </button>
      </div>
    );
  }

  // Filter complaints by active resident
  const residentComplaints = complaints.filter((c) => c.residentId === activeResident.id);

  // Compute metrics from actual records
  const totalCount = residentComplaints.length;
  const awaitingCount = residentComplaints.filter(
    (c) => c.status === 'Submitted' || c.status === 'Under Review' || c.status === 'Reopened'
  ).length;
  const inProgressCount = residentComplaints.filter(
    (c) => c.status === 'Assigned' || c.status === 'In Progress'
  ).length;
  const resolvedCount = residentComplaints.filter(
    (c) => c.status === 'Resolved' || c.status === 'Closed'
  ).length;

  const recentComplaints = [...residentComplaints]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-800 mb-1">
            <Building className="w-3.5 h-3.5" />
            <span>{activeResident.block} • Flat {activeResident.flatNumber}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            Welcome, {activeResident.displayName}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Track your submitted maintenance tickets and report new issues.
          </p>
        </div>

        <Link
          to="/resident/report"
          className="px-4 py-2.5 rounded-xl bg-teal-800 hover:bg-teal-700 text-white text-sm font-bold flex items-center gap-2 shadow-xs transition-all shrink-0 cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Report an Issue</span>
        </Link>
      </div>

      {/* Metrics Row (Derived strictly from local records) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total</span>
            <FileText className="w-4 h-4 text-teal-700" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{totalCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Submitted by you</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Awaiting Action</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-800">{awaitingCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Submitted or under review</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-teal-700 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">In Progress</span>
            <Wrench className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-teal-800">{inProgressCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Assigned or active work</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Resolved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-800">{resolvedCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Resolved or confirmed closed</div>
        </div>
      </div>

      {/* Main Content Area */}
      {totalCount === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-800 flex items-center justify-center mx-auto mb-4 border border-teal-100">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">
            You haven’t reported any issues yet.
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-6">
            Whenever you notice broken streetlights, water leakage, potholes, or waste in your community, report it here for fast resolution.
          </p>
          <Link
            to="/resident/report"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-800 hover:bg-teal-700 text-white text-sm font-bold shadow-xs transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Report Your First Issue</span>
          </Link>
        </div>
      ) : (
        /* Recent Complaints List */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Complaints</h2>
              <p className="text-xs text-slate-500">Your latest submitted reports</p>
            </div>
            <Link
              to="/resident/complaints"
              className="text-xs font-bold text-teal-800 hover:text-teal-900 flex items-center gap-1"
            >
              <span>View all ({totalCount})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {recentComplaints.map((c) => (
              <div
                key={c.id}
                onClick={() => navigate(`/resident/complaints/${c.id}`)}
                className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {c.reference}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      {c.category}
                    </span>
                    <PriorityBadge priority={c.priority} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 truncate">
                    {c.title}
                  </h3>
                  <div className="text-xs text-slate-500 truncate">
                    {c.block} • {c.specificLocation}
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0">
                  <StatusBadge status={c.status} size="sm" />
                  <span className="text-[11px] text-slate-400">
                    {new Date(c.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
