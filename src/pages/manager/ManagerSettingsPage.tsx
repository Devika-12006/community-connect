import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Trash2,
  Plus,
  RotateCcw,
  AlertTriangle,
  Check,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';

export const ManagerSettingsPage: React.FC = () => {
  const { settings, updateSettings, resetPrototypeData } = useApp();

  const [communityName, setCommunityName] = useState(settings.name);
  const [address, setAddress] = useState(settings.address);
  const [blocks, setBlocks] = useState<string[]>([...settings.blocks]);
  const [newBlockName, setNewBlockName] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState(settings.geminiApiKey || '');

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string | null>(null);

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

  const handleTestApiKey = async () => {
    if (!geminiApiKey.trim()) {
      setTestStatus('error');
      setTestMessage('Please enter an API key to test.');
      return;
    }

    setTestStatus('testing');
    setTestMessage('Verifying Gemini API key...');

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash?key=${geminiApiKey.trim()}`
      );
      if (res.ok) {
        setTestStatus('success');
        setTestMessage('Connected! Gemini 1.5 Flash is ready for visual image verification.');
      } else {
        const err = await res.json().catch(() => ({}));
        setTestStatus('error');
        setTestMessage(`API key check failed: ${err.error?.message || res.statusText}`);
      }
    } catch (e: any) {
      setTestStatus('error');
      setTestMessage(`Connection error: ${e?.message || 'Failed to reach API endpoint'}`);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!communityName.trim()) return;

    await updateSettings({
      ...settings,
      name: communityName.trim(),
      address: address.trim(),
      blocks,
      geminiApiKey: geminiApiKey.trim() || undefined,
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

      {/* Vision AI Image Verification Configuration Card */}
      <div className="bg-white rounded-2xl border border-teal-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-teal-100 pb-2.5">
          <div className="flex items-center gap-2 text-teal-900 font-bold text-sm">
            <Sparkles className="w-5 h-5 text-teal-700" />
            <span>Automated Visual AI Verification (Google Gemini)</span>
          </div>

          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            geminiApiKey.trim()
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              : 'bg-slate-100 text-slate-600 border border-slate-200'
          }`}>
            {geminiApiKey.trim() ? 'Vision AI Configured' : 'Standby / Offline Mode'}
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Configure an optional Google Gemini API key to enable real AI image classification. When enabled, resident photos are visually evaluated against maintenance categories (Garbage, Potholes, Drainage, Water Leakage, Streetlights) and ambiguous photos return <em>Uncertain</em>. When unconfigured, the app falls back transparently to local perceptual hashing and quality checks without fabricating AI results.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Gemini API Key
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none font-mono"
              />
              <button
                type="button"
                onClick={handleTestApiKey}
                disabled={testStatus === 'testing' || !geminiApiKey.trim()}
                className="px-3.5 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {testStatus === 'testing' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Test Connection</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Stored securely in your local IndexedDB storage. You can also set <code className="bg-slate-100 px-1 py-0.5 rounded">VITE_GEMINI_API_KEY</code> in an <code className="bg-slate-100 px-1 py-0.5 rounded">.env</code> file.
            </p>
          </div>

          {testMessage && (
            <div className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
              testStatus === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : testStatus === 'error'
                ? 'bg-rose-50 text-rose-900 border border-rose-200'
                : 'bg-teal-50 text-teal-900 border border-teal-200'
            }`}>
              {testStatus === 'success' ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{testMessage}</span>
            </div>
          )}
        </div>
      </div>

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
