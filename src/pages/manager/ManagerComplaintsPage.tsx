import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { repository } from '../../db/repository';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_STATUSES,
  COMPLAINT_PRIORITIES,
  type ComplaintCategory,
  type ComplaintPriority,
  type Complaint,
  type ComplaintEvent,
  type ImageAsset,
} from '../../types';
import { suggestPriority } from '../../lib/smartAssistance';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PriorityBadge } from '../../components/common/PriorityBadge';
import { ImageViewer } from '../../components/common/ImageViewer';
import { Modal } from '../../components/common/Modal';
import { formatCoordinates } from '../../lib/geoUtils';
import { priorityEngine } from '../../services/priorityEngine';
import { workerRecommendationService, type WorkerRecommendation } from '../../services/workerRecommendationService';
import {
  Search,
  UserCheck,
  FileText,
  Lock,
  Globe,
  CheckCircle,
  RotateCcw,
  Sparkles,
  MapPin,
  Check,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Monitor,
  Navigation,
  Sliders,
  Layers,
} from 'lucide-react';

export const ManagerComplaintsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { complaints, workers, refreshAll } = useApp();

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [workerFilter, setWorkerFilter] = useState<string>('ALL');
  const [suspiciousOnly, setSuspiciousOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'priority_desc' | 'ref_asc'>('date_desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Selected complaint for review modal
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [complaintEvents, setComplaintEvents] = useState<ComplaintEvent[]>([]);
  const [selectedComplaintImages, setSelectedComplaintImages] = useState<ImageAsset[]>([]);
  const [matchedComplaint, setMatchedComplaint] = useState<Complaint | null>(null);
  const [matchedImage, setMatchedImage] = useState<ImageAsset | null>(null);

  // Action states inside modal
  const [newCategory, setNewCategory] = useState<ComplaintCategory>('Garbage');
  const [newPriority, setNewPriority] = useState<ComplaintPriority>('Low');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');

  const [internalNote, setInternalNote] = useState('');
  const [publicUpdate, setPublicUpdate] = useState('');

  // Reject modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Correction modal
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');

  // Priority Override modal
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideNewLevel, setOverrideNewLevel] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('High');
  const [overrideReason, setOverrideReason] = useState('');

  // Smart Worker Recommendations
  const [workerRecommendations, setWorkerRecommendations] = useState<WorkerRecommendation[]>([]);

  // Feedback banner
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const handleOpenReview = async (c: Complaint) => {
    setSelectedComplaint(c);
    setNewCategory(c.category);
    setNewPriority(c.priority);
    setSelectedWorkerId(c.assignedWorkerId || '');
    setInternalNote('');
    setPublicUpdate('');
    const evs = await repository.getEvents(c.id);
    setComplaintEvents(evs);

    // Compute smart worker recommendations
    try {
      const recs = await workerRecommendationService.getRecommendations(c);
      setWorkerRecommendations(recs);
    } catch {
      setWorkerRecommendations([]);
    }

    // Load original image assets
    if (c.originalImageIds && c.originalImageIds.length > 0) {
      const imgs = await repository.getImages(c.originalImageIds);
      setSelectedComplaintImages(imgs);
    } else {
      setSelectedComplaintImages([]);
    }

    // Check for matched reused image / complaint
    const reusedFlag = c.suspiciousFlags?.find((f) => f.type === 'REUSED_PHOTO');
    if (reusedFlag?.matchedComplaintId) {
      const mc = await repository.getComplaint(reusedFlag.matchedComplaintId);
      setMatchedComplaint(mc);
    } else {
      setMatchedComplaint(null);
    }

    if (reusedFlag?.matchedImageId) {
      const mi = await repository.getImage(reusedFlag.matchedImageId);
      setMatchedImage(mi);
    } else {
      setMatchedImage(null);
    }
  };

  const handleDismissSuspiciousFlag = async () => {
    if (!selectedComplaint) return;
    const updated = await repository.dismissSuspiciousFlags(
      selectedComplaint.id,
      'Community Manager',
      'Verified as legitimate complaint by manager.'
    );
    if (updated) {
      setSelectedComplaint(updated);
      await refreshAll();
      const evs = await repository.getEvents(selectedComplaint.id);
      setComplaintEvents(evs);
      showSuccessBanner('Suspicious flag dismissed.');
    }
  };

  const handleApplyPriorityOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint || !overrideReason.trim()) {
      alert('Mandatory justification is required to override system priority.');
      return;
    }
    const now = new Date().toISOString();
    const currentAssessment =
      selectedComplaint.priorityAssessment ||
      priorityEngine.computePriority({
        severity: 2,
        affected: 2,
        waitingTime: 1,
        recurrence: 1,
      });

    const overriddenAssessment = priorityEngine.overridePriority(
      currentAssessment,
      overrideNewLevel,
      overrideReason.trim(),
      'Community Manager'
    );

    const mappedPriority: ComplaintPriority =
      overrideNewLevel === 'Critical' ? 'Urgent' : (overrideNewLevel as ComplaintPriority);

    const updated: Complaint = {
      ...selectedComplaint,
      priority: mappedPriority,
      priorityAssessment: overriddenAssessment,
      updatedAt: now,
    };

    await repository.saveComplaint(updated);
    await repository.addEvent({
      id: crypto.randomUUID(),
      complaintId: selectedComplaint.id,
      eventType: 'PriorityChanged',
      action: `Priority Overridden to ${overrideNewLevel}`,
      actorRole: 'Manager',
      actorName: 'Community Manager',
      visibility: 'public',
      note: `Override justification: ${overrideReason.trim()}`,
      createdAt: now,
    });

    setSelectedComplaint(updated);
    setNewPriority(mappedPriority);
    setShowOverrideModal(false);
    setOverrideReason('');
    await refreshAll();
    const evs = await repository.getEvents(selectedComplaint.id);
    setComplaintEvents(evs);
    showSuccessBanner(`Priority overridden to ${overrideNewLevel} with recorded justification.`);
  };

  const handleDuplicateAction = async (action: 'Confirm' | 'Link' | 'MarkSeparate' | 'Dismiss') => {
    if (!selectedComplaint) return;
    const now = new Date().toISOString();
    let updated: Complaint = { ...selectedComplaint, updatedAt: now };

    if (action === 'Confirm') {
      updated.duplicateStatus = 'Confirmed';
      updated.isDuplicate = true;
      if (selectedComplaint.duplicateMatch?.matchedComplaintId) {
        updated.duplicateOfId = selectedComplaint.duplicateMatch.matchedComplaintId;
      }
    } else if (action === 'Link') {
      updated.duplicateStatus = 'Linked';
      if (selectedComplaint.duplicateMatch?.matchedComplaintId) {
        updated.duplicateOfId = selectedComplaint.duplicateMatch.matchedComplaintId;
      }
    } else if (action === 'MarkSeparate') {
      updated.duplicateStatus = 'Dismissed';
      updated.isDuplicate = false;
    } else if (action === 'Dismiss') {
      updated.duplicateStatus = 'Dismissed';
    }

    await repository.saveComplaint(updated);
    await repository.addEvent({
      id: crypto.randomUUID(),
      complaintId: selectedComplaint.id,
      eventType: 'InternalNote',
      action: `Duplicate Action: ${action}`,
      actorRole: 'Manager',
      actorName: 'Community Manager',
      visibility: 'internal',
      note: `Manager duplicate review decision: ${action}. (Complaints are never auto-deleted)`,
      createdAt: now,
    });

    setSelectedComplaint(updated);
    await refreshAll();
    const evs = await repository.getEvents(selectedComplaint.id);
    setComplaintEvents(evs);
    showSuccessBanner(`Duplicate review updated: ${action}`);
  };

  const handleImageReviewDecision = async (decision: 'Approved' | 'Flagged') => {
    if (!selectedComplaint) return;
    const now = new Date().toISOString();
    const updated: Complaint = {
      ...selectedComplaint,
      managerReviewDecision: decision,
      managerReviewedAt: now,
      managerReviewedBy: 'Community Manager',
      updatedAt: now,
    };

    await repository.saveComplaint(updated);
    await repository.addEvent({
      id: crypto.randomUUID(),
      complaintId: selectedComplaint.id,
      eventType: 'ImageVerified',
      action: `Photo Verification: ${decision}`,
      actorRole: 'Manager',
      actorName: 'Community Manager',
      visibility: 'internal',
      note: `Photo evidence reviewed and ${decision.toLowerCase()} by manager.`,
      createdAt: now,
    });

    setSelectedComplaint(updated);
    await refreshAll();
    const evs = await repository.getEvents(selectedComplaint.id);
    setComplaintEvents(evs);
    showSuccessBanner(`Photo verification decision marked: ${decision}`);
  };

  const handleCloseReview = () => {
    setSelectedComplaint(null);
    setSelectedComplaintImages([]);
    setMatchedComplaint(null);
    setMatchedImage(null);
    setSearchParams({});
  };

  // Auto-select complaint from URL search parameter (e.g. ?selected=...) or filter param
  useEffect(() => {
    const targetId = searchParams.get('selected');
    if (targetId) {
      const found = complaints.find((c) => c.id === targetId);
      if (found) {
        handleOpenReview(found);
      }
    }
    if (searchParams.get('filter') === 'suspicious') {
      setSuspiciousOnly(true);
    }
  }, [searchParams, complaints]);

  // Smart priority suggestion for the current complaint
  const prioritySuggestion = useMemo(() => {
    if (!selectedComplaint) return null;
    return suggestPriority(
      selectedComplaint.category,
      selectedComplaint.requestUrgentAttention,
      selectedComplaint.description
    );
  }, [selectedComplaint]);

  // Apply filters
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      if (suspiciousOnly && (!c.isSuspicious || c.dismissedSuspiciousFlags)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchRef = c.reference.toLowerCase().includes(q);
        const matchDesc = c.description.toLowerCase().includes(q);
        const matchCategory = c.category.toLowerCase().includes(q);
        const matchResident = c.residentName.toLowerCase().includes(q);
        const matchLocation = `${c.block} ${c.specificLocation || ''}`.toLowerCase().includes(q);
        if (!matchRef && !matchDesc && !matchResident && !matchLocation && !matchCategory) return false;
      }
      if (categoryFilter !== 'ALL' && c.category !== categoryFilter) return false;
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (priorityFilter !== 'ALL' && c.priority !== priorityFilter) return false;
      if (workerFilter !== 'ALL') {
        if (workerFilter === 'UNASSIGNED') {
          if (c.assignedWorkerId) return false;
        } else if (c.assignedWorkerId !== workerFilter) {
          return false;
        }
      }
      return true;
    });
  }, [complaints, suspiciousOnly, searchQuery, categoryFilter, statusFilter, priorityFilter, workerFilter]);

  // Apply sorting
  const sortedComplaints = useMemo(() => {
    return [...filteredComplaints].sort((a, b) => {
      if (sortBy === 'date_desc') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'date_asc') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === 'ref_asc') {
        return a.reference.localeCompare(b.reference);
      }
      if (sortBy === 'priority_desc') {
        const pWeights: Record<string, number> = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
        return (pWeights[b.priority] || 0) - (pWeights[a.priority] || 0);
      }
      return 0;
    });
  }, [filteredComplaints, sortBy]);

  // Apply pagination
  const totalPages = Math.max(1, Math.ceil(sortedComplaints.length / pageSize));
  const paginatedComplaints = useMemo(() => {
    const validPage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (validPage - 1) * pageSize;
    return sortedComplaints.slice(start, start + pageSize);
  }, [sortedComplaints, currentPage, totalPages, pageSize]);

  // Action: Save Category & Priority changes
  const handleUpdateTriage = async () => {
    if (!selectedComplaint) return;
    const now = new Date().toISOString();
    let updated: Complaint = {
      ...selectedComplaint,
      category: newCategory,
      priority: newPriority,
      updatedAt: now,
    };

    if (newCategory !== selectedComplaint.category) {
      await repository.addEvent({
        id: crypto.randomUUID(),
        complaintId: selectedComplaint.id,
        eventType: 'CategoryChanged',
        action: 'Category Changed',
        actorRole: 'Manager',
        actorName: 'Community Manager',
        visibility: 'public',
        note: `Category adjusted from ${selectedComplaint.category} to ${newCategory}.`,
        createdAt: now,
      });
    }

    if (newPriority !== selectedComplaint.priority) {
      await repository.addEvent({
        id: crypto.randomUUID(),
        complaintId: selectedComplaint.id,
        eventType: 'PriorityChanged',
        action: 'Priority Changed',
        actorRole: 'Manager',
        actorName: 'Community Manager',
        visibility: 'public',
        note: `Priority updated to ${newPriority}.`,
        createdAt: now,
      });
    }

    await repository.saveComplaint(updated);
    setSelectedComplaint(updated);
    await refreshAll();
    showSuccessBanner('Triage details updated successfully.');
  };

  // Action: Assign or Reassign Worker
  const handleAssignWorker = async () => {
    if (!selectedComplaint || !selectedWorkerId) return;
    const targetWorker = workers.find((w) => w.id === selectedWorkerId);
    if (!targetWorker || !targetWorker.active) {
      alert('Cannot assign to an inactive worker.');
      return;
    }

    const now = new Date().toISOString();
    const isReassignment = !!selectedComplaint.assignedWorkerId;

    const updated: Complaint = {
      ...selectedComplaint,
      assignedWorkerId: targetWorker.id,
      assignedWorkerName: targetWorker.name,
      assignedAt: now,
      status: selectedComplaint.status === 'Submitted' || selectedComplaint.status === 'Under Review' ? 'Assigned' : selectedComplaint.status,
      updatedAt: now,
    };

    await repository.saveComplaint(updated);

    await repository.addEvent({
      id: crypto.randomUUID(),
      complaintId: selectedComplaint.id,
      eventType: isReassignment ? 'Reassigned' : 'Assigned',
      action: isReassignment ? 'Worker Reassigned' : 'Worker Assigned',
      actorRole: 'Manager',
      actorName: 'Community Manager',
      visibility: 'public',
      note: `Assigned to ${targetWorker.name} (${targetWorker.specialty}).`,
      createdAt: now,
    });

    // Notify Worker
    await repository.addNotification({
      id: crypto.randomUUID(),
      recipientRole: 'Worker',
      recipientId: targetWorker.id,
      complaintId: selectedComplaint.id,
      title: `Task Assigned: ${selectedComplaint.reference}`,
      message: `You have been assigned "${selectedComplaint.title}" at ${selectedComplaint.block}.`,
      createdAt: now,
    });

    // Notify Resident
    await repository.addNotification({
      id: crypto.randomUUID(),
      recipientRole: 'Resident',
      recipientId: selectedComplaint.residentId,
      complaintId: selectedComplaint.id,
      title: `Worker Assigned: ${selectedComplaint.reference}`,
      message: `Maintenance worker ${targetWorker.name} has been assigned to your report.`,
      createdAt: now,
    });

    setSelectedComplaint(updated);
    await refreshAll();
    const evs = await repository.getEvents(selectedComplaint.id);
    setComplaintEvents(evs);
    showSuccessBanner(`Assigned to ${targetWorker.name}.`);
  };

  // Action: Add Internal Note (STRICTLY HIDDEN from resident views)
  const handleAddInternalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint || !internalNote.trim()) return;

    const now = new Date().toISOString();
    await repository.addEvent({
      id: crypto.randomUUID(),
      complaintId: selectedComplaint.id,
      eventType: 'InternalNote',
      action: 'Internal Management Note',
      actorRole: 'Manager',
      actorName: 'Community Manager',
      visibility: 'internal', // INTERNAL ONLY
      note: internalNote.trim(),
      createdAt: now,
    });

    setInternalNote('');
    const evs = await repository.getEvents(selectedComplaint.id);
    setComplaintEvents(evs);
    showSuccessBanner('Internal note logged (visible only to managers).');
  };

  // Action: Add Resident-Visible Update
  const handleAddPublicUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint || !publicUpdate.trim()) return;

    const now = new Date().toISOString();
    await repository.addEvent({
      id: crypto.randomUUID(),
      complaintId: selectedComplaint.id,
      eventType: 'ProgressUpdate',
      action: 'Management Update',
      actorRole: 'Manager',
      actorName: 'Community Manager',
      visibility: 'public',
      note: publicUpdate.trim(),
      createdAt: now,
    });

    // Notify Resident
    await repository.addNotification({
      id: crypto.randomUUID(),
      recipientRole: 'Resident',
      recipientId: selectedComplaint.residentId,
      complaintId: selectedComplaint.id,
      title: `Update on ${selectedComplaint.reference}`,
      message: `Management added an update: "${publicUpdate.trim()}"`,
      createdAt: now,
    });

    setPublicUpdate('');
    const evs = await repository.getEvents(selectedComplaint.id);
    setComplaintEvents(evs);
    showSuccessBanner('Resident-visible update posted.');
  };

  // Action: Reject Complaint
  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint || !rejectReason.trim()) return;

    const now = new Date().toISOString();
    const updated: Complaint = {
      ...selectedComplaint,
      status: 'Rejected',
      rejectionReason: rejectReason.trim(),
      updatedAt: now,
    };

    await repository.saveComplaint(updated);

    await repository.addEvent({
      id: crypto.randomUUID(),
      complaintId: selectedComplaint.id,
      eventType: 'Rejected',
      action: 'Complaint Rejected',
      actorRole: 'Manager',
      actorName: 'Community Manager',
      visibility: 'public',
      note: `Rejected reason: ${rejectReason.trim()}`,
      createdAt: now,
    });

    // Notify Resident
    await repository.addNotification({
      id: crypto.randomUUID(),
      recipientRole: 'Resident',
      recipientId: selectedComplaint.residentId,
      complaintId: selectedComplaint.id,
      title: `Complaint Rejected: ${selectedComplaint.reference}`,
      message: `Your complaint could not be processed: ${rejectReason.trim()}`,
      createdAt: now,
    });

    setShowRejectModal(false);
    setRejectReason('');
    setSelectedComplaint(updated);
    await refreshAll();
    const evs = await repository.getEvents(selectedComplaint.id);
    setComplaintEvents(evs);
    showSuccessBanner('Complaint rejected.');
  };

  // Action: Approve Completion -> Resolved
  const handleApproveCompletion = async () => {
    if (!selectedComplaint) return;
    const now = new Date().toISOString();
    const updated: Complaint = {
      ...selectedComplaint,
      status: 'Resolved',
      completionAwaitingReview: false,
      resolvedAt: now,
      updatedAt: now,
    };

    await repository.saveComplaint(updated);

    await repository.addEvent({
      id: crypto.randomUUID(),
      complaintId: selectedComplaint.id,
      eventType: 'Resolved',
      action: 'Completion Approved & Resolved',
      actorRole: 'Manager',
      actorName: 'Community Manager',
      visibility: 'public',
      note: 'Manager reviewed completion evidence and verified resolution.',
      createdAt: now,
    });

    // Notify Resident
    await repository.addNotification({
      id: crypto.randomUUID(),
      recipientRole: 'Resident',
      recipientId: selectedComplaint.residentId,
      complaintId: selectedComplaint.id,
      title: `Complaint Resolved: ${selectedComplaint.reference}`,
      message: `Work completed on "${selectedComplaint.title}". Please inspect proof photos and confirm resolution.`,
      createdAt: now,
    });

    // Notify Worker
    if (selectedComplaint.assignedWorkerId) {
      await repository.addNotification({
        id: crypto.randomUUID(),
        recipientRole: 'Worker',
        recipientId: selectedComplaint.assignedWorkerId,
        complaintId: selectedComplaint.id,
        title: `Work Approved: ${selectedComplaint.reference}`,
        message: `Manager approved your completion evidence for "${selectedComplaint.title}".`,
        createdAt: now,
      });
    }

    setSelectedComplaint(updated);
    await refreshAll();
    const evs = await repository.getEvents(selectedComplaint.id);
    setComplaintEvents(evs);
    showSuccessBanner('Completion approved. Complaint marked Resolved.');
  };

  // Action: Return Work for Correction
  const handleReturnForCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint || !correctionReason.trim()) return;

    const now = new Date().toISOString();
    const updated: Complaint = {
      ...selectedComplaint,
      status: 'In Progress',
      completionAwaitingReview: false,
      correctionReason: correctionReason.trim(),
      updatedAt: now,
    };

    await repository.saveComplaint(updated);

    await repository.addEvent({
      id: crypto.randomUUID(),
      complaintId: selectedComplaint.id,
      eventType: 'CorrectionRequested',
      action: 'Work Returned for Correction',
      actorRole: 'Manager',
      actorName: 'Community Manager',
      visibility: 'public',
      note: `Correction required: ${correctionReason.trim()}`,
      createdAt: now,
    });

    // Notify Worker
    if (selectedComplaint.assignedWorkerId) {
      await repository.addNotification({
        id: crypto.randomUUID(),
        recipientRole: 'Worker',
        recipientId: selectedComplaint.assignedWorkerId,
        complaintId: selectedComplaint.id,
        title: `Correction Requested: ${selectedComplaint.reference}`,
        message: `Manager requested corrections: "${correctionReason.trim()}"`,
        createdAt: now,
      });
    }

    setShowCorrectionModal(false);
    setCorrectionReason('');
    setSelectedComplaint(updated);
    await refreshAll();
    const evs = await repository.getEvents(selectedComplaint.id);
    setComplaintEvents(evs);
    showSuccessBanner('Work returned to field worker for corrections.');
  };

  const showSuccessBanner = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900">Complaint Management</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Triage incoming reports, assign workers, log internal notes, and approve completion evidence.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ID, title, resident..."
              className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 focus:outline-none"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 focus:outline-none bg-white"
          >
            <option value="ALL">All Categories</option>
            {COMPLAINT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 focus:outline-none bg-white"
          >
            <option value="ALL">All Statuses</option>
            {COMPLAINT_STATUSES.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 focus:outline-none bg-white"
          >
            <option value="ALL">All Priorities</option>
            {COMPLAINT_PRIORITIES.map((pr) => (
              <option key={pr} value={pr}>{pr} Priority</option>
            ))}
          </select>

          {/* Worker Filter */}
          <select
            value={workerFilter}
            onChange={(e) => {
              setWorkerFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 focus:outline-none bg-white"
          >
            <option value="ALL">All Worker Allocations</option>
            <option value="UNASSIGNED">Unassigned Only</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>{w.name} ({w.specialty})</option>
            ))}
          </select>

          {/* Sort Selector */}
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as any);
              setCurrentPage(1);
            }}
            className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 focus:outline-none bg-white"
          >
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="priority_desc">Highest Priority First</option>
            <option value="ref_asc">Reference Code (A-Z)</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center gap-2.5">
            <span>Showing {sortedComplaints.length} of {complaints.length} complaints</span>
            <button
              type="button"
              onClick={() => {
                setSuspiciousOnly(!suspiciousOnly);
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                suspiciousOnly
                  ? 'bg-red-700 text-white shadow-xs'
                  : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>
                Suspicious / Flagged ({complaints.filter((c) => c.isSuspicious && !c.dismissedSuspiciousFlags).length})
              </span>
            </button>
          </div>
          {(searchQuery || categoryFilter !== 'ALL' || statusFilter !== 'ALL' || priorityFilter !== 'ALL' || workerFilter !== 'ALL' || suspiciousOnly) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('ALL');
                setStatusFilter('ALL');
                setPriorityFilter('ALL');
                setWorkerFilter('ALL');
                setSuspiciousOnly(false);
                setCurrentPage(1);
              }}
              className="text-teal-700 font-bold hover:underline text-[11px] cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Complaints List: Table on Desktop, Cards on Mobile */}
      {sortedComplaints.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 shadow-xs">
          <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          <div className="font-semibold text-slate-800 mb-1">No complaints match your criteria</div>
          <p className="text-xs text-slate-400">Try adjusting your filters or search keywords.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View - Redesigned without Issue Title column */}
          <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="p-3.5">ID</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Resident</th>
                  <th className="p-3.5">Flat / Location</th>
                  <th className="p-3.5">Priority</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Assigned Worker</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedComplaints.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-slate-900">
                      <div className="space-y-1">
                        <span>{c.reference}</span>
                        {c.isSuspicious && !c.dismissedSuspiciousFlags && (
                          <div className="text-[9px] font-bold text-red-700 bg-red-100 border border-red-200 px-1.5 py-0.2 rounded w-fit flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>Flagged</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className="font-semibold text-slate-800 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px]">
                        {c.category}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-900">{c.residentName}</div>
                      {c.residentFlat && <div className="text-[11px] text-slate-400">Flat {c.residentFlat}</div>}
                    </td>
                    <td className="p-3.5">
                      <div className="font-medium text-slate-800">{c.block}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[140px]">{c.specificLocation}</div>
                    </td>
                    <td className="p-3.5">
                      <PriorityBadge priority={c.priority} />
                    </td>
                    <td className="p-3.5">
                      <div className="space-y-1">
                        <StatusBadge status={c.status} size="sm" />
                        {c.completionAwaitingReview && (
                          <div className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded w-fit">
                            Review Proof
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5">
                      {c.assignedWorkerName ? (
                        <span className="font-semibold text-slate-800">{c.assignedWorkerName}</span>
                      ) : (
                        <span className="text-amber-700 text-[11px] font-medium italic">Unassigned</span>
                      )}
                    </td>
                    <td className="p-3.5 text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenReview(c)}
                        className="px-3 py-1.5 bg-teal-800 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="lg:hidden space-y-3">
            {paginatedComplaints.map((c) => (
              <div
                key={c.id}
                onClick={() => handleOpenReview(c)}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3 cursor-pointer hover:border-teal-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                        {c.reference}
                      </span>
                      {c.isSuspicious && !c.dismissedSuspiciousFlags && (
                        <span className="text-[10px] font-bold text-red-700 bg-red-100 border border-red-200 px-1.5 py-0.2 rounded flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          <span>Flagged</span>
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-slate-900 mt-1">{c.residentName} ({c.block} {c.residentFlat ? `• Flat ${c.residentFlat}` : ''})</div>
                  </div>
                  <StatusBadge status={c.status} size="sm" />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Category</span>
                    <span className="font-medium text-slate-800">{c.category}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Priority</span>
                    <PriorityBadge priority={c.priority} />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Location</span>
                    <span className="font-medium truncate block">{c.block} {c.specificLocation ? `• ${c.specificLocation}` : ''}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Worker</span>
                    <span className="font-medium text-slate-800 truncate block">
                      {c.assignedWorkerName || 'Unassigned'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <span className="text-[11px] text-slate-400">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </span>
                  <span className="text-teal-800 font-bold text-xs flex items-center gap-1">
                    <span>Review Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex items-center justify-between shadow-2xs text-xs">
              <span className="text-slate-500 text-[11px]">
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({sortedComplaints.length} total)
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  &larr; Prev
                </button>

                {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pg) => (
                  <button
                    key={pg}
                    type="button"
                    onClick={() => setCurrentPage(pg)}
                    className={`w-7 h-7 rounded-lg font-bold text-xs transition-colors ${
                      currentPage === pg
                        ? 'bg-teal-800 text-white'
                        : 'border border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {pg}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next &rarr;
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* COMPLAINT REVIEW & TRIAGE MODAL */}
      {selectedComplaint && (
        <Modal
          isOpen={true}
          onClose={handleCloseReview}
          title={`Review Complaint: ${selectedComplaint.reference}`}
          maxWidth="xl"
        >
          <div className="space-y-5">
            {/* Action feedback alert */}
            {actionSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-semibold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{actionSuccess}</span>
              </div>
            )}

            {/* Top Issue Context Card */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                <div>
                  <h3 className="text-base font-black text-slate-900">{selectedComplaint.title}</h3>
                  <div className="text-slate-500 text-[11px] mt-0.5">
                    Reported on {new Date(selectedComplaint.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedComplaint.status} size="md" />
                  <PriorityBadge priority={selectedComplaint.priority} size="md" />
                </div>
              </div>

              <div>
                <span className="font-semibold text-slate-700 block mb-1">Resident Description:</span>
                <p className="text-slate-800 leading-relaxed bg-white p-3 rounded-xl border border-slate-200">
                  {selectedComplaint.description}
                </p>
              </div>

              {/* Linked Community Asset (Manual Inventory Link - NO QR) */}
              {(selectedComplaint.assetId || selectedComplaint.assetCode) && (
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-700 shrink-0" />
                    <div>
                      <div className="font-bold text-blue-950 flex items-center gap-1.5">
                        <span>{selectedComplaint.assetName || 'Community Equipment'}</span>
                        {selectedComplaint.assetCode && (
                          <span className="font-mono text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">
                            {selectedComplaint.assetCode}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-blue-700">
                        Linked Society Asset • Location: {selectedComplaint.block}
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                    Asset Registry
                  </span>
                </div>
              )}

              {/* Feature 3: Explainable Priority Scoring (P = 7S + 5A + 4W + 4R) */}
              {selectedComplaint.priorityAssessment && (
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-teal-700 shrink-0" />
                      <span className="font-bold text-slate-900 text-sm">Priority Scoring Formula (P = 7S + 5A + 4W + 4R)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${
                        selectedComplaint.priorityAssessment.level === 'Critical' ? 'bg-red-100 text-red-800 border border-red-300' :
                        selectedComplaint.priorityAssessment.level === 'High' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                        selectedComplaint.priorityAssessment.level === 'Medium' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                        'bg-slate-100 text-slate-800 border border-slate-300'
                      }`}>
                        Score: {selectedComplaint.priorityAssessment.score}/100 ({selectedComplaint.priorityAssessment.level})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setOverrideNewLevel(selectedComplaint.priorityAssessment?.level || 'Medium');
                          setOverrideReason('');
                          setShowOverrideModal(true);
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-bold border border-slate-300 transition-colors cursor-pointer"
                      >
                        Override Priority
                      </button>
                    </div>
                  </div>

                  {/* Formula Breakdown Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="p-2 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">Safety Risk (7S)</span>
                      <span className="text-base font-black text-slate-900">{selectedComplaint.priorityAssessment.severity}/5</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">{selectedComplaint.priorityAssessment.breakdown.safetyScore} pts</span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">Affected (5A)</span>
                      <span className="text-base font-black text-slate-900">{selectedComplaint.priorityAssessment.affected}/5</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">{selectedComplaint.priorityAssessment.breakdown.affectedScore} pts</span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">Waiting Time (4W)</span>
                      <span className="text-base font-black text-slate-900">{selectedComplaint.priorityAssessment.waitingTime}/5</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">{selectedComplaint.priorityAssessment.breakdown.waitingScore} pts</span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">60d Recurrence (4R)</span>
                      <span className="text-base font-black text-slate-900">{selectedComplaint.priorityAssessment.recurrence}/5</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">{selectedComplaint.priorityAssessment.breakdown.recurrenceScore} pts</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                    <div className="font-mono font-bold text-teal-900">
                      Formula: {selectedComplaint.priorityAssessment.formula}
                    </div>
                    <p>{selectedComplaint.priorityAssessment.explanation}</p>
                  </div>

                  {selectedComplaint.priorityAssessment.isOverridden && (
                    <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-xs text-amber-800">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Priority Overridden by Manager (Original: {selectedComplaint.priorityAssessment.originalLevel})</span>
                      </div>
                      <p className="text-[11px] italic">
                        "<strong>Justification:</strong> {selectedComplaint.priorityAssessment.overrideReason}"
                      </p>
                      <span className="text-[10px] text-amber-700 block">
                        By {selectedComplaint.priorityAssessment.overriddenBy} on {new Date(selectedComplaint.priorityAssessment.overriddenAt || '').toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Feature 2: Smart Duplicate Review */}
              {selectedComplaint.duplicateMatch && (
                <div className="p-4 bg-amber-50/70 border border-amber-300 rounded-2xl space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                    <div className="flex items-center gap-1.5 font-bold text-amber-950 text-sm">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>Smart Duplicate Complaint Detected ({selectedComplaint.duplicateMatch.similarityScore}% Match)</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedComplaint.duplicateStatus === 'Confirmed' ? 'bg-red-100 text-red-800 border border-red-300' :
                      selectedComplaint.duplicateStatus === 'Linked' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                      selectedComplaint.duplicateStatus === 'Dismissed' ? 'bg-slate-100 text-slate-700 border border-slate-300' :
                      'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}>
                      Status: {selectedComplaint.duplicateStatus || 'Flagged for Review'}
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-amber-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900 text-xs">
                        Matched Complaint: {selectedComplaint.duplicateMatch.matchedReference}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {selectedComplaint.duplicateMatch.similarityScore}% Multi-Signal Overlap
                      </span>
                    </div>
                    <p className="font-semibold text-slate-800">{selectedComplaint.duplicateMatch.matchedTitle}</p>
                    <div className="text-[11px] text-slate-600">
                      Matching signals: {selectedComplaint.duplicateMatch.factors.join(' • ')}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[11px] font-bold text-slate-700 mr-1">Manager Decision:</span>
                    <button
                      type="button"
                      onClick={() => handleDuplicateAction('Confirm')}
                      className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs"
                    >
                      Confirm Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateAction('Link')}
                      className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs"
                    >
                      Link Complaints
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateAction('MarkSeparate')}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-bold text-xs cursor-pointer shadow-xs"
                    >
                      Mark as Separate Issue
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateAction('Dismiss')}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs cursor-pointer"
                    >
                      Dismiss Flag
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 italic">
                    System policy: Complaints are never auto-deleted. Managers retain full authority to confirm, link, or mark issues separate.
                  </p>
                </div>
              )}

              {/* AI Complaint Intake & Routing Details */}
              {(selectedComplaint.source === 'WhatsApp' ||
                selectedComplaint.source === 'Mock WhatsApp' ||
                selectedComplaint.matchScore !== undefined) && (
                <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between border-b border-emerald-200 pb-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-900 text-xs">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                      <span>AI WhatsApp Intake & Routing Rationale</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {selectedComplaint.source || 'WhatsApp'}
                      </span>
                      {selectedComplaint.matchScore !== undefined && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-emerald-900 border border-emerald-300">
                          {selectedComplaint.matchScore}% Match
                        </span>
                      )}
                    </div>
                  </div>

                  {selectedComplaint.reporterPhone && (
                    <div className="text-[11px] text-emerald-800">
                      <span className="font-semibold">WhatsApp Sender: </span>
                      <span className="font-mono">{selectedComplaint.reporterPhone}</span>
                    </div>
                  )}

                  {selectedComplaint.matchReason && (
                    <div className="text-[11px] text-emerald-900 leading-relaxed bg-white/80 p-2.5 rounded-lg border border-emerald-200">
                      <span className="font-bold block mb-0.5">Scoring Engine Rationale:</span>
                      {selectedComplaint.matchReason}
                    </div>
                  )}

                  {selectedComplaint.needsClarification && selectedComplaint.clarificationQuestion && (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px]">
                      <span className="font-bold">Missing Details Prompt: </span>
                      {selectedComplaint.clarificationQuestion}
                    </div>
                  )}

                  {selectedComplaint.supportingMessageEvidence && (
                    <div className="text-[11px] text-indigo-900 space-y-1 bg-indigo-50/60 p-2.5 rounded-lg border border-indigo-200">
                      <span className="font-bold block">Cross-Referenced Authorized Notices:</span>
                      <ul className="list-disc pl-4 space-y-0.5 text-[10px]">
                        {(Array.isArray(selectedComplaint.supportingMessageEvidence)
                          ? selectedComplaint.supportingMessageEvidence
                          : [selectedComplaint.supportingMessageEvidence]
                        ).map((ev: string, idx: number) => (
                          <li key={idx}>{ev}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedComplaint.block} • {selectedComplaint.specificLocation}</span>
                </span>
                <span>Resident: <strong className="text-slate-700">{selectedComplaint.residentName}</strong> (Flat {selectedComplaint.residentFlat})</span>
              </div>

              {selectedComplaint.requestUrgentAttention && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-900 font-medium">
                  <strong>Urgent Attention Requested:</strong> {selectedComplaint.urgentReason}
                </div>
              )}

              {/* Photos */}
              {selectedComplaint.originalImageIds.length > 0 && (
                <div className="pt-2 border-t border-slate-200/60 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 block">Submitted Photos:</span>
                    {selectedComplaint.isLiveCapture && (
                      <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 text-[10px] font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-teal-700" />
                        <span>Live Camera Capture</span>
                      </span>
                    )}
                  </div>
                  <ImageViewer imageIds={selectedComplaint.originalImageIds} />
                </div>
              )}

              {/* GPS Capture Verification Card */}
              {(selectedComplaint.captureLatitude !== undefined && selectedComplaint.captureLongitude !== undefined) && (
                <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-teal-950 text-xs flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-teal-700" />
                      <span>GPS Tagged Capture Location</span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-900 font-mono text-[10px] font-bold">
                      {formatCoordinates(selectedComplaint.captureLatitude, selectedComplaint.captureLongitude)}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-teal-900/90 pt-1 border-t border-teal-200/60">
                    <div>
                      <span className="text-teal-700/80">Accuracy Radius: </span>
                      <strong>±{Math.round(selectedComplaint.captureAccuracy || 0)} meters</strong>
                    </div>
                    {selectedComplaint.captureLocationTimestamp && (
                      <div>
                        <span className="text-teal-700/80">Captured: </span>
                        <span>{new Date(selectedComplaint.captureLocationTimestamp).toLocaleString()}</span>
                      </div>
                    )}
                    {selectedComplaint.captureAddress && (
                      <div className="sm:col-span-2">
                        <span className="text-teal-700/80">Reverse-Geocoded: </span>
                        <span>{selectedComplaint.captureAddress}</span>
                      </div>
                    )}
                    {selectedComplaint.captureSessionId && (
                      <div className="sm:col-span-2 text-[10px] font-mono text-teal-800/70 truncate">
                        Validated Session: {selectedComplaint.captureSessionId}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Dedicated Image Verification & Integrity Panel */}
              {(selectedComplaint.isSuspicious ||
                selectedComplaint.suspiciousFlags ||
                selectedComplaint.imageVerificationStatus ||
                selectedComplaintImages.some((img) => img.quality)) && (
                <div
                  className={`mt-3 p-4 rounded-2xl border text-xs space-y-3 ${
                    selectedComplaint.isSuspicious && !selectedComplaint.dismissedSuspiciousFlags
                      ? 'bg-red-50/70 border-red-300'
                      : 'bg-white border-slate-200 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between border-b pb-2 border-slate-200">
                    <div className="flex items-center gap-2">
                      <AlertTriangle
                        className={`w-4 h-4 ${
                          selectedComplaint.isSuspicious && !selectedComplaint.dismissedSuspiciousFlags
                            ? 'text-red-600'
                            : 'text-slate-500'
                        }`}
                      />
                      <h4 className="font-bold text-slate-900 text-sm">Image Verification & Integrity</h4>
                    </div>

                    {selectedComplaint.isSuspicious && !selectedComplaint.dismissedSuspiciousFlags ? (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300 font-bold text-[10px]">
                        Suspicious / Verification Flagged
                      </span>
                    ) : selectedComplaint.dismissedSuspiciousFlags ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[10px]">
                        Verification Flag Dismissed
                      </span>
                    ) : selectedComplaint.imageVerificationStatus === 'Verified' ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[10px]">
                        Visual Match Verified
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px]">
                        Verification Checked
                      </span>
                    )}
                  </div>

                  {/* Flag List */}
                  {selectedComplaint.suspiciousFlags && selectedComplaint.suspiciousFlags.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="font-semibold text-slate-700">Flagged Conditions:</span>
                      <ul className="space-y-1">
                        {selectedComplaint.suspiciousFlags.map((flag, idx) => (
                          <li
                            key={idx}
                            className="p-2 bg-white rounded-lg border border-red-200 text-slate-800 flex items-start gap-2 shadow-2xs"
                          >
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-800 text-[9px] font-bold rounded shrink-0">
                              {flag.type}
                            </span>
                            <span className="text-[11px]">{flag.details}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Reused Photo Side-by-Side Comparison */}
                  {matchedImage && selectedComplaintImages.length > 0 && (
                    <div className="p-3 bg-white rounded-xl border border-red-200 space-y-2.5 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-red-900 text-xs flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-red-600" />
                          <span>Side-by-Side Reused Photo Comparison</span>
                        </span>
                        {selectedComplaint.suspiciousFlags?.find((f) => f.type === 'REUSED_PHOTO')
                          ?.similarityPercentage && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
                            {
                              selectedComplaint.suspiciousFlags.find((f) => f.type === 'REUSED_PHOTO')
                                ?.similarityPercentage
                            }
                            % Visual Similarity
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        {/* Current Report Photo */}
                        <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-700 block uppercase tracking-wider">
                            Current: {selectedComplaint.reference}
                          </span>
                          <div className="aspect-video w-full rounded overflow-hidden bg-slate-200">
                            <img
                              src={URL.createObjectURL(selectedComplaintImages[0].blob)}
                              alt="Current complaint photo"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <p className="text-[10px] text-slate-600 truncate">
                            Reported by: <strong>{selectedComplaint.residentName}</strong>
                          </p>
                          <p className="text-[9px] text-slate-400">
                            {new Date(selectedComplaint.createdAt).toLocaleString()}
                          </p>
                        </div>

                        {/* Matched Original Photo */}
                        <div className="space-y-1.5 bg-red-50/60 p-2.5 rounded-lg border border-red-200">
                          <span className="text-[10px] font-bold text-red-800 block uppercase tracking-wider">
                            Original: {matchedComplaint?.reference || 'Previous Report'}
                          </span>
                          <div className="aspect-video w-full rounded overflow-hidden bg-slate-200">
                            <img
                              src={URL.createObjectURL(matchedImage.blob)}
                              alt="Original matched photo"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <p className="text-[10px] text-slate-700 truncate">
                            Reported by: <strong>{matchedComplaint?.residentName || 'Previous Resident'}</strong>
                          </p>
                          <p className="text-[9px] text-slate-400">
                            {matchedComplaint ? new Date(matchedComplaint.createdAt).toLocaleString() : 'Past record'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Image Quality Metrics */}
                  {selectedComplaintImages.some((img) => img.quality) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedComplaintImages.map(
                        (img, idx) =>
                          img.quality && (
                            <div key={img.id} className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-[11px] text-slate-800">
                                  Photo {idx + 1} Quality:
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    img.quality.status === 'Clear'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {img.quality.status}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 flex justify-between">
                                <span>Luminance: {img.quality.brightness} / 255</span>
                                <span>Sharpness: {img.quality.sharpness}</span>
                              </div>
                              {img.quality.feedback && (
                                <p className="text-[10px] text-slate-600 italic">{img.quality.feedback}</p>
                              )}
                            </div>
                          )
                      )}
                    </div>
                  )}

                  {/* Four Verification Partitions */}
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <span className="font-bold text-slate-800 text-[11px] block uppercase tracking-wider">
                      Verification Partitions & Authenticity Signals
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {/* 1. Category Match */}
                      <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[11px] text-slate-800 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                            <span>1. Category Match</span>
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            selectedComplaint.imageVerificationStatus === 'Verified'
                              ? 'bg-emerald-100 text-emerald-800'
                              : selectedComplaint.imageVerificationStatus === 'Mismatch'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {selectedComplaint.imageVerificationStatus || 'Unavailable'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-600">
                          {selectedComplaint.visualExplanation ||
                            (selectedComplaint.visualCategorySuggested
                              ? `Model classified as ${selectedComplaint.visualCategorySuggested}.`
                              : 'Visual category classifier is inactive (Gemini API key not configured).')}
                        </p>
                      </div>

                      {/* 2. Community Duplicate Check */}
                      <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[11px] text-slate-800 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-teal-600" />
                            <span>2. Community Duplicate</span>
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            matchedComplaint
                              ? 'bg-red-100 text-red-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {matchedComplaint ? 'Duplicate Match' : 'Unique Photo'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-600">
                          {matchedComplaint
                            ? `64-bit dHash matched prior report ${matchedComplaint.reference}.`
                            : 'Perceptual dHash scanned across community database; no duplicate detected.'}
                        </p>
                      </div>

                      {/* 3. Screen / Display Check */}
                      <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[11px] text-slate-800 flex items-center gap-1.5">
                            <Monitor className="w-3.5 h-3.5 text-slate-500" />
                            <span>3. Screen/Display Signal</span>
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            selectedComplaint.suspiciousFlags?.some((f) => f.type === 'POSSIBLE_SCREEN_PHOTO')
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {selectedComplaint.suspiciousFlags?.some((f) => f.type === 'POSSIBLE_SCREEN_PHOTO')
                              ? 'Screen Artifacts Flagged'
                              : 'No Screen Artifacts'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 italic">
                          {selectedComplaint.suspiciousFlags?.find((f) => f.type === 'POSSIBLE_SCREEN_PHOTO')?.details ||
                            'Moiré/scanline heuristic shows no monitor artifacts. Note: This is an advisory review signal.'}
                        </p>
                      </div>

                      {/* 4. External Web Search */}
                      <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[11px] text-slate-800 flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5 text-slate-400" />
                            <span>4. External Web Search</span>
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-medium">
                            Not Configured
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          Web-image matching not configured (external reverse search requires dedicated reverse-image API integration).
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Manager Decisions on Photo Verification */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/80">
                    <span className="text-[11px] font-bold text-slate-700 mr-1">Verification Decision:</span>
                    <button
                      type="button"
                      onClick={() => handleImageReviewDecision('Approved')}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors ${
                        selectedComplaint.managerReviewDecision === 'Approved'
                          ? 'bg-emerald-800 text-white'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>{selectedComplaint.managerReviewDecision === 'Approved' ? 'Photo Approved' : 'Approve Photo'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleImageReviewDecision('Flagged')}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors ${
                        selectedComplaint.managerReviewDecision === 'Flagged'
                          ? 'bg-rose-800 text-white'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{selectedComplaint.managerReviewDecision === 'Flagged' ? 'Photo Flagged' : 'Flag for Investigation'}</span>
                    </button>

                    {selectedComplaint.isSuspicious && !selectedComplaint.dismissedSuspiciousFlags && (
                      <>
                        <button
                          type="button"
                          onClick={handleDismissSuspiciousFlag}
                          className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Dismiss Suspicious Flag</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setCorrectionReason(
                              'Please upload a clear, original photograph taken directly at the location of the issue.'
                            );
                            setShowCorrectionModal(true);
                          }}
                          className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                          <span>Request Photo Correction</span>
                        </button>
                      </>
                    )}

                    {selectedComplaint.visualCategorySuggested &&
                      selectedComplaint.visualCategorySuggested !== 'Uncertain' &&
                      selectedComplaint.visualCategorySuggested !== selectedComplaint.category && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewCategory(selectedComplaint.visualCategorySuggested as ComplaintCategory);
                          }}
                          className="px-3 py-1.5 bg-teal-100 hover:bg-teal-200 text-teal-900 border border-teal-300 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                          <span>Reassign to {selectedComplaint.visualCategorySuggested}</span>
                        </button>
                      )}
                  </div>
                </div>
              )}
            </div>

            {/* Completion Evidence Review (If worker submitted) */}
            {(selectedComplaint.completionNotes || (selectedComplaint.completionImageIds && selectedComplaint.completionImageIds.length > 0)) && (
              <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-300 space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                  <h3 className="font-bold text-emerald-950 text-sm flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-700" />
                    <span>Worker Completion Evidence</span>
                  </h3>
                  {selectedComplaint.completionAwaitingReview && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px]">
                      Awaiting Manager Verification
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="font-semibold text-slate-700">Worker Notes:</span>
                  <p className="p-2.5 bg-white rounded-lg border border-emerald-200 text-slate-800">
                    {selectedComplaint.completionNotes || 'No notes entered.'}
                  </p>
                </div>

                {selectedComplaint.completionImageIds && selectedComplaint.completionImageIds.length > 0 && (
                  <div className="space-y-1">
                    <span className="font-semibold text-slate-700">Evidence Photos:</span>
                    <ImageViewer imageIds={selectedComplaint.completionImageIds} />
                  </div>
                )}

                {/* Worker Completion GPS Verification & Discrepancy Inspector */}
                {(selectedComplaint.completionLatitude !== undefined && selectedComplaint.completionLongitude !== undefined) && (
                  <div className="p-3 bg-white rounded-xl border border-emerald-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                        <Navigation className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Worker Resolution GPS Verification</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono text-[10px] font-bold">
                        {formatCoordinates(selectedComplaint.completionLatitude, selectedComplaint.completionLongitude)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
                      <span>
                        GPS Accuracy: ±{Math.round(selectedComplaint.completionAccuracy || 0)}m
                      </span>
                      {selectedComplaint.completionDistanceToIssueMeters !== undefined && (
                        <span>
                          Distance to Reported Issue: <strong>~{selectedComplaint.completionDistanceToIssueMeters} meters</strong>
                        </span>
                      )}
                    </div>

                    {/* Location Discrepancy Warning */}
                    {selectedComplaint.completionLocationDiscrepancy && (
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2 mt-1">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Location Discrepancy Flag:</strong> Worker resolution photo was recorded ~{selectedComplaint.completionDistanceToIssueMeters}m away from the original issue coordinates (community threshold: 250m). Please inspect completion evidence carefully before approving.
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Manager actions on evidence */}
                {selectedComplaint.status !== 'Resolved' && selectedComplaint.status !== 'Closed' && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-emerald-200">
                    <button
                      type="button"
                      onClick={handleApproveCompletion}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Approve & Mark Resolved</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCorrectionModal(true)}
                      className="px-4 py-2 bg-white hover:bg-slate-100 text-amber-900 border border-amber-400 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4 text-amber-700" />
                      <span>Return for Correction</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Triage: Category & Priority Controls */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                1. Triage & Priority
              </h3>

              {prioritySuggestion && (
                <div className="p-2.5 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-900 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Suggested Priority: {prioritySuggestion.priority}</span> — {prioritySuggestion.reason}
                    {newPriority !== prioritySuggestion.priority && (
                      <button
                        type="button"
                        onClick={() => setNewPriority(prioritySuggestion.priority)}
                        className="ml-2 font-bold underline text-teal-800 hover:text-teal-950"
                      >
                        Apply suggestion
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as ComplaintCategory)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none bg-white"
                  >
                    {COMPLAINT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Operational Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as ComplaintPriority)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none bg-white"
                  >
                    {COMPLAINT_PRIORITIES.map((pr) => (
                      <option key={pr} value={pr}>{pr}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleUpdateTriage}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold"
                >
                  Save Triage Changes
                </button>
              </div>
            </div>

            {/* Worker Assignment */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                2. Assign Maintenance Worker
              </h3>

              {/* Smart Worker Recommendation Engine */}
              {workerRecommendations.length > 0 && (
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                    AI Worker Recommendation Engine (Ranked by Category, Skills, Workload & Rating):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {workerRecommendations.slice(0, 3).map((rec, idx) => (
                      <div
                        key={rec.worker.id}
                        className={`p-3 rounded-xl border text-xs space-y-1.5 transition-all ${
                          selectedWorkerId === rec.worker.id
                            ? 'bg-teal-50/80 border-teal-500 ring-1 ring-teal-500'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-slate-100 font-bold text-[10px] flex items-center justify-center text-slate-700">
                              #{idx + 1}
                            </span>
                            <strong className="text-slate-900">{rec.worker.name}</strong>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 font-bold text-[10px]">
                            {rec.matchScore}% Match
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {rec.worker.specialty} • Active: {rec.activeTaskCount}
                        </div>
                        <div className="flex flex-wrap gap-1 text-[10px]">
                          {rec.reasons.map((r, rIdx) => (
                            <span key={rIdx} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              ✓ {r}
                            </span>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedWorkerId(rec.worker.id)}
                          className={`w-full py-1.5 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                            selectedWorkerId === rec.worker.id
                              ? 'bg-teal-800 text-white'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                          }`}
                        >
                          {selectedWorkerId === rec.worker.id ? 'Selected' : 'Select Worker'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {workers.length === 0 ? (
                <div className="text-xs text-amber-800 p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                  No worker profiles available. Please create workers in the Workers tab before assigning.
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={selectedWorkerId}
                    onChange={(e) => setSelectedWorkerId(e.target.value)}
                    className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none bg-white"
                  >
                    <option value="">-- Select an Active Worker --</option>
                    {workers
                      .filter((w) => w.active)
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} — Specialty: {w.specialty}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAssignWorker}
                    disabled={!selectedWorkerId}
                    className="px-4 py-2 bg-teal-800 hover:bg-teal-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>{selectedComplaint.assignedWorkerId ? 'Reassign Worker' : 'Assign Worker'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Updates & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Internal Note (Hidden from resident) */}
              <form onSubmit={handleAddInternalNote} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 uppercase tracking-wider">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Internal Management Note</span>
                </div>
                <textarea
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  placeholder="Private notes (vendor quotes, internal delay explanations, strictly hidden from resident)..."
                  rows={2}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none bg-white"
                />
                <button
                  type="submit"
                  disabled={!internalNote.trim()}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  Log Internal Note
                </button>
              </form>

              {/* Resident-Visible Update */}
              <form onSubmit={handleAddPublicUpdate} className="p-4 bg-teal-50/50 rounded-2xl border border-teal-200 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-teal-950 uppercase tracking-wider">
                  <Globe className="w-3.5 h-3.5 text-teal-700" />
                  <span>Resident-Visible Update</span>
                </div>
                <textarea
                  value={publicUpdate}
                  onChange={(e) => setPublicUpdate(e.target.value)}
                  placeholder="Inform the resident of inspection schedule, parts arrival, or progress..."
                  rows={2}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none bg-white"
                />
                <button
                  type="submit"
                  disabled={!publicUpdate.trim()}
                  className="px-3 py-1.5 bg-teal-800 hover:bg-teal-700 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  Post Resident Update
                </button>
              </form>
            </div>

            {/* Rejection Option */}
            {selectedComplaint.status !== 'Closed' && selectedComplaint.status !== 'Rejected' && (
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 flex items-center justify-between text-xs">
                <span className="text-rose-900">
                  If this issue is invalid, outside community purview, or duplicated:
                </span>
                <button
                  type="button"
                  onClick={() => setShowRejectModal(true)}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold"
                >
                  Reject Complaint
                </button>
              </div>
            )}

            {/* Timeline View (Includes Internal Notes for Managers) */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                Full Activity History ({complaintEvents.length} events)
              </h3>
              <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                {complaintEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className={`p-2.5 rounded-lg text-xs border ${
                      ev.visibility === 'internal'
                        ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold mb-0.5">
                      <span className="flex items-center gap-1">
                        {ev.visibility === 'internal' && <Lock className="w-3 h-3 text-amber-700" />}
                        <span>{ev.action}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {new Date(ev.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mb-1">
                      By {ev.actorName} ({ev.actorRole})
                    </div>
                    {ev.note && <div className="text-slate-700">{ev.note}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject Maintenance Complaint"
        maxWidth="md"
      >
        <form onSubmit={handleReject} className="space-y-3">
          <p className="text-xs text-slate-600">
            A visible rejection reason is strictly required so the reporting resident understands why this report could not be acted upon.
          </p>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Issue falls under private flat owner responsibility rather than community common areas..."
              rows={3}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowRejectModal(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!rejectReason.trim()}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold disabled:opacity-50"
            >
              Confirm Rejection
            </button>
          </div>
        </form>
      </Modal>

      {/* Return for Correction Modal */}
      <Modal
        isOpen={showCorrectionModal}
        onClose={() => setShowCorrectionModal(false)}
        title="Return Work for Correction"
        maxWidth="md"
      >
        <form onSubmit={handleReturnForCorrection} className="space-y-3">
          <p className="text-xs text-slate-600">
            Explain to the field worker what deficiencies were found in the repair or completion photos so they can correct them.
          </p>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Correction Reason / Instructions <span className="text-red-500">*</span>
            </label>
            <textarea
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              placeholder="e.g. Debris around the valve not cleaned, or seal is still dripping..."
              rows={3}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowCorrectionModal(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!correctionReason.trim()}
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold disabled:opacity-50"
            >
              Send Correction Request
            </button>
          </div>
        </form>
      </Modal>

      {/* Priority Override Modal */}
      <Modal
        isOpen={showOverrideModal}
        onClose={() => setShowOverrideModal(false)}
        title="Override Operational Priority"
        maxWidth="md"
      >
        <form onSubmit={handleApplyPriorityOverride} className="space-y-4 text-xs">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
            <strong>Manager Override Policy:</strong> Adjusting system priority requires a documented justification reason that is permanently recorded in the audit trail.
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Target Priority Level <span className="text-red-500">*</span>
            </label>
            <select
              value={overrideNewLevel}
              onChange={(e) => setOverrideNewLevel(e.target.value as any)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-1 focus:ring-teal-700 bg-white"
            >
              <option value="Low">Low Priority (0 - 29 pts)</option>
              <option value="Medium">Medium Priority (30 - 49 pts)</option>
              <option value="High">High Priority (50 - 74 pts)</option>
              <option value="Critical">Critical Priority (75 - 100 pts)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Mandatory Override Justification <span className="text-red-500">*</span>
            </label>
            <textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="e.g. Elderly resident lives alone on 4th floor; expedited response required regardless of standard queue position..."
              rows={3}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-1 focus:ring-teal-700 bg-white"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowOverrideModal(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!overrideReason.trim()}
              className="px-4 py-2 bg-teal-800 hover:bg-teal-700 text-white rounded-xl font-bold disabled:opacity-50 cursor-pointer"
            >
              Confirm & Save Override
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
