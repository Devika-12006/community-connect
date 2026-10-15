import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { RoleType } from '../../types';
import { Users, Shield, Wrench, ChevronDown, Check, AlertCircle, Plus, UserPlus, LogOut } from 'lucide-react';
import { Modal } from './Modal';
import { useNavigate } from 'react-router-dom';

export const RoleSwitcher: React.FC = () => {
  const {
    currentRole,
    activeResident,
    activeWorker,
    residents,
    workers,
    settings,
    setRole,
    createResident,
    logout,
  } = useApp();

  const [modalOpen, setModalOpen] = useState(false);
  const [showAddResident, setShowAddResident] = useState(false);
  const [newResName, setNewResName] = useState('');
  const [newResBlock, setNewResBlock] = useState(settings.blocks[0] || 'Block A');
  const [newResFlat, setNewResFlat] = useState('');
  const [residentError, setResidentError] = useState('');
  const navigate = useNavigate();

  const handleSelectRole = (role: RoleType, resId?: string, wId?: string) => {
    setRole(role, resId, wId);
    setModalOpen(false);
    setShowAddResident(false);
    if (role === 'Resident') {
      navigate('/resident/home');
    } else if (role === 'Manager') {
      navigate('/manager/overview');
    } else if (role === 'Worker') {
      navigate('/worker/tasks');
    }
  };

  const handleCreateResident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResName.trim()) {
      setResidentError('Please enter a resident display name.');
      return;
    }
    if (!newResFlat.trim()) {
      setResidentError('Please enter a flat or house number.');
      return;
    }

    try {
      const created = await createResident(newResName.trim(), newResBlock, newResFlat.trim());
      setNewResName('');
      setNewResFlat('');
      setShowAddResident(false);
      setResidentError('');
      handleSelectRole('Resident', created.id);
    } catch {
      setResidentError('Failed to create resident profile.');
    }
  };

  const getRoleLabel = () => {
    if (currentRole === 'Resident') {
      return activeResident ? `Resident: ${activeResident.displayName}` : 'Resident Portal';
    }
    if (currentRole === 'Worker') {
      return activeWorker ? `Worker: ${activeWorker.name}` : 'Worker Portal';
    }
    return 'Community Manager';
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-teal-600/40 bg-teal-800 hover:bg-teal-700 text-white text-xs sm:text-sm font-medium transition-all shadow-xs cursor-pointer"
        title="Switch simulated prototype role"
        aria-label="Switch prototype role"
      >
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="truncate max-w-[130px] sm:max-w-[200px]">{getRoleLabel()}</span>
        <ChevronDown className="w-3.5 h-3.5 opacity-80 shrink-0" />
      </button>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setShowAddResident(false);
        }}
        title="Prototype Role Switcher"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-900">
            <AlertCircle className="w-4 h-4 shrink-0 text-teal-700 mt-0.5" />
            <div>
              <span className="font-semibold">Demonstration Mode Notice:</span> This is a demonstration prototype, not secure authentication. Use this switcher to test how different community participants interact with complaints.
            </div>
          </div>

          <div className="space-y-3">
            {/* 1. Community Manager */}
            <div
              onClick={() => handleSelectRole('Manager')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                currentRole === 'Manager'
                  ? 'border-teal-600 bg-teal-50/60 shadow-xs ring-1 ring-teal-500'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">Community Manager</div>
                  <div className="text-xs text-slate-500">Triage reports, assign workers, set priority, monitor reports</div>
                </div>
              </div>
              {currentRole === 'Manager' && <Check className="w-5 h-5 text-teal-700" />}
            </div>

            {/* 2. Resident */}
            <div className={`rounded-xl border transition-all ${
              currentRole === 'Resident' ? 'border-teal-600 bg-teal-50/20' : 'border-slate-200 bg-white'
            }`}>
              <div
                onClick={() => handleSelectRole('Resident', activeResident?.id)}
                className="p-3.5 cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Resident</div>
                    <div className="text-xs text-slate-500">Submit issues, track progress, review resolution & rate service</div>
                  </div>
                </div>
                {currentRole === 'Resident' && <Check className="w-5 h-5 text-teal-700" />}
              </div>

              {/* Profiles list or create */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 rounded-b-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Resident Profiles ({residents.length})
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAddResident(!showAddResident);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{showAddResident ? 'Cancel' : 'New Profile'}</span>
                  </button>
                </div>

                {showAddResident && (
                  <form onSubmit={handleCreateResident} className="p-3 bg-white rounded-lg border border-teal-200 shadow-xs space-y-2.5">
                    <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      <UserPlus className="w-4 h-4 text-teal-700" />
                      Create Testing Resident Profile
                    </div>
                    {residentError && (
                      <div className="text-xs text-red-600 font-medium">{residentError}</div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Display Name</label>
                      <input
                        type="text"
                        value={newResName}
                        onChange={(e) => setNewResName(e.target.value)}
                        placeholder="e.g. Sarah Jenkins"
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-teal-600 focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Block / Building</label>
                        <select
                          value={newResBlock}
                          onChange={(e) => setNewResBlock(e.target.value)}
                          className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-teal-600 focus:outline-none"
                        >
                          {settings.blocks.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Flat / House #</label>
                        <input
                          type="text"
                          value={newResFlat}
                          onChange={(e) => setNewResFlat(e.target.value)}
                          placeholder="e.g. 402"
                          className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-teal-600 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddResident(false)}
                        className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 text-xs bg-teal-700 text-white rounded font-medium hover:bg-teal-800"
                      >
                        Save & Switch
                      </button>
                    </div>
                  </form>
                )}

                {residents.length === 0 && !showAddResident && (
                  <div className="text-xs text-slate-500 py-1 italic">
                    No resident profiles yet. Click &quot;New Profile&quot; above to create one for testing.
                  </div>
                )}

                {residents.length > 0 && (
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {residents.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectRole('Resident', r.id);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                          activeResident?.id === r.id && currentRole === 'Resident'
                            ? 'bg-teal-700 text-white font-medium'
                            : 'hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        <span className="truncate">
                          {r.displayName} ({r.block}, Flat {r.flatNumber})
                        </span>
                        {activeResident?.id === r.id && currentRole === 'Resident' && (
                          <Check className="w-3.5 h-3.5 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Maintenance Worker */}
            <div className={`rounded-xl border transition-all ${
              currentRole === 'Worker' ? 'border-teal-600 bg-teal-50/20' : 'border-slate-200 bg-white'
            }`}>
              <div
                onClick={() => {
                  if (workers.length > 0) {
                    handleSelectRole('Worker', undefined, activeWorker?.id || workers[0].id);
                  }
                }}
                className={`p-3.5 ${workers.length > 0 ? 'cursor-pointer' : 'cursor-not-allowed'} flex items-center justify-between`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Maintenance Worker</div>
                    <div className="text-xs text-slate-500">View assigned tasks, update progress & upload completion proof</div>
                  </div>
                </div>
                {currentRole === 'Worker' && <Check className="w-5 h-5 text-teal-700" />}
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-200 rounded-b-xl space-y-2">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">
                  Worker Profiles ({workers.length})
                </span>

                {workers.length === 0 ? (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                    No worker profiles yet. Create a worker from the Manager portal.
                  </div>
                ) : (
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {workers.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectRole('Worker', undefined, w.id);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                          activeWorker?.id === w.id && currentRole === 'Worker'
                            ? 'bg-teal-700 text-white font-medium'
                            : 'hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="truncate">
                          <span className="font-medium">{w.name}</span>
                          <span className="opacity-80 ml-1.5">({w.specialty})</span>
                          {!w.active && <span className="ml-1.5 text-red-500 text-[10px]">(Inactive)</span>}
                        </div>
                        {activeWorker?.id === w.id && currentRole === 'Worker' && (
                          <Check className="w-3.5 h-3.5 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Prototype Session Sign Out */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">Finished testing session?</span>
            <button
              type="button"
              onClick={() => {
                setModalOpen(false);
                logout();
                navigate('/', { replace: true, state: { loggedOut: true, message: 'You have been logged out successfully.' } });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out of Session</span>
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
