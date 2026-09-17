import React, { useEffect, useState } from 'react';
import { repository } from '../../db/repository';
import { X, ZoomIn, ImageOff, MapPin, ShieldCheck } from 'lucide-react';
import { formatCoordinates } from '../../lib/geoUtils';

interface ImageViewerProps {
  imageIds: string[];
  preferStamped?: boolean;
}

interface ImageRecordView {
  id: string;
  rawUrl: string;
  stampedUrl?: string;
  name: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  address?: string;
  timestamp?: string;
  isLiveCapture?: boolean;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ imageIds, preferStamped = true }) => {
  const [images, setImages] = useState<ImageRecordView[]>([]);
  const [activeImage, setActiveImage] = useState<ImageRecordView | null>(null);
  const [viewMode, setViewMode] = useState<'stamped' | 'raw'>('stamped');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];

    async function loadImages() {
      setLoading(true);
      const loaded: ImageRecordView[] = [];
      for (const id of imageIds) {
        const asset = await repository.getImage(id);
        if (asset) {
          const rawUrl = URL.createObjectURL(asset.blob);
          objectUrls.push(rawUrl);

          let stampedUrl: string | undefined;
          if (asset.stampedBlob) {
            stampedUrl = URL.createObjectURL(asset.stampedBlob);
            objectUrls.push(stampedUrl);
          }

          loaded.push({
            id: asset.id,
            rawUrl,
            stampedUrl,
            name: asset.originalName,
            latitude: asset.latitude,
            longitude: asset.longitude,
            accuracy: asset.accuracy,
            address: asset.address,
            timestamp: asset.clientCaptureTimestamp || asset.locationTimestamp || asset.createdAt,
            isLiveCapture: asset.isLiveCapture,
          });
        }
      }
      if (active) {
        setImages(loaded);
        setLoading(false);
      }
    }

    if (imageIds.length > 0) {
      loadImages();
    } else {
      setImages([]);
      setLoading(false);
    }

    return () => {
      active = false;
      objectUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [imageIds]);

  if (loading) {
    return <div className="text-xs text-slate-500 italic py-2">Loading photos...</div>;
  }

  if (images.length === 0) {
    return (
      <div className="flex items-center gap-2 p-3 text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
        <ImageOff className="w-4 h-4 text-slate-400" />
        <span>No photographs uploaded.</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2.5">
        {images.map((img) => {
          const displayUrl = preferStamped && img.stampedUrl ? img.stampedUrl : img.rawUrl;
          return (
            <button
              key={img.id}
              type="button"
              onClick={() => {
                setActiveImage(img);
                setViewMode(img.stampedUrl ? 'stamped' : 'raw');
              }}
              className="group relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 hover:border-teal-700 focus-visible:outline-2 focus-visible:outline-teal-700 transition-all cursor-pointer shadow-2xs"
            >
              <img src={displayUrl} alt={img.name} className="w-full h-full object-cover" />
              {img.stampedUrl && (
                <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-slate-900/80 text-teal-300 text-[9px] font-mono font-bold rounded shadow-xs">
                  GPS
                </span>
              )}
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                <ZoomIn className="w-5 h-5" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Lightbox Modal with Stamped / Raw toggle and Geolocation plaque */}
      {activeImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-xs"
          onClick={() => setActiveImage(null)}
          role="dialog"
        >
          <div
            className="relative max-w-4xl w-full max-h-[92vh] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Toolbar */}
            <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-white">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-400" />
                <span className="font-bold truncate max-w-xs">{activeImage.name}</span>
                {activeImage.isLiveCapture && (
                  <span className="px-2 py-0.5 rounded bg-teal-900/80 text-teal-300 font-mono text-[10px] font-bold">
                    Live Camera
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Toggle Stamped vs Raw */}
                {activeImage.stampedUrl && (
                  <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setViewMode('stamped')}
                      className={`px-2 py-1 rounded font-semibold transition-colors cursor-pointer ${
                        viewMode === 'stamped'
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Stamped Plaque
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('raw')}
                      className={`px-2 py-1 rounded font-semibold transition-colors cursor-pointer ${
                        viewMode === 'raw'
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Raw Sensor
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setActiveImage(null)}
                  className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                  aria-label="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Photo display */}
            <div className="relative flex-1 min-h-[300px] max-h-[65vh] flex items-center justify-center bg-black p-2 overflow-hidden">
              <img
                src={viewMode === 'stamped' && activeImage.stampedUrl ? activeImage.stampedUrl : activeImage.rawUrl}
                alt="Expanded view"
                className="max-h-[60vh] max-w-full object-contain rounded"
              />
            </div>

            {/* Geolocation metadata footer */}
            {activeImage.latitude !== undefined && activeImage.longitude !== undefined && (
              <div className="p-3 bg-slate-900 border-t border-slate-800 text-xs text-slate-300 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-mono text-teal-300 text-[11px]">
                    <MapPin className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <span>{formatCoordinates(activeImage.latitude, activeImage.longitude)}</span>
                    {activeImage.accuracy !== undefined && (
                      <span className="text-slate-400">(±{Math.round(activeImage.accuracy)}m)</span>
                    )}
                  </div>
                  {activeImage.timestamp && (
                    <span className="text-[11px] text-slate-400">
                      Captured: {new Date(activeImage.timestamp).toLocaleString()}
                    </span>
                  )}
                </div>
                {activeImage.address && (
                  <p className="text-[11px] text-slate-300 truncate">{activeImage.address}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
