import React from 'react';
import type { ComplaintStatus } from '../../types';
import { Clock, Eye, UserCheck, Wrench, CheckCircle2, Archive, XCircle, RotateCcw } from 'lucide-react';

interface StatusBadgeProps {
  status: ComplaintStatus;
  size?: 'sm' | 'md' | 'lg';
  showFullLabel?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', showFullLabel = false }) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm px-3 py-1.5 gap-2 font-medium',
  }[size];

  const config: Record<ComplaintStatus, { bg: string; icon: React.ElementType; label: string; fullLabel: string }> = {
    Submitted: {
      bg: 'bg-amber-50 border-amber-300 text-amber-800',
      icon: Clock,
      label: 'Submitted',
      fullLabel: 'Submitted (Awaiting Review)',
    },
    'Under Review': {
      bg: 'bg-purple-50 border-purple-300 text-purple-800',
      icon: Eye,
      label: 'Under Review',
      fullLabel: 'Under Review by Management',
    },
    Assigned: {
      bg: 'bg-blue-50 border-blue-300 text-blue-800',
      icon: UserCheck,
      label: 'Assigned',
      fullLabel: 'Assigned to Worker',
    },
    'In Progress': {
      bg: 'bg-teal-50 border-teal-300 text-teal-800',
      icon: Wrench,
      label: 'In Progress',
      fullLabel: 'Work In Progress',
    },
    Resolved: {
      bg: 'bg-emerald-50 border-emerald-300 text-emerald-800',
      icon: CheckCircle2,
      label: 'Resolved',
      fullLabel: 'Resolved (Pending Resident Confirmation)',
    },
    Closed: {
      bg: 'bg-slate-100 border-slate-300 text-slate-700',
      icon: Archive,
      label: 'Closed',
      fullLabel: 'Closed & Confirmed',
    },
    Rejected: {
      bg: 'bg-rose-50 border-rose-300 text-rose-800',
      icon: XCircle,
      label: 'Rejected',
      fullLabel: 'Rejected',
    },
    Reopened: {
      bg: 'bg-orange-50 border-orange-300 text-orange-800',
      icon: RotateCcw,
      label: 'Reopened',
      fullLabel: 'Reopened by Resident',
    },
    Pending: {
      bg: 'bg-amber-50 border-amber-300 text-amber-800',
      icon: Clock,
      label: 'Pending',
      fullLabel: 'Pending Triage',
    },
  };

  const statusConfig = config[status] || config.Submitted;
  const Icon = statusConfig.icon;
  const displayText = showFullLabel ? statusConfig.fullLabel : statusConfig.label;

  return (
    <span
      className={`inline-flex items-center rounded-full border ${statusConfig.bg} ${sizeClasses} whitespace-nowrap`}
      role="status"
      aria-label={`Status: ${displayText}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{displayText}</span>
    </span>
  );
};
