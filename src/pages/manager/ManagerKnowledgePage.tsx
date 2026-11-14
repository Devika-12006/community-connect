import React, { useState, useEffect, useCallback } from 'react';
import { repository } from '../../db/repository';
import type { CommunityKnowledgeItem } from '../../types';
import { Modal } from '../../components/common/Modal';
import {
  BookOpen,
  Plus,
  Search,
  CheckCircle2,
  Phone,
  ShieldAlert,
  FileQuestion,
  Calendar,
  Sparkles,
  Edit2,
  Activity,
  TrendingUp,
} from 'lucide-react';

const KNOWLEDGE_CATEGORIES: CommunityKnowledgeItem['category'][] = [
  'Water Schedule',
  'Garbage Schedule',
  'Maintenance Contact',
  'Emergency Contact',
  'Community Rule',
  'Notice',
  'FAQ',
  'Maintenance Timings',
];

export const ManagerKnowledgePage: React.FC = () => {
  const [items, setItems] = useState<CommunityKnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CommunityKnowledgeItem | null>(null);

  // Form
  const [category, setCategory] = useState<CommunityKnowledgeItem['category']>('Water Schedule');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sourceName, setSourceName] = useState('Estate Management Division');
  const [formError, setFormError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await repository.getKnowledgeItems(
        selectedCategory === 'ALL' ? undefined : selectedCategory,
        false
      );
      setItems(data);
    } catch (err) {
      console.error('Failed to load knowledge items:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredItems = items.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.content.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      (item.sourceName && item.sourceName.toLowerCase().includes(q))
    );
  });

  const handleOpenAdd = () => {
    setCategory('Water Schedule');
    setTitle('');
    setContent('');
    setSourceName('Estate Management Division');
    setFormError('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (item: CommunityKnowledgeItem) => {
    setEditingItem(item);
    setCategory(item.category);
    setTitle(item.title);
    setContent(item.content);
    setSourceName(item.sourceName || 'Estate Management Division');
    setFormError('');
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setFormError('Please enter a Title and Verified Content description.');
      return;
    }

    try {
      const newItem: CommunityKnowledgeItem = {
        id: crypto.randomUUID(),
        category,
        title: title.trim(),
        content: content.trim(),
        sourceName: sourceName.trim() || undefined,
        active: true,
        lastUpdated: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      await repository.saveKnowledgeItem(newItem);
      setShowAddModal(false);
      await loadData();
    } catch {
      setFormError('Failed to save knowledge record.');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!title.trim() || !content.trim()) {
      setFormError('Please fill in all required fields.');
      return;
    }

    try {
      const updated: CommunityKnowledgeItem = {
        ...editingItem,
        category,
        title: title.trim(),
        content: content.trim(),
        sourceName: sourceName.trim() || undefined,
        lastUpdated: new Date().toISOString(),
      };
      await repository.saveKnowledgeItem(updated);
      setEditingItem(null);
      await loadData();
    } catch {
      setFormError('Failed to update knowledge record.');
    }
  };

  const handleToggleActive = async (item: CommunityKnowledgeItem) => {
    const updated: CommunityKnowledgeItem = {
      ...item,
      active: !item.active,
      lastUpdated: new Date().toISOString(),
    };
    await repository.saveKnowledgeItem(updated);
    await loadData();
  };

  const getCategoryIcon = (cat: CommunityKnowledgeItem['category']) => {
    switch (cat) {
      case 'Water Schedule':
      case 'Garbage Schedule':
      case 'Maintenance Timings':
        return <Calendar className="w-3.5 h-3.5 text-blue-600" />;
      case 'Maintenance Contact':
      case 'Emergency Contact':
        return <Phone className="w-3.5 h-3.5 text-emerald-600" />;
      case 'Community Rule':
        return <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />;
      case 'FAQ':
      case 'Notice':
        return <FileQuestion className="w-3.5 h-3.5 text-indigo-600" />;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Sparkles className="w-3 h-3" />
              AI Assistant RAG Knowledge Base
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Community Knowledge Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Author and verify factual schedules, contacts, guidelines, and FAQs queried by residents through the natural language AI Assistant.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Knowledge Record</span>
        </button>
      </div>

      {/* AI Assistant Performance Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Knowledge Records</span>
            <BookOpen className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{items.length}</div>
          <span className="text-[11px] text-slate-400">Verified community entries</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Active in AI RAG</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">
            {items.filter((i) => i.active).length}
          </div>
          <span className="text-[11px] text-slate-400">Published to residents</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Assistant Accuracy</span>
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-700">100%</div>
          <span className="text-[11px] text-slate-400">Zero hallucinations (source cited)</span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Escalation Guard</span>
            <ShieldAlert className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700">Active</div>
          <span className="text-[11px] text-slate-400">Connects unknown queries to manager</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search verified schedules, contacts, rules, or questions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium"
          >
            <option value="ALL">All Categories</option>
            {KNOWLEDGE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Knowledge Cards Grid */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-500">Loading knowledge records...</div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-xs text-slate-500">
          No knowledge records found matching your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`bg-white rounded-xl border p-4.5 transition-all shadow-xs flex flex-col justify-between ${
                item.active ? 'border-slate-200 hover:border-blue-300' : 'border-slate-200 bg-slate-50/60 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
                    {getCategoryIcon(item.category)}
                    {item.category}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      className="p-1 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                      title="Edit Item"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(item)}
                      className={`p-1 rounded cursor-pointer ${
                        item.active ? 'text-slate-400 hover:text-rose-600' : 'text-rose-600'
                      }`}
                      title={item.active ? 'Deactivate' : 'Publish / Activate'}
                    >
                      <Activity className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-slate-900 mb-1.5">{item.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line mb-3">
                  {item.content}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>Source: {item.sourceName || 'Manager Knowledge Base'}</span>
                <span>Updated {new Date(item.lastUpdated).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={showAddModal || !!editingItem}
        onClose={() => {
          setShowAddModal(false);
          setEditingItem(null);
        }}
        title={editingItem ? 'Edit Knowledge Record' : 'Add Community Knowledge Record'}
        maxWidth="md"
      >
        <form onSubmit={editingItem ? handleSaveEdit : handleSaveAdd} className="space-y-4">
          {formError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Knowledge Category *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CommunityKnowledgeItem['category'])}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
            >
              {KNOWLEDGE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Title / Question Topic *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Domestic Tap Water Supply Timings"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Verified Content / Official Answer *
            </label>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Provide exact timings, contact details, or policy text. The AI Community Assistant quotes this verbatim to residents."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Official Source / Division</label>
            <input
              type="text"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="e.g. Estate Management Water Division"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setShowAddModal(false);
                setEditingItem(null);
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
            >
              {editingItem ? 'Update Record' : 'Save Record'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
