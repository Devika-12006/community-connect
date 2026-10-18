import React, { useState, useEffect } from 'react';
import { repository } from '../../db/repository';
import { contactService } from '../../services/contactService';
import type { Contact, Organization, ComplaintCategory } from '../../types';
import {
  Users,
  Plus,
  Upload,
  Download,
  Search,
  Filter,
  ShieldCheck,
  ShieldAlert,
  Edit,
  Trash2,
  Phone,
  Mail,
  Building2,
  X,
  FileSpreadsheet,
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

export const ContactDirectoryPage: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('org-rwa-1');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ComplaintCategory | 'All'>('All');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [activeOnly, setActiveOnly] = useState(false);

  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Partial<Contact> | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // CSV Import Modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);

  useEffect(() => {
    loadOrganizations();
  }, []);

  useEffect(() => {
    if (selectedOrgId) {
      loadContacts();
    }
  }, [selectedOrgId, searchTerm, selectedCategory, verifiedOnly, activeOnly]);

  const loadOrganizations = async () => {
    const orgs = await repository.getOrganizations();
    setOrganizations(orgs);
    if (orgs.length > 0 && !selectedOrgId) {
      setSelectedOrgId(orgs[0].id);
    }
  };

  const loadContacts = async () => {
    setLoading(true);
    try {
      const list = await contactService.getContacts(selectedOrgId, {
        category: selectedCategory,
        verifiedOnly,
        activeOnly,
        searchTerm,
      });
      setContacts(list);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVerified = async (contact: Contact) => {
    try {
      await contactService.toggleVerification(contact.id, 'Manager');
      await loadContacts();
    } catch (err: any) {
      alert(err.message || 'Error updating contact');
    }
  };

  const handleToggleActive = async (contact: Contact) => {
    try {
      await contactService.toggleActive(contact.id, 'Manager');
      await loadContacts();
    } catch (err: any) {
      alert(err.message || 'Error updating contact');
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (confirm('Are you sure you want to remove this contact?')) {
      await repository.deleteContact(id);
      await loadContacts();
    }
  };

  const handleOpenAdd = () => {
    setEditingContact({
      organizationId: selectedOrgId,
      name: '',
      role: '',
      department: '',
      phoneNumber: '',
      email: '',
      categories: ['Common-Area Electrical'],
      serviceAreas: ['Block A', 'Block B', 'Common Grounds'],
      verified: true,
      active: true,
      notes: '',
    });
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const handleOpenEdit = (contact: Contact) => {
    setEditingContact({ ...contact });
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact) return;
    setFormError(null);

    try {
      await contactService.saveContact({
        ...(editingContact as any),
        organizationId: selectedOrgId,
      });
      setIsEditModalOpen(false);
      setEditingContact(null);
      await loadContacts();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save contact.');
    }
  };

  const handleExportCSV = () => {
    const csv = contactService.exportToCSV(contacts);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `verified_contacts_${selectedOrgId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSampleCSV = () => {
    const sample = `name,role,department,phoneNumber,email,categories,serviceAreas,verified,active,notes\n"Kavita Reddy","Plumber Technician","Water & Sanitation","+919876543230","kavita@greenmeadows.org","Water Leakage;Drainage","Block A;Block C","true","true","Handles booster pumps and terrace tanks"`;
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample_contacts_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = async () => {
    if (!csvContent.trim()) return;
    const result = await contactService.importFromCSV(selectedOrgId, csvContent, 'Manager');
    setImportResult({ imported: result.importedCount, errors: result.errors });
    if (result.importedCount > 0) {
      await loadContacts();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Verified Directory
            </span>
            <span className="text-xs text-slate-400">Total: {contacts.length}</span>
          </div>
          <h1 className="text-xl font-bold text-slate-800">Verified Contact Directory</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Maintenance personnel, municipal nodal officers, and contractors eligible for AI routing.
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
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      {/* Organization and Filters Bar */}
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
                placeholder="Search by name, phone, role..."
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

          <label className="flex items-center gap-1.5 text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
              className="rounded text-teal-600 focus:ring-teal-500"
            />
            <span>Verified only</span>
          </label>

          <label className="flex items-center gap-1.5 text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="rounded text-teal-600 focus:ring-teal-500"
            />
            <span>Active only</span>
          </label>
        </div>
      </div>

      {/* Contacts List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading contacts...</div>
        ) : contacts.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">No contacts found</p>
            <p className="mt-1">Try adjusting your filters or click "Add Contact" above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="p-3 sm:px-4">Name & Role</th>
                  <th className="p-3 sm:px-4">Department</th>
                  <th className="p-3 sm:px-4">Contact Details</th>
                  <th className="p-3 sm:px-4">Issue Categories</th>
                  <th className="p-3 sm:px-4">Service Areas</th>
                  <th className="p-3 sm:px-4">Verified</th>
                  <th className="p-3 sm:px-4">Active</th>
                  <th className="p-3 sm:px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 sm:px-4">
                      <div className="font-bold text-slate-800">{c.name}</div>
                      <div className="text-[11px] text-slate-500">{c.role}</div>
                    </td>
                    <td className="p-3 sm:px-4 text-slate-600">{c.department}</td>
                    <td className="p-3 sm:px-4 font-mono text-slate-700">
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{c.phoneNumber}</span>
                      </div>
                      {c.email && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Mail className="w-3 h-3" />
                          <span>{c.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3 sm:px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {c.categories.map((cat, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 sm:px-4 text-slate-600">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {c.serviceAreas.map((area, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-teal-50 text-teal-800 border border-teal-200"
                          >
                            {area}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 sm:px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleVerified(c)}
                        title="Click to toggle verification"
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                          c.verified
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {c.verified ? (
                          <>
                            <ShieldCheck className="w-3 h-3 text-emerald-600" /> Verified
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="w-3 h-3 text-amber-600" /> Unverified
                          </>
                        )}
                      </button>
                    </td>
                    <td className="p-3 sm:px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(c)}
                        title="Click to toggle active status"
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                          c.active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {c.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="p-3 sm:px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(c)}
                          className="p-1 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded cursor-pointer"
                          title="Edit contact"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteContact(c.id)}
                          className="p-1 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer"
                          title="Delete contact"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Contact Modal */}
      {isEditModalOpen && editingContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-800">
                {editingContact.id ? 'Edit Contact' : 'Add New Verified Contact'}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
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

            <form onSubmit={handleSaveContact} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editingContact.name || ''}
                  onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 focus:outline-teal-600 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Role / Designation *</label>
                  <input
                    type="text"
                    required
                    value={editingContact.role || ''}
                    onChange={(e) => setEditingContact({ ...editingContact, role: e.target.value })}
                    placeholder="e.g. Lead Electrician"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 focus:outline-teal-600 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Department</label>
                  <input
                    type="text"
                    value={editingContact.department || ''}
                    onChange={(e) => setEditingContact({ ...editingContact, department: e.target.value })}
                    placeholder="e.g. Electrical Maintenance"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 focus:outline-teal-600 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={editingContact.phoneNumber || ''}
                    onChange={(e) => setEditingContact({ ...editingContact, phoneNumber: e.target.value })}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 focus:outline-teal-600 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={editingContact.email || ''}
                    onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value })}
                    placeholder="e.g. ramesh@society.com"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 focus:outline-teal-600 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Assigned Categories</label>
                <div className="grid grid-cols-2 gap-1.5 p-2 bg-slate-50 rounded-lg border border-slate-200">
                  {CATEGORY_OPTIONS.map((cat) => {
                    const checked = (editingContact.categories || []).includes(cat);
                    return (
                      <label key={cat} className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const current = editingContact.categories || [];
                            const updated = e.target.checked
                              ? [...current, cat]
                              : current.filter((c) => c !== cat);
                            setEditingContact({ ...editingContact, categories: updated });
                          }}
                          className="rounded text-teal-600"
                        />
                        <span>{cat}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Service Areas (comma-separated)
                </label>
                <input
                  type="text"
                  value={(editingContact.serviceAreas || []).join(', ')}
                  onChange={(e) =>
                    setEditingContact({
                      ...editingContact,
                      serviceAreas: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  placeholder="e.g. Block A, Block B, Common Grounds"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 focus:outline-teal-600 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingContact.verified ?? true}
                    onChange={(e) => setEditingContact({ ...editingContact, verified: e.target.checked })}
                    className="rounded text-teal-600"
                  />
                  <span className="font-semibold text-slate-700">Verified Contact (Eligible for AI)</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingContact.active ?? true}
                    onChange={(e) => setEditingContact({ ...editingContact, active: e.target.checked })}
                    className="rounded text-teal-600"
                  />
                  <span className="font-semibold text-slate-700">Active Status</span>
                </label>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Notes / Specialization</label>
                <textarea
                  rows={2}
                  value={editingContact.notes || ''}
                  onChange={(e) => setEditingContact({ ...editingContact, notes: e.target.value })}
                  placeholder="Any details on shift timings or specific equipment handled..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 focus:outline-teal-600 focus:bg-white"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold cursor-pointer"
                >
                  Save Contact
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
                <h3 className="text-base font-bold text-slate-800">Import Contacts CSV</h3>
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
              Paste CSV contents below or download our sample CSV template for the expected columns (name, role, department, phoneNumber, email, categories, serviceAreas, verified, active, notes).
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
              placeholder={`name,role,department,phoneNumber,email,categories,serviceAreas,verified,active,notes\n"Kavita Reddy","Plumber Technician","Water & Sanitation","+919876543230","kavita@greenmeadows.org","Water Leakage","Block A;Block C","true","true","Handles booster pumps"`}
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
                  Successfully imported: {importResult.imported} contacts
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
                Import Contacts
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
