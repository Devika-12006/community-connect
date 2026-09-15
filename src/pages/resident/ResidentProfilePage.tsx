import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Building,
  Plus,
  Check,
  Users,
} from 'lucide-react';

export const ResidentProfilePage: React.FC = () => {
  const {
    activeResident,
    residents,
    settings,
    setRole,
    createResident,
  } = useApp();

  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [block, setBlock] = useState(settings.blocks[0] || 'Block A');
  const [flat, setFlat] = useState('');
  const [formError, setFormError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Please enter a display name.');
      return;
    }
    if (!flat.trim()) {
      setFormError('Please enter a flat or house number.');
      return;
    }

    try {
      const created = await createResident(name.trim(), block, flat.trim());
      setName('');
      setFlat('');
      setShowAddForm(false);
      setFormError('');
      setRole('Resident', created.id);
    } catch {
      setFormError('Failed to create resident profile.');
    }
  };

  const handleSwitchProfile = (resId: string) => {
    setRole('Resident', resId);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900">Resident Profiles</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Manage local resident identities to test ticket ownership, privacy filters, and visibility.
        </p>
      </div>

      {/* Active Resident Details Card */}
      {activeResident ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-teal-800 text-white flex items-center justify-center font-bold text-lg shadow-xs">
                {activeResident.displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">{activeResident.displayName}</h2>
                  <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold">
                    Active Profile
                  </span>
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span>{activeResident.block} • Flat {activeResident.flatNumber}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
            <div className="font-semibold text-slate-700">Prototype Ownership Rule:</div>
            <div>
              When logged in as this resident, you only view and manage your own complaints on the Resident Dashboard and My Complaints pages.
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
          No resident profile is currently active. Please select one below or create a new profile.
        </div>
      )}

      {/* Profile Switching / Multi-Profile Manager */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-700" />
            <h2 className="text-sm font-bold text-slate-900">
              All Resident Profiles ({residents.length})
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-800 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showAddForm ? 'Cancel' : 'Add Profile'}</span>
          </button>
        </div>

        {/* Add Resident Form */}
        {showAddForm && (
          <form onSubmit={handleCreate} className="p-4 bg-teal-50/50 rounded-xl border border-teal-200 space-y-3">
            <h3 className="text-xs font-bold text-teal-950 uppercase tracking-wider">
              Create New Resident Profile for Testing
            </h3>

            {formError && (
              <div className="text-xs text-red-600 font-medium">{formError}</div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Maya Patel"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Building or Block</label>
                <select
                  value={block}
                  onChange={(e) => setBlock(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none bg-white"
                >
                  {settings.blocks.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Flat / House #</label>
                <input
                  type="text"
                  value={flat}
                  onChange={(e) => setFlat(e.target.value)}
                  placeholder="e.g. 501"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-teal-800 hover:bg-teal-700 text-white font-bold rounded-lg text-xs"
              >
                Save Profile
              </button>
            </div>
          </form>
        )}

        {/* Profile List */}
        {residents.length === 0 ? (
          <div className="text-xs text-slate-500 py-4 text-center italic">
            No resident profiles have been created yet. Click &quot;Add Profile&quot; above.
          </div>
        ) : (
          <div className="space-y-2">
            {residents.map((r) => {
              const isCurrent = activeResident?.id === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => handleSwitchProfile(r.id)}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                    isCurrent
                      ? 'border-teal-600 bg-teal-50/50 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/40 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                      isCurrent ? 'bg-teal-800 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {r.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{r.displayName}</div>
                      <div className="text-[11px] text-slate-500">
                        {r.block} • Flat {r.flatNumber}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isCurrent ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-teal-800 bg-teal-100/70 px-2 py-0.5 rounded-full">
                        <Check className="w-3.5 h-3.5" />
                        <span>Active</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSwitchProfile(r.id);
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-teal-800 hover:bg-slate-200 rounded"
                      >
                        Switch to this
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
