import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { Worker } from '../../types';
import {
  Users,
  UserPlus,
  Edit2,
  Phone,
  Wrench,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';

export const ManagerWorkersPage: React.FC = () => {
  const { workers, complaints, createWorker, updateWorker } = useApp();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('General Maintenance');
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState('');

  // Deactivation warning modal
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  const handleOpenAdd = () => {
    setName('');
    setSpecialty('General Maintenance');
    setPhone('');
    setFormError('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (w: Worker) => {
    setEditingWorker(w);
    setName(w.name);
    setSpecialty(w.specialty);
    setPhone(w.contactNumber || '');
    setFormError('');
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Please provide a worker name.');
      return;
    }
    if (!specialty.trim()) {
      setFormError('Please select or specify a specialty.');
      return;
    }

    try {
      await createWorker(name.trim(), specialty.trim(), phone.trim() || undefined);
      setShowAddModal(false);
    } catch {
      setFormError('Failed to save worker record.');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorker) return;
    if (!name.trim()) {
      setFormError('Please provide a worker name.');
      return;
    }

    try {
      await updateWorker({
        ...editingWorker,
        name: name.trim(),
        specialty: specialty.trim(),
        contactNumber: phone.trim() || undefined,
      });
      setEditingWorker(null);
    } catch {
      setFormError('Failed to update worker record.');
    }
  };

  const handleToggleActive = async (w: Worker) => {
    setDeactivateError(null);
    if (w.active) {
      // Check if worker has active tasks
      const activeTasks = complaints.filter(
        (c) =>
          c.assignedWorkerId === w.id &&
          (c.status === 'Assigned' || c.status === 'In Progress' || c.status === 'Reopened')
      );

      if (activeTasks.length > 0) {
        setDeactivateError(
          `Cannot deactivate ${w.name} because they currently have ${activeTasks.length} active task(s). Reassign these tasks to another worker before deactivating.`
        );
        return;
      }
    }

    await updateWorker({
      ...w,
      active: !w.active,
    });
  };

  // Helper to compute average resolution time
  const getAvgResolutionTime = (workerId: string): string => {
    const resolvedTasks = complaints.filter(
      (c) =>
        c.assignedWorkerId === workerId &&
        (c.status === 'Resolved' || c.status === 'Closed') &&
        c.resolvedAt
    );

    if (resolvedTasks.length === 0) return 'No data yet';

    let totalMs = 0;
    for (const t of resolvedTasks) {
      const created = new Date(t.createdAt).getTime();
      const resolved = new Date(t.resolvedAt!).getTime();
      totalMs += Math.max(0, resolved - created);
    }

    const avgHours = totalMs / resolvedTasks.length / (1000 * 60 * 60);
    if (avgHours < 1) return '< 1 hour';
    if (avgHours < 24) return `${avgHours.toFixed(1)} hrs`;
    const avgDays = avgHours / 24;
    return `${avgDays.toFixed(1)} days`;
  };

  const specialtiesList = [
    'Plumbing',
    'Electrical',
    'Masonry & Roads',
    'Sanitation & Waste',
    'Lighting',
    'Drainage',
    'General Maintenance',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">Maintenance Workers</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Manage your community maintenance personnel, specialties, and active assignments.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="px-4 py-2 bg-teal-800 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Worker</span>
        </button>
      </div>

      {/* Deactivation Alert */}
      {deactivateError && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Reassignment Required:</span> {deactivateError}
          </div>
          <button
            type="button"
            onClick={() => setDeactivateError(null)}
            className="text-amber-700 font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Workers Grid or Empty State */}
      {workers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-800 flex items-center justify-center mx-auto mb-4 border border-teal-100">
            <Users className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-slate-900 mb-1">No Workers Registered Yet</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
            In accordance with prototype rules, no mock workers are pre-populated. Add your first worker to begin assigning complaints.
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-800 hover:bg-teal-700 text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create Worker Profile</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workers.map((w) => {
            const assignedCount = complaints.filter(
              (c) => c.assignedWorkerId === w.id && c.status === 'Assigned'
            ).length;
            const inProgressCount = complaints.filter(
              (c) => c.assignedWorkerId === w.id && c.status === 'In Progress'
            ).length;
            const resolvedCount = complaints.filter(
              (c) => c.assignedWorkerId === w.id && (c.status === 'Resolved' || c.status === 'Closed')
            ).length;
            const avgTime = getAvgResolutionTime(w.id);

            return (
              <div
                key={w.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{w.name}</h3>
                      <div className="text-xs font-medium text-teal-800 flex items-center gap-1 mt-0.5">
                        <Wrench className="w-3.5 h-3.5 text-teal-600" />
                        <span>{w.specialty}</span>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        w.active
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {w.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {w.contactNumber && (
                    <div className="text-xs text-slate-500 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{w.contactNumber}</span>
                    </div>
                  )}
                </div>

                {/* Computed Workload Metrics */}
                <div className="grid grid-cols-3 gap-2 text-center p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div>
                    <div className="text-sm font-bold text-slate-900">{assignedCount}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Assigned</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-amber-700">{inProgressCount}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">In Progress</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-emerald-700">{resolvedCount}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Resolved</div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Avg Resolution Time:</span>
                  </span>
                  <span className="font-semibold text-slate-800">{avgTime}</span>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(w)}
                    className="text-xs font-semibold text-teal-800 hover:text-teal-900 flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Profile</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleActive(w)}
                    className={`text-xs font-bold hover:underline cursor-pointer ${
                      w.active ? 'text-rose-600' : 'text-emerald-700'
                    }`}
                  >
                    {w.active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Worker Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Register Maintenance Worker"
        maxWidth="md"
      >
        <form onSubmit={handleSaveAdd} className="space-y-4">
          {formError && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Full Display Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ramesh Kumar"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Specialty <span className="text-red-500">*</span>
            </label>
            <select
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none bg-white"
            >
              {specialtiesList.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Contact Number (Optional)
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-teal-800 hover:bg-teal-700 text-white rounded-lg text-xs font-bold"
            >
              Register Worker
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Worker Modal */}
      {editingWorker && (
        <Modal
          isOpen={!!editingWorker}
          onClose={() => setEditingWorker(null)}
          title={`Edit Worker: ${editingWorker.name}`}
          maxWidth="md"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4">
            {formError && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Display Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Specialty <span className="text-red-500">*</span>
              </label>
              <select
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none bg-white"
              >
                {specialtiesList.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Contact Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingWorker(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-teal-800 hover:bg-teal-700 text-white rounded-lg text-xs font-bold"
              >
                Update Worker
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
