import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_STATUSES,
  type Complaint,
} from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import {
  MapPin,
  Filter,
  Shield,
  Compass,
} from 'lucide-react';

export const CommunityMapPage: React.FC = () => {
  const { complaints, settings } = useApp();

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);

  // Filter complaints
  const filtered = useMemo(() => {
    return complaints.filter((c) => {
      if (selectedCategory !== 'ALL' && c.category !== selectedCategory) return false;
      if (selectedStatus !== 'ALL' && c.status !== selectedStatus) return false;
      return true;
    });
  }, [complaints, selectedCategory, selectedStatus]);

  // Separate records with GPS coordinates vs without GPS coordinates
  const withCoordinates = useMemo(() => {
    return filtered.filter(
      (c) => typeof c.latitude === 'number' && typeof c.longitude === 'number'
    );
  }, [filtered]);

  // Convert lat/lng to local canvas SVG coordinate percentage relative to bounding box
  const getMarkerPosition = (lat: number, lng: number) => {
    if (withCoordinates.length <= 1) {
      return { x: 50, y: 50 };
    }
    const lats = withCoordinates.map((c) => c.latitude!);
    const lngs = withCoordinates.map((c) => c.longitude!);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latSpan = maxLat - minLat || 0.001;
    const lngSpan = maxLng - minLng || 0.001;

    // Normalizing between 15% and 85% to stay inside viewbox
    const x = 15 + ((lng - minLng) / lngSpan) * 70;
    const y = 85 - ((lat - minLat) / latSpan) * 70;
    return { x, y };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900">Community Maintenance Map</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Geographic and landmark overview of reported maintenance issues across {settings.name}.
        </p>
      </div>

      {/* Privacy Notice and Limitation Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-2xl flex items-start gap-2.5 text-xs text-teal-950">
          <Shield className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Resident Privacy Guarantee:</span> Community map markers and summaries strictly omit personal identities, flat numbers, contact details, private photos, and internal manager notes.
          </div>
        </div>
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-2.5 text-xs text-slate-700">
          <Compass className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Map Marker Limitation:</span> Only complaints with verified device GPS coordinates are pinned on the spatial map. Issues submitted with manual building and landmark descriptions are cataloged in the directory below.
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mr-2">
          <Filter className="w-4 h-4 text-teal-700" />
          <span>Filters:</span>
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-1 focus:ring-teal-700 focus:outline-none bg-white"
        >
          <option value="ALL">All Categories</option>
          {COMPLAINT_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-1 focus:ring-teal-700 focus:outline-none bg-white"
        >
          <option value="ALL">All Statuses</option>
          {COMPLAINT_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <span className="text-xs text-slate-500 ml-auto">
          {filtered.length} matching issue{filtered.length !== 1 ? 's' : ''} ({withCoordinates.length} with GPS pins)
        </span>
      </div>

      {/* Interactive Map Canvas / Schematic Visualizer */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-teal-700" />
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Community Spatial Layout & Marker Pins
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Urgent
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ml-2" /> Medium / High
            <span className="w-2.5 h-2.5 rounded-full bg-teal-600 ml-2" /> Low
          </div>
        </div>

        {withCoordinates.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs bg-slate-50/50">
            <MapPin className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <div className="font-semibold text-slate-700 mb-1">No reports with GPS coordinates</div>
            <p className="text-slate-500 max-w-sm mx-auto">
              Reports filed with browser geolocation enabled will appear pinned here. See the landmark location list below for all reported items.
            </p>
          </div>
        ) : (
          <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] bg-slate-900 overflow-hidden select-none">
            {/* Architectural Grid & Campus Layout Schematic */}
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#334155" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="#0f172a" />
              <rect width="100%" height="100%" fill="url(#grid)" opacity="0.6" />

              {/* Campus Roads and Paths */}
              <path
                d="M 50 150 Q 300 120 500 200 T 950 180"
                fill="none"
                stroke="#475569"
                strokeWidth="24"
                strokeLinecap="round"
                opacity="0.4"
              />
              <path
                d="M 250 50 L 250 350 M 650 60 L 650 360"
                fill="none"
                stroke="#475569"
                strokeWidth="16"
                strokeLinecap="round"
                opacity="0.3"
              />

              {/* Block Outlines */}
              {settings.blocks.map((blockName, i) => {
                const posX = 100 + (i % 3) * 280;
                const posY = 60 + Math.floor(i / 3) * 160;
                return (
                  <g key={blockName} transform={`translate(${posX}, ${posY})`}>
                    <rect
                      width="120"
                      height="80"
                      rx="8"
                      fill="#1e293b"
                      stroke="#334155"
                      strokeWidth="1.5"
                    />
                    <text
                      x="60"
                      y="45"
                      fill="#94a3b8"
                      fontSize="11"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {blockName}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Render Pins */}
            {withCoordinates.map((c) => {
              const { x, y } = getMarkerPosition(c.latitude!, c.longitude!);
              const pinColor =
                c.priority === 'Urgent'
                  ? 'bg-red-500 ring-red-300'
                  : c.priority === 'High' || c.priority === 'Medium'
                  ? 'bg-amber-500 ring-amber-300'
                  : 'bg-teal-500 ring-teal-300';

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedComplaint(c)}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  className="group absolute -translate-x-1/2 -translate-y-1/2 p-1.5 focus:outline-none cursor-pointer"
                  title={`${c.reference}: ${c.title}`}
                >
                  <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full ${pinColor} ring-4 text-white flex items-center justify-center font-bold text-[9px] shadow-lg transform group-hover:scale-125 transition-transform`}>
                    !
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover:block bg-slate-900/90 text-white text-[10px] font-semibold px-2 py-1 rounded shadow whitespace-nowrap z-10">
                    {c.reference} • {c.category}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Text Location List / Non-GPS Reports */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Reported Locations Directory
            </h2>
            <p className="text-xs text-slate-500">
              Includes all reports tagged by building block and landmark descriptions.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {filtered.length} Total
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No complaints match the selected filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelectedComplaint(c)}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-teal-700/50 bg-slate-50/40 hover:bg-white transition-all cursor-pointer space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-bold text-slate-800 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                      {c.reference}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-600">
                      {c.category}
                    </span>
                  </div>
                  <StatusBadge status={c.status} size="sm" />
                </div>

                <div className="text-xs font-bold text-slate-900 truncate">{c.title}</div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 text-teal-700 shrink-0" />
                    <span className="truncate">{c.block} • {c.specificLocation}</span>
                  </span>
                  {c.latitude && c.longitude ? (
                    <span className="text-teal-700 font-semibold shrink-0">GPS Pinned</span>
                  ) : (
                    <span className="text-slate-400 italic shrink-0">Landmark Only</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Privacy-Safe Complaint Summary Modal */}
      {selectedComplaint && (
        <Modal
          isOpen={!!selectedComplaint}
          onClose={() => setSelectedComplaint(null)}
          title={`Community Report: ${selectedComplaint.reference}`}
          maxWidth="sm"
        >
          <div className="space-y-3.5 text-xs text-slate-700">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                {selectedComplaint.reference}
              </span>
              <StatusBadge status={selectedComplaint.status} size="sm" />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Title & Category</span>
              <div className="text-sm font-bold text-slate-900">{selectedComplaint.title}</div>
              <div className="inline-block px-2 py-0.5 rounded bg-teal-50 text-teal-800 font-semibold text-[11px] border border-teal-100">
                {selectedComplaint.category}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Location Details</span>
              <div className="font-semibold text-slate-800">
                {selectedComplaint.block} • {selectedComplaint.specificLocation}
              </div>
              {selectedComplaint.latitude && selectedComplaint.longitude && (
                <div className="text-[11px] text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-teal-700" />
                  <span>GPS: {selectedComplaint.latitude.toFixed(5)}, {selectedComplaint.longitude.toFixed(5)}</span>
                </div>
              )}
            </div>

            <div className="p-2.5 bg-teal-50/50 rounded-xl border border-teal-100 text-[11px] text-slate-500">
              <Shield className="w-3.5 h-3.5 text-teal-700 inline mr-1" />
              Resident names, flat numbers, and private contact details are withheld for community privacy.
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedComplaint(null)}
                className="px-4 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold"
              >
                Close Summary
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
