import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Trash2,
  Plus,
  RotateCcw,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';

export const ManagerSettingsPage: React.FC = () => {
  const { settings, updateSettings, resetPrototypeData } = useApp();

  const [communityName, setCommunityName] = useState(settings.name);
  const [address, setAddress] = useState(settings.address);
  const [blocks, setBlocks] = useState<string[]>([...settings.blocks]);
  const [newBlockName, setNewBlockName] = useState('');

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleAddBlock = () => {
    if (!newBlockName.trim()) return;
    if (blocks.includes(newBlockName.trim())) return;
    setBlocks([...blocks, newBlockName.trim()]);
    setNewBlockName('');
  };

  const handleRemoveBlock = (blockToRemove: string) => {
    if (blocks.length <= 1) {
      alert('You must have at least one block or building defined.');
      return;
    }
    setBlocks(blocks.filter((b) => b !== blockToRemove));
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!communityName.trim()) return;

    await updateSettings({
      ...settings,
      name: communityName.trim(),
      address: address.trim(),
      blocks,
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleConfirmReset = async () => {
    setIsResetting(true);
    try {
      await resetPrototypeData();
      setShowResetModal(false);
      setSaveSuccess(false);
      window.location.reload();
    } catch (err) {
      console.error('Reset error:', err);
      setIsResetting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900">Community Settings</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Configure community profile parameters, residential blocks, and prototype database options.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-700" />
          <span>Settings saved successfully.</span>
        </div>
      )}

      {/* Community Details Form */}
      <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
          Community Identification
        </h2>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Community Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={communityName}
            onChange={(e) => setCommunityName(e.target.value)}
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none"
            placeholder="e.g. Green Meadows Gated Community"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Community Address
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none"
            placeholder="e.g. 42 Palm Avenue, Sector 5"
          />
        </div>

        {/* Blocks or Buildings used in forms */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">
            Blocks & Buildings (Used in Resident Setup & Complaint Forms)
          </label>

          <div className="flex flex-wrap gap-2">
            {blocks.map((b) => (
              <span
                key={b}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700"
              >
                <span>{b}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveBlock(b)}
                  className="text-slate-400 hover:text-red-600 p-0.5"
                  aria-label={`Remove ${b}`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2 pt-2 max-w-sm">
            <input
              type="text"
              value={newBlockName}
              onChange={(e) => setNewBlockName(e.target.value)}
              placeholder="e.g. Tower E or Swimming Pool"
              className="flex-1 text-xs px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAddBlock}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Block</span>
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="submit"
            className="px-5 py-2.5 bg-teal-800 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
          >
            Save Community Settings
          </button>
        </div>
      </form>

      {/* Prototype Reset Card */}
      <div className="bg-white rounded-2xl border border-rose-200 p-5 sm:p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
          <AlertTriangle className="w-5 h-5" />
          <span>Reset Prototype Data</span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Need to test the complete user journey from scratch? Resetting clears all resident profiles, maintenance workers, complaint tickets, activity timeline logs, and uploaded image blobs from your local IndexedDB storage.
        </p>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset Prototype Data</span>
          </button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        title="Confirm Reset Prototype Data"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 leading-relaxed">
            <span className="font-bold block mb-1">Permanent Local Wipe:</span>
            This action removes all locally saved prototype records and uploaded images. You will start with an empty community instance (zero complaints, zero workers, zero resident profiles).
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={isResetting}
              onClick={() => setShowResetModal(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isResetting}
              onClick={handleConfirmReset}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold"
            >
              {isResetting ? 'Resetting...' : 'Yes, Reset Everything'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
