import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_STATUSES,
} from '../../types';
import {
  Download,
  Clock,
  Star,
  CheckCircle2,
  Filter,
} from 'lucide-react';

export const ManagerReportsPage: React.FC = () => {
  const { complaints, workers, settings } = useApp();

  // Filters for CSV export
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filtered = complaints.filter((c) => {
    if (categoryFilter !== 'ALL' && c.category !== categoryFilter) return false;
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    return true;
  });

  // METRIC 1: Average Time from Submission to Resolution
  const resolvedComplaints = complaints.filter(
    (c) => (c.status === 'Resolved' || c.status === 'Closed') && c.resolvedAt
  );

  let avgResolutionText = 'No data yet';
  if (resolvedComplaints.length > 0) {
    let totalMs = 0;
    for (const c of resolvedComplaints) {
      const created = new Date(c.createdAt).getTime();
      const resolved = new Date(c.resolvedAt!).getTime();
      totalMs += Math.max(0, resolved - created);
    }
    const avgHours = totalMs / resolvedComplaints.length / (1000 * 60 * 60);
    if (avgHours < 1) avgResolutionText = '< 1 hour';
    else if (avgHours < 24) avgResolutionText = `${avgHours.toFixed(1)} hours`;
    else avgResolutionText = `${(avgHours / 24).toFixed(1)} days`;
  }

  // METRIC 2: Average Resident Rating
  const ratedComplaints = complaints.filter((c) => typeof c.rating === 'number' && c.rating > 0);
  let avgRatingText = 'No data yet';
  let ratingCountText = '0 ratings';
  if (ratedComplaints.length > 0) {
    const totalRating = ratedComplaints.reduce((acc, c) => acc + (c.rating || 0), 0);
    const avg = totalRating / ratedComplaints.length;
    avgRatingText = `${avg.toFixed(1)} / 5.0`;
    ratingCountText = `Based on ${ratedComplaints.length} rating${ratedComplaints.length !== 1 ? 's' : ''}`;
  }

  // METRIC 3: Resolution Rate
  const resolutionRateText =
    complaints.length > 0
      ? `${Math.round((resolvedComplaints.length / complaints.length) * 100)}%`
      : 'No data yet';

  // Category Breakdown
  const categoryStats = COMPLAINT_CATEGORIES.map((cat) => {
    const count = complaints.filter((c) => c.category === cat).length;
    const pct = complaints.length > 0 ? Math.round((count / complaints.length) * 100) : 0;
    return { category: cat, count, pct };
  });

  // Status Breakdown
  const statusStats = COMPLAINT_STATUSES.map((st) => {
    const count = complaints.filter((c) => c.status === st).length;
    const pct = complaints.length > 0 ? Math.round((count / complaints.length) * 100) : 0;
    return { status: st, count, pct };
  });

  // Worker completion counts
  const workerStats = workers.map((w) => {
    const completed = complaints.filter(
      (c) => c.assignedWorkerId === w.id && (c.status === 'Resolved' || c.status === 'Closed')
    ).length;
    return {
      name: w.name,
      specialty: w.specialty,
      completed,
    };
  });

  // Working CSV Export of Filtered Records
  const handleExportCSV = () => {
    if (filtered.length === 0) {
      alert('No complaint records available to export.');
      return;
    }

    const headers = [
      'Reference',
      'Title',
      'Category',
      'Status',
      'Priority',
      'Block',
      'Specific Location',
      'Resident Name',
      'Assigned Worker',
      'Created At',
      'Resolved At',
      'Rating',
      'Rating Feedback',
    ];

    const escapeCSV = (val?: string | number | null) => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = filtered.map((c) => [
      escapeCSV(c.reference),
      escapeCSV(c.title),
      escapeCSV(c.category),
      escapeCSV(c.status),
      escapeCSV(c.priority),
      escapeCSV(c.block),
      escapeCSV(c.specificLocation),
      escapeCSV(c.residentName),
      escapeCSV(c.assignedWorkerName || 'Unassigned'),
      escapeCSV(c.createdAt),
      escapeCSV(c.resolvedAt || ''),
      escapeCSV(c.rating || ''),
      escapeCSV(c.ratingFeedback || ''),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `community_complaints_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">Reports & Performance Analytics</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Strictly computed from actual records logged in {settings.name}.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          className="px-4 py-2.5 bg-teal-800 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Export Filtered Records (CSV)</span>
        </button>
      </div>

      {/* Primary Performance Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Avg Resolution Time</span>
            <Clock className="w-4 h-4 text-teal-700" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{avgResolutionText}</div>
          <p className="text-[11px] text-slate-500 leading-tight">
            Average time from resident submission to manager resolution approval.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-bold uppercase tracking-wider">Avg Resident Rating</span>
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{avgRatingText}</div>
          <p className="text-[11px] text-slate-500 leading-tight">
            {ratingCountText}. Calculated from resident star reviews after resolution.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-bold uppercase tracking-wider">Overall Resolution Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{resolutionRateText}</div>
          <p className="text-[11px] text-slate-500 leading-tight">
            Percentage of total submitted tickets currently in Resolved or Closed state.
          </p>
        </div>
      </div>

      {/* CSV Filter Configuration */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mr-2">
          <Filter className="w-4 h-4 text-teal-700" />
          <span>CSV Export Filters:</span>
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none bg-white"
        >
          <option value="ALL">All Categories</option>
          {COMPLAINT_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none bg-white"
        >
          <option value="ALL">All Statuses</option>
          {COMPLAINT_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <span className="text-xs text-slate-500 ml-auto">
          {filtered.length} of {complaints.length} records will be exported
        </span>
      </div>

      {/* Breakdown Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-sm font-bold text-slate-900">Complaints by Category</h2>
            <p className="text-xs text-slate-500">Distribution of logged issues by facility category</p>
          </div>

          <div className="space-y-3">
            {categoryStats.map((item) => (
              <div key={item.category} className="space-y-1 text-xs">
                <div className="flex justify-between font-medium text-slate-700">
                  <span>{item.category}</span>
                  <span className="text-slate-500">
                    {item.count} ({item.pct}%)
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-700 rounded-full"
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Status Breakdown Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-sm font-bold text-slate-900">Complaints by Status</h2>
            <p className="text-xs text-slate-500">Current progression stage across all tickets</p>
          </div>

          <div className="space-y-3">
            {statusStats.map((item) => (
              <div key={item.status} className="space-y-1 text-xs">
                <div className="flex justify-between font-medium text-slate-700">
                  <span>{item.status}</span>
                  <span className="text-slate-500">
                    {item.count} ({item.pct}%)
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-700 rounded-full"
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Worker Task Completion Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="border-b border-slate-100 pb-2">
          <h2 className="text-sm font-bold text-slate-900">Worker Task Completion Counts</h2>
          <p className="text-xs text-slate-500">Total verified repairs completed by each maintenance worker</p>
        </div>

        {workerStats.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No workers registered yet.
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                <th className="py-2">Worker Name</th>
                <th className="py-2">Specialty</th>
                <th className="py-2 text-right">Tasks Completed & Resolved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {workerStats.map((w, i) => (
                <tr key={i}>
                  <td className="py-2.5 font-bold text-slate-900">{w.name}</td>
                  <td className="py-2.5 text-slate-500">{w.specialty}</td>
                  <td className="py-2.5 text-right font-black text-emerald-700">{w.completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
