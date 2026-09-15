import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { repository } from '../../db/repository';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_STATUSES,
} from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PriorityBadge } from '../../components/common/PriorityBadge';
import {
  Search,
  ArrowUpDown,
  PlusCircle,
  FileQuestion,
  Image as ImageIcon,
  MapPin,
  Calendar,
} from 'lucide-react';

const ComplaintThumbnail: React.FC<{ imageId?: string }> = ({ imageId }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    if (imageId) {
      repository.getImage(imageId).then((asset) => {
        if (asset && active) {
          objectUrl = URL.createObjectURL(asset.blob);
          setUrl(objectUrl);
        }
      });
    }

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageId]);

  if (!url) {
    return (
      <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-300 shrink-0">
        <ImageIcon className="w-6 h-6" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt="Complaint thumbnail"
      className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
    />
  );
};

export const MyComplaintsPage: React.FC = () => {
  const { activeResident, complaints } = useApp();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  if (!activeResident) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center">
        <h2 className="text-lg font-bold text-slate-900 mb-2">Resident Profile Required</h2>
        <p className="text-xs text-slate-600 mb-4">
          Please select or create a resident profile to view your filed complaints.
        </p>
        <Link
          to="/resident/profile"
          className="px-4 py-2 bg-teal-800 text-white rounded-lg text-xs font-bold"
        >
          Open Resident Setup
        </Link>
      </div>
    );
  }

  // Filter complaints strictly owned by active resident
  const myComplaints = complaints.filter((c) => c.residentId === activeResident.id);

  // Apply search and filters
  const filtered = myComplaints
    .filter((c) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = c.title.toLowerCase().includes(q);
        const matchesRef = c.reference.toLowerCase().includes(q);
        const matchesDesc = c.description.toLowerCase().includes(q);
        if (!matchesTitle && !matchesRef && !matchesDesc) return false;
      }
      if (selectedCategory !== 'ALL' && c.category !== selectedCategory) {
        return false;
      }
      if (selectedStatus !== 'ALL' && c.status !== selectedStatus) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">My Complaints</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Showing records filed under {activeResident.displayName} ({activeResident.block}, Flat {activeResident.flatNumber})
          </p>
        </div>

        <Link
          to="/resident/report"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-800 hover:bg-teal-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-all shrink-0 cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Report New Issue</span>
        </Link>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Title or ID..."
              className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 focus:outline-none"
            />
          </div>

          {/* Category Filter */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 focus:outline-none bg-white"
            >
              <option value="ALL">All Categories</option>
              {COMPLAINT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 focus:outline-none bg-white"
            >
              <option value="ALL">All Statuses</option>
              {COMPLAINT_STATUSES.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* Sort Order */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))}
              className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl hover:bg-slate-50 flex items-center justify-between text-slate-700 font-semibold"
            >
              <span className="flex items-center gap-1.5">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                <span>Sort: {sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}</span>
              </span>
            </button>
          </div>
        </div>

        {(searchQuery || selectedCategory !== 'ALL' || selectedStatus !== 'ALL') && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs text-slate-500">
            <span>Showing {filtered.length} of {myComplaints.length} complaints</span>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('ALL');
                setSelectedStatus('ALL');
              }}
              className="text-teal-700 font-bold hover:underline text-[11px]"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Complaints List or Empty States */}
      {myComplaints.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-800 flex items-center justify-center mx-auto mb-4 border border-teal-100">
            <FileQuestion className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-slate-900 mb-1">
            No complaints found
          </h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
            You have not submitted any complaints yet. Use the button below to report an issue.
          </p>
          <Link
            to="/resident/report"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-800 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Report an Issue</span>
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
          <p className="text-sm font-semibold text-slate-700 mb-1">No matching complaints found</p>
          <p className="text-xs text-slate-500 mb-4">Try adjusting your search criteria or category filter.</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('ALL');
              setSelectedStatus('ALL');
            }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div
              key={c.id}
              onClick={() => navigate(`/resident/complaints/${c.id}`)}
              className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 hover:border-teal-700/50 hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between"
            >
              <div className="flex gap-4 items-start flex-1 min-w-0">
                <ComplaintThumbnail imageId={c.originalImageIds[0]} />

                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {c.reference}
                    </span>
                    <span className="text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                      {c.category}
                    </span>
                    <PriorityBadge priority={c.priority} />
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                    {c.title}
                  </h3>

                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1 truncate">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{c.block} • {c.specificLocation}</span>
                    </span>

                    <span className="flex items-center gap-1 shrink-0">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {new Date(c.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto gap-2 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100 shrink-0">
                <StatusBadge status={c.status} size="sm" />
                <span className="text-xs font-bold text-teal-800 sm:hover:underline">
                  View Details &rarr;
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
