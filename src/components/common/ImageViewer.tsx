import React, { useEffect, useState } from 'react';
import { repository } from '../../db/repository';
import { X, ZoomIn, ImageOff } from 'lucide-react';

interface ImageViewerProps {
  imageIds: string[];
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ imageIds }) => {
  const [urls, setUrls] = useState<{ id: string; url: string; name: string }[]>([]);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];

    async function loadImages() {
      setLoading(true);
      const loaded: { id: string; url: string; name: string }[] = [];
      for (const id of imageIds) {
        const asset = await repository.getImage(id);
        if (asset) {
          const url = URL.createObjectURL(asset.blob);
          objectUrls.push(url);
          loaded.push({ id: asset.id, url, name: asset.originalName });
        }
      }
      if (active) {
        setUrls(loaded);
        setLoading(false);
      }
    }

    if (imageIds.length > 0) {
      loadImages();
    } else {
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

  if (urls.length === 0) {
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
        {urls.map((img) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setActiveUrl(img.url)}
            className="group relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 hover:border-[#166534] focus-visible:outline-2 focus-visible:outline-[#166534] transition-all"
          >
            <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
              <ZoomIn className="w-5 h-5" />
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox Modal */}
      {activeUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
          onClick={() => setActiveUrl(null)}
          role="dialog"
        >
          <div className="relative max-w-3xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setActiveUrl(null)}
              className="absolute -top-10 right-0 p-1.5 text-white/80 hover:text-white bg-black/40 rounded-full"
              aria-label="Close preview"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={activeUrl}
              alt="Expanded view"
              className="max-w-full max-h-[85vh] rounded-lg object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
