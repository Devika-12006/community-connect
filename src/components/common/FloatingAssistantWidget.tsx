import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sparkles, X } from 'lucide-react';

export const FloatingAssistantWidget: React.FC = () => {
  const location = useLocation();
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't show the floating widget if the resident is already on the dedicated assistant page
  if (location.pathname === '/resident/assistant' || isDismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2">
      <Link
        to="/resident/assistant"
        className="group flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-blue-700 to-indigo-600 hover:from-blue-800 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all cursor-pointer border border-white/20"
        title="Open AI Community Assistant"
      >
        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
        </div>
        <div className="text-left">
          <div className="text-xs font-bold leading-tight">AI Community Assistant</div>
          <div className="text-[10px] text-blue-100 font-medium">Ask water timings, lift contacts, rules</div>
        </div>
      </Link>

      <button
        type="button"
        onClick={() => setIsDismissed(true)}
        className="w-7 h-7 rounded-full bg-slate-800/60 hover:bg-slate-900 text-white flex items-center justify-center text-xs transition-colors cursor-pointer shadow-md"
        title="Hide assistant button"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
