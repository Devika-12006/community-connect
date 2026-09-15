import React from 'react';
import type { ComplaintPriority } from '../../types';
import { AlertTriangle, AlertCircle, Info, Flame } from 'lucide-react';

interface PriorityBadgeProps {
  priority: ComplaintPriority;
  size?: 'sm' | 'md';
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, size = 'sm' }) => {
  const config: Record<ComplaintPriority, { bg: string; icon: React.ElementType; label: string }> = {
    Low: {
      bg: 'bg-slate-100 text-slate-700 border-slate-200',
      icon: Info,
      label: 'Low Priority',
    },
    Medium: {
      bg: 'bg-amber-100 text-amber-900 border-amber-300',
      icon: AlertCircle,
      label: 'Medium Priority',
    },
    High: {
      bg: 'bg-orange-100 text-orange-900 border-orange-300',
      icon: AlertTriangle,
      label: 'High Priority',
    },
    Urgent: {
      bg: 'bg-red-100 text-red-900 border-red-300 font-bold',
      icon: Flame,
      label: 'Urgent Priority',
    },
  };

  const current = config[priority] || config.Low;
  const Icon = current.icon;
  const sizeClass = size === 'md' ? 'px-2.5 py-1 text-xs sm:text-sm' : 'px-2 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border ${sizeClass} font-semibold ${current.bg} whitespace-nowrap`}
      role="status"
      aria-label={current.label}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{priority}</span>
    </span>
  );
};
