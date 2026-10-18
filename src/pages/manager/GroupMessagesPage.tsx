import React, { useState, useEffect } from 'react';
import { repository } from '../../db/repository';
import { groupMessageService } from '../../services/groupMessageService';
import type { AuthorizedGroupMessage, Organization, ComplaintCategory } from '../../types';
import {
  MessageSquare,
  Plus,
  Upload,
  Download,
  Search,
  Filter,
  ShieldCheck,
  Building2,
  Trash2,
  Tag,
  MapPin,
  Calendar,
  FileSpreadsheet,
  X,
  Info,
} from 'lucide-react';

const CATEGORY_OPTIONS: ComplaintCategory[] = [
  'Water Leakage',
  'Streetlights',
  'Garbage',
  'Roads and Potholes',
  'Common-Area Electrical',
  'Drainage',
  'Other',
];

export const GroupMessagesPage: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('org-rwa-1');
  const [messages, setMessages] = useState<AuthorizedGroupMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ComplaintCategory | 'All'>('All');
  const [locationFilter, setLocationFilter] = useState('');

  // Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [sourceName, setSourceName] = useState('');
  const [sourceType, setSourceType] = useState('WhatsApp Community Broadcast');
  const [messageText, setMessageText] = useState('');
  const [categoryTag, setCategoryTag] = useState<ComplaintCategory>('Streetlights');
  const [locationTag, setLocationTag] = useState('');
  const [hasConsent, setHasConsent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // CSV Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);

  useEffect(() => {
    loadOrganizations();
  }, []);

  useEffect(() => {
    if (selectedOrgId) {
      loadMessages();
    }
  }, [selectedOrgId, searchTerm, selectedCategory, locationFilter]);

  const loadOrganizations = async () => {
    const orgs = await repository.getOrganizations();
    setOrganizations(orgs);
    if (orgs.length > 0 && !selectedOrgId) {
      setSelectedOrgId(orgs[0].id);
    }
  };

  const loadMessages = async () => {
    setLoading(true);
    try {
      const list = await groupMessageService.getMessages(selectedOrgId, {
        category: selectedCategory,
        location: locationFilter,
        searchTerm,
        permissionOnly: true,
      });
      setMessages(list);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMessage = async (id: string) => {
    if (confirm('Are you sure you want to delete this authorized notice record?')) {
      await groupMessageService.deleteMessage(id, 'Manager', selectedOrgId);
      await loadMessages();
    }
  };

  const handleSaveNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!hasConsent) {
      setFormError('You must confirm that this notice is an authorized official communication.');
      return;
    }

    try {
      await groupMessageService.saveMessage({
        organizationId: selectedOrgId,
        sourceName,
        sourceType,
        messageText,
        messageTimestamp: new Date().toISOString(),
        permissionStatus: 'Authorized',
        importedBy: 'Community Manager',
        categoryTag,
        locationTag: locationTag.trim() || undefined,
      });

      setIsAddModalOpen(false);
      setSourceName('');
      setMessageText('');
      setLocationTag('');
      setHasConsent(false);
      await loadMessages();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save notice.');
    }
  };

  const handleExportCSV = () => {
    const csv = groupMessageService.exportToCSV(messages);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `authorized_group_notices_${selectedOrgId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSampleCSV = () => {
    const sample = `sourceName,sourceType,messageText,messageTimestamp,permissionStatus,importedBy,categoryTag,locationTag\n"Green Meadows Security & Maintenance","Admin Notice","Notice: Terrace booster pump in Block C is under repair by Manoj Kumar until 4 PM.","2026-03-05T10:00:00.000Z","Authorized","Estate Manager","Water Leakage","Block C"`;
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample_group_notices_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = async () => {
    if (!csvContent.trim()) return;
    const result = await groupMessageService.importFromCSV(selectedOrgId, csvContent, 'Manager');
    setImportResult({ imported: result.importedCount, errors: result.errors });
    if (result.importedCount > 0) {
      await loadMessages();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Privacy Compliant
            </span>
            <span className="text-xs text-slate-400">Total: {messages.length}</span>
          </div>
          <h1 className="text-xl font-bold text-slate-800">Authorized Group Notices & Records</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Official community notices and maintenance updates cross-referenced by the AI agent for evidence.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setCsvContent('');
              setImportResult(null);
              setIsImportModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Notice Record</span>
          </button>
        </div>
      </div>

      {/* Compliance Notice Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-900">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold">Privacy & Ethical Data Ingestion Policy</div>
          <div className="text-amber-800 mt-0.5 leading-relaxed">
            Community Connect adheres to strict data privacy principles. The AI agent searches only curated records from official announcement channels, administrator broadcasts, or opted-in exports. Unauthorized WhatsApp group scraping or personal resident message extraction is strictly prohibited.
          </div>
        </div>
      </div>

      {/* Organization and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <Building2 className="w-4 h-4 text-teal-600" />
            <span className="font-semibold text-slate-700">Organization:</span>
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 font-medium focus:outline-teal-600"
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search notices, sources, keywords..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-teal-600 focus:bg-white"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500 font-medium">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as any)}
              className="bg-slate-50 border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-700"
            >
              <option value="All">All Categories</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500 font-medium">Location:</span>
            <input
              type="text"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              placeholder="e.g. Block B"
              className="bg-slate-50 border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-700 w-28"
            />
          </div>
        </div>
      </div>

      {/* Messages List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
            Loading authorized notices...
          </div>
        ) : messages.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
            <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">No authorized notices found</p>
            <p className="mt-1">Add notice records or import a CSV to equip the AI with contextual evidence.</p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all space-y-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-slate-800">{m.sourceName}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                    {m.sourceType}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> {m.permissionStatus}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteMessage(m.id)}
                  className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                  title="Delete notice"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Message Quote */}
              <div className="bg-slate-50 border-l-4 border-teal-600 p-3 rounded-r-lg text-xs sm:text-sm text-slate-700 italic leading-relaxed">
                "{m.messageText}"
              </div>

              {/* Tags & Meta footer */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  {m.categoryTag && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-50 text-teal-800 font-medium border border-teal-200">
                      <Tag className="w-3 h-3" /> {m.categoryTag}
                    </span>
                  )}
                  {m.locationTag && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium border border-slate-200">
                      <MapPin className="w-3 h-3" /> {m.locationTag}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {new Date(m.messageTimestamp).toLocaleDateString()} {new Date(m.messageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span>• Imported by: {m.importedBy}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Notice Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-800">Add Authorized Notice Record</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveNotice} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Source Name *</label>
                <input
                  type="text"
                  required
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  placeholder="e.g. Green Meadows Maintenance Broadcast"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 focus:outline-teal-600 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Source Type</label>
                  <select
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 focus:outline-teal-600"
                  >
                    <option value="WhatsApp Community Broadcast">WhatsApp Community Broadcast</option>
                    <option value="Official Admin Notice">Official Admin Notice</option>
                    <option value="Exported CSV">Exported CSV</option>
                    <option value="Municipal Ward Bulletin">Municipal Ward Bulletin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Category Tag</label>
                  <select
                    value={categoryTag}
                    onChange={(e) => setCategoryTag(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 focus:outline-teal-600"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Location Tag</label>
                <input
                  type="text"
                  value={locationTag}
                  onChange={(e) => setLocationTag(e.target.value)}
                  placeholder="e.g. Block B or Clubhouse"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 focus:outline-teal-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Notice / Message Text *</label>
                <textarea
                  rows={4}
                  required
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Paste the official notice text containing maintenance responsibilities or recent assignments..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 focus:outline-teal-600 focus:bg-white"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasConsent}
                    onChange={(e) => setHasConsent(e.target.checked)}
                    className="rounded text-teal-600 mt-0.5"
                  />
                  <span className="text-[11px] text-amber-900 font-medium">
                    I confirm that this notice is an authorized official community communication and has appropriate administrative permission for AI discovery.
                  </span>
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold cursor-pointer"
                >
                  Save Notice Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-800">Import Authorized Notices CSV</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Paste CSV contents below or download our sample template. Each record must specify permissionStatus as "Authorized".
            </p>

            <div className="flex justify-between items-center text-xs">
              <button
                type="button"
                onClick={handleDownloadSampleCSV}
                className="text-teal-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Sample Template</span>
              </button>
            </div>

            <textarea
              rows={6}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder={`sourceName,sourceType,messageText,messageTimestamp,permissionStatus,importedBy,categoryTag,locationTag\n"Green Meadows Noticeboard","Admin Notice","Notice text here...","2026-03-05T10:00:00.000Z","Authorized","Estate Manager","Water Leakage","Block C"`}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-[11px] focus:outline-teal-600 focus:bg-white"
            />

            {importResult && (
              <div
                className={`p-3 rounded-lg text-xs ${
                  importResult.imported > 0
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                    : 'bg-red-50 text-red-900 border border-red-200'
                }`}
              >
                <div className="font-bold">
                  Successfully imported: {importResult.imported} notice records
                </div>
                {importResult.errors.length > 0 && (
                  <ul className="list-disc pl-4 mt-1 text-[11px] space-y-0.5">
                    {importResult.errors.slice(0, 5).map((e, idx) => (
                      <li key={idx}>{e}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                disabled={!csvContent.trim()}
                onClick={handleImportCSV}
                className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs disabled:opacity-50 cursor-pointer"
              >
                Import Notices
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
