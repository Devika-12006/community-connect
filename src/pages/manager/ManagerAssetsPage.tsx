import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { repository } from '../../db/repository';
import { useApp } from '../../context/AppContext';
import type { Asset, ComplaintCategory } from '../../types';
import { COMPLAINT_CATEGORIES } from '../../types';
import { Modal } from '../../components/common/Modal';
import {
  Layers,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Edit2,
  AlertCircle,
  FileText,
  Activity,
} from 'lucide-react';

export const ManagerAssetsPage: React.FC = () => {
  const { settings, complaints } = useApp();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [buildingFilter, setBuildingFilter] = useState('ALL');
  const [conditionFilter, setConditionFilter] = useState('ALL');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [selectedAssetForDetail, setSelectedAssetForDetail] = useState<Asset | null>(null);

  // Form State
  const [assetCode, setAssetCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ComplaintCategory>('Common-Area Electrical');
  const [building, setBuilding] = useState(settings.blocks[0] || 'Block A');
  const [location, setLocation] = useState('');
  const [criticality, setCriticality] = useState<number>(3);
  const [condition, setCondition] = useState<Asset['condition']>('Operational');
  const [frequencyDays, setFrequencyDays] = useState<number>(30);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await repository.getAssets({
        search,
        category: categoryFilter,
        building: buildingFilter,
        activeOnly: false,
      });
      setAssets(data);
    } catch (err) {
      console.error('Failed to load assets:', err);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, buildingFilter]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const filteredAssets = useMemo(() => {
    if (conditionFilter === 'ALL') return assets;
    return assets.filter((a) => a.condition === conditionFilter);
  }, [assets, conditionFilter]);

  // Asset complaint statistics
  const getAssetStats = (assetId: string) => {
    const assetComplaints = complaints.filter((c) => c.assetId === assetId);
    const active = assetComplaints.filter((c) => c.status !== 'Closed' && c.status !== 'Rejected').length;
    const resolved = assetComplaints.filter((c) => c.status === 'Resolved' || c.status === 'Closed').length;
    return { total: assetComplaints.length, active, resolved };
  };

  const handleOpenAdd = () => {
    const nextNum = String(assets.length + 1).padStart(2, '0');
    setAssetCode(`AST-EQ-${nextNum}`);
    setName('');
    setCategory('Common-Area Electrical');
    setBuilding(settings.blocks[0] || 'Block A');
    setLocation('');
    setCriticality(3);
    setCondition('Operational');
    setFrequencyDays(30);
    setNotes('');
    setFormError('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (a: Asset) => {
    setEditingAsset(a);
    setAssetCode(a.assetCode);
    setName(a.name);
    setCategory(a.category);
    setBuilding(a.building);
    setLocation(a.location);
    setCriticality(a.criticality);
    setCondition(a.condition);
    setFrequencyDays(a.frequencyDays || 30);
    setNotes(a.notes || '');
    setFormError('');
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetCode.trim() || !name.trim() || !location.trim()) {
      setFormError('Please enter an Asset Code, Name, and Location.');
      return;
    }

    try {
      const newAsset: Asset = {
        id: crypto.randomUUID(),
        assetCode: assetCode.trim().toUpperCase(),
        name: name.trim(),
        category,
        building,
        location: location.trim(),
        criticality,
        condition,
        frequencyDays,
        notes: notes.trim() || undefined,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await repository.saveAsset(newAsset);
      setShowAddModal(false);
      await loadAssets();
    } catch {
      setFormError('Failed to create asset. Verify the Asset Code is unique.');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;
    if (!name.trim() || !location.trim()) {
      setFormError('Please fill in all required fields.');
      return;
    }

    try {
      const updated: Asset = {
        ...editingAsset,
        name: name.trim(),
        category,
        building,
        location: location.trim(),
        criticality,
        condition,
        frequencyDays,
        notes: notes.trim() || undefined,
        updatedAt: new Date().toISOString(),
      };
      await repository.saveAsset(updated);
      setEditingAsset(null);
      await loadAssets();
    } catch {
      setFormError('Failed to update asset.');
    }
  };

  const handleToggleActive = async (asset: Asset) => {
    const updated: Asset = {
      ...asset,
      active: !asset.active,
      updatedAt: new Date().toISOString(),
    };
    await repository.saveAsset(updated);
    await loadAssets();
  };

  const getConditionBadge = (c: Asset['condition']) => {
    switch (c) {
      case 'Operational':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Operational
          </span>
        );
      case 'Degraded':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3" />
            Degraded Performance
          </span>
        );
      case 'Critical Failure':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3 h-3" />
            Critical Failure
          </span>
        );
      case 'Maintenance Due':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3" />
            Maintenance Due
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <Layers className="w-3 h-3" />
              Manual Search & Inventory
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Community Asset Registry
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Centrally manage facility infrastructure, track condition histories, and bind reports to verified physical equipment.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Register New Asset</span>
        </button>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Total Assets</span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{assets.length}</div>
          <span className="text-[11px] text-slate-400">Tracked across estate</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Operational</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">
            {assets.filter((a) => a.condition === 'Operational').length}
          </div>
          <span className="text-[11px] text-slate-400">100% capacity</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Degraded / Attention</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700">
            {assets.filter((a) => a.condition === 'Degraded' || a.condition === 'Maintenance Due').length}
          </div>
          <span className="text-[11px] text-slate-400">Requires technician check</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Critical Failures</span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-700">
            {assets.filter((a) => a.condition === 'Critical Failure').length}
          </div>
          <span className="text-[11px] text-slate-400">Immediate priority</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by asset code (e.g. AST-ELEV-01), equipment name, or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium"
          >
            <option value="ALL">All Categories</option>
            {COMPLAINT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={buildingFilter}
            onChange={(e) => setBuildingFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium"
          >
            <option value="ALL">All Buildings</option>
            {settings.blocks.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium"
          >
            <option value="ALL">All Conditions</option>
            <option value="Operational">Operational</option>
            <option value="Degraded">Degraded</option>
            <option value="Maintenance Due">Maintenance Due</option>
            <option value="Critical Failure">Critical Failure</option>
          </select>
        </div>
      </div>

      {/* Asset Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-500">Loading asset inventory...</div>
        ) : filteredAssets.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500">
            No community assets match the selected filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Asset Code</th>
                  <th className="py-3 px-4">Name & Description</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Building & Location</th>
                  <th className="py-3 px-4 text-center">Criticality</th>
                  <th className="py-3 px-4">Condition</th>
                  <th className="py-3 px-4 text-center">Complaints</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssets.map((asset) => {
                  const stats = getAssetStats(asset.id);
                  return (
                    <tr key={asset.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-700 whitespace-nowrap">
                        {asset.assetCode}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{asset.name}</div>
                        {asset.notes && (
                          <div className="text-[11px] text-slate-500 truncate max-w-xs">{asset.notes}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
                          {asset.category}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-700">{asset.building}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">{asset.location}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            asset.criticality >= 4
                              ? 'bg-rose-100 text-rose-800'
                              : asset.criticality === 3
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {asset.criticality}/5
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">{getConditionBadge(asset.condition)}</td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedAssetForDetail(asset)}
                          className="hover:underline cursor-pointer"
                        >
                          {stats.active > 0 ? (
                            <span className="font-bold text-amber-600">{stats.active} open</span>
                          ) : (
                            <span className="text-slate-400 font-medium">0 active</span>
                          )}
                          <span className="text-slate-400 text-[10px] ml-1">({stats.total} total)</span>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(asset)}
                          className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Asset Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(asset)}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            asset.active
                              ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              : 'text-rose-600 bg-rose-50'
                          }`}
                          title={asset.active ? 'Deactivate Asset' : 'Reactivate Asset'}
                        >
                          <Activity className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Asset Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Register Community Asset" maxWidth="md">
        <form onSubmit={handleSaveAdd} className="space-y-4">
          {formError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Asset Code *</label>
              <input
                type="text"
                value={assetCode}
                onChange={(e) => setAssetCode(e.target.value.toUpperCase())}
                placeholder="e.g. AST-ELEV-03"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Asset Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Secondary Water Pump B"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
              >
                {COMPLAINT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Building / Block *</label>
              <select
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
              >
                {settings.blocks.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Exact Location / Placement *</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Basement 1 Pump Room - Station B"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Criticality (1-5)</label>
              <select
                value={criticality}
                onChange={(e) => setCriticality(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
              >
                <option value={1}>1 - Low Impact</option>
                <option value={2}>2 - Minor</option>
                <option value={3}>3 - Moderate</option>
                <option value={4}>4 - High Essential</option>
                <option value={5}>5 - Critical Safety</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Current Condition</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as Asset['condition'])}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
              >
                <option value="Operational">Operational</option>
                <option value="Degraded">Degraded</option>
                <option value="Maintenance Due">Maintenance Due</option>
                <option value="Critical Failure">Critical Failure</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Service Cadence (Days)</label>
              <input
                type="number"
                min={7}
                max={365}
                value={frequencyDays}
                onChange={(e) => setFrequencyDays(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Technical Notes / Specs</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Serial numbers, vendor contact, filter model, warranty expiration..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
            >
              Save Asset
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Asset Modal */}
      <Modal isOpen={!!editingAsset} onClose={() => setEditingAsset(null)} title={`Edit Asset: ${editingAsset?.assetCode}`} maxWidth="md">
        <form onSubmit={handleSaveEdit} className="space-y-4">
          {formError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Asset Code</label>
              <input
                type="text"
                value={assetCode}
                disabled
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 font-mono text-slate-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Asset Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
              >
                {COMPLAINT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Building / Block *</label>
              <select
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
              >
                {settings.blocks.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Location *</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Criticality</label>
              <select
                value={criticality}
                onChange={(e) => setCriticality(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
              >
                <option value={1}>1 - Low Impact</option>
                <option value={2}>2 - Minor</option>
                <option value={3}>3 - Moderate</option>
                <option value={4}>4 - High Essential</option>
                <option value={5}>5 - Critical Safety</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Condition</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as Asset['condition'])}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
              >
                <option value="Operational">Operational</option>
                <option value="Degraded">Degraded</option>
                <option value="Maintenance Due">Maintenance Due</option>
                <option value="Critical Failure">Critical Failure</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Frequency (Days)</label>
              <input
                type="number"
                value={frequencyDays}
                onChange={(e) => setFrequencyDays(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Technical Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setEditingAsset(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
            >
              Update Asset
            </button>
          </div>
        </form>
      </Modal>

      {/* Asset Detail & Associated Complaints Modal */}
      <Modal
        isOpen={!!selectedAssetForDetail}
        onClose={() => setSelectedAssetForDetail(null)}
        title={`Asset Profile: ${selectedAssetForDetail?.assetCode} — ${selectedAssetForDetail?.name}`}
        maxWidth="lg"
      >
        {selectedAssetForDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">CATEGORY</span>
                <span className="font-bold text-slate-800">{selectedAssetForDetail.category}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">LOCATION</span>
                <span className="font-bold text-slate-800">{selectedAssetForDetail.building} ({selectedAssetForDetail.location})</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">CRITICALITY</span>
                <span className="font-bold text-slate-800">{selectedAssetForDetail.criticality}/5 scale</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">CONDITION</span>
                <div>{getConditionBadge(selectedAssetForDetail.condition)}</div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                Associated Maintenance Complaints ({complaints.filter((c) => c.assetId === selectedAssetForDetail.id).length})
              </h4>

              {complaints.filter((c) => c.assetId === selectedAssetForDetail.id).length === 0 ? (
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                  No maintenance complaints have been logged on this piece of equipment yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {complaints
                    .filter((c) => c.assetId === selectedAssetForDetail.id)
                    .map((comp) => (
                      <div
                        key={comp.id}
                        className="p-3 rounded-lg border border-slate-200 bg-white hover:border-blue-400 transition-colors flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-blue-700">{comp.reference}</span>
                            <span className="font-semibold text-slate-800">{comp.title}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Reported by {comp.residentName} on {new Date(comp.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {comp.priority}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            {comp.status}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAssetForDetail(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
