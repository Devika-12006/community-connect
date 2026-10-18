import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { repository } from '../../db/repository';
import type { Complaint, ComplaintEvent } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PriorityBadge } from '../../components/common/PriorityBadge';
import { ImageViewer } from '../../components/common/ImageViewer';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Wrench,
  Send,
  RotateCcw,
  CheckCircle,
  Star,
  XCircle,
  Check,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';

export const ComplaintDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeResident, refreshAll } = useApp();

  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [events, setEvents] = useState<ComplaintEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Resident update note state
  const [updateNote, setUpdateNote] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Reopen modal state
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenError, setReopenError] = useState('');

  // Rating & feedback state
  const [rating, setRating] = useState<number>(0);
  const [feedback, setFeedback] = useState('');
  const [ratingSaved, setRatingSaved] = useState(false);
  const [isSavingRating, setIsSavingRating] = useState(false);

  const loadComplaintData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const c = await repository.getComplaint(id);
      setComplaint(c);
      if (c) {
        setRating(c.rating || 0);
        setFeedback(c.ratingFeedback || '');
        const allEvents = await repository.getEvents(id);
        // STRICT RESIDENT PRIVACY: Internal notes must NOT appear in resident views
        const residentVisibleEvents = allEvents.filter((ev) => ev.visibility !== 'internal');
        setEvents(residentVisibleEvents);
      }
    } catch (err) {
      console.error('Failed to load complaint:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadComplaintData();
  }, [loadComplaintData]);

  if (loading) {
    return (
      <div className="py-12 text-center text-xs text-slate-500">
        Loading complaint details...
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="max-w-md mx-auto py-12 text-center">
        <h2 className="text-lg font-bold text-slate-900 mb-2">Complaint Not Found</h2>
        <p className="text-xs text-slate-500 mb-4">The requested maintenance record does not exist or has been removed.</p>
        <Link to="/resident/complaints" className="px-4 py-2 bg-teal-800 text-white rounded-lg text-xs font-bold">
          Return to My Complaints
        </Link>
      </div>
    );
  }

  // Verify resident ownership
  const isOwner = activeResident && activeResident.id === complaint.residentId;

  // Add resident update note
  const handleAddUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateNote.trim() || !activeResident) return;

    setIsSubmittingNote(true);
    try {
      const now = new Date().toISOString();
      await repository.addEvent({
        id: crypto.randomUUID(),
        complaintId: complaint.id,
        eventType: 'ResidentUpdate',
        action: 'Resident Added Update',
        actorRole: 'Resident',
        actorName: activeResident.displayName,
        visibility: 'public',
        note: updateNote.trim(),
        createdAt: now,
      });

      // Notify Manager
      await repository.addNotification({
        id: crypto.randomUUID(),
        recipientRole: 'Manager',
        complaintId: complaint.id,
        title: `Update on ${complaint.reference}`,
        message: `${activeResident.displayName} added a note: "${updateNote.trim()}"`,
        createdAt: now,
      });

      setUpdateNote('');
      await loadComplaintData();
      await refreshAll();
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // Confirm Resolution (Resolved -> Closed)
  const handleConfirmResolution = async () => {
    if (!activeResident) return;
    const now = new Date().toISOString();
    const updated: Complaint = {
      ...complaint,
      status: 'Closed',
      closedAt: now,
      updatedAt: now,
    };
    await repository.saveComplaint(updated);

    await repository.addEvent({
      id: crypto.randomUUID(),
      complaintId: complaint.id,
      eventType: 'Closed',
      action: 'Resolution Confirmed & Closed',
      actorRole: 'Resident',
      actorName: activeResident.displayName,
      visibility: 'public',
      note: 'Resident confirmed satisfactory resolution. Ticket is now closed.',
      createdAt: now,
    });

    await repository.addNotification({
      id: crypto.randomUUID(),
      recipientRole: 'Manager',
      complaintId: complaint.id,
      title: `Complaint Closed: ${complaint.reference}`,
      message: `${activeResident.displayName} confirmed resolution for "${complaint.title}".`,
      createdAt: now,
    });

    await loadComplaintData();
    await refreshAll();
  };

  // Reopen Complaint
  const handleReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenReason.trim() || !activeResident) {
      setReopenError('Please explain why the issue needs to be reopened.');
      return;
    }

    const now = new Date().toISOString();
    const updated: Complaint = {
      ...complaint,
      status: 'Reopened',
      reopenReason: reopenReason.trim(),
      updatedAt: now,
    };
    await repository.saveComplaint(updated);

    await repository.addEvent({
      id: crypto.randomUUID(),
      complaintId: complaint.id,
      eventType: 'Reopened',
      action: 'Complaint Reopened',
      actorRole: 'Resident',
      actorName: activeResident.displayName,
      visibility: 'public',
      note: `Resident reopened ticket: ${reopenReason.trim()}`,
      createdAt: now,
    });

    // Notify Manager
    await repository.addNotification({
      id: crypto.randomUUID(),
      recipientRole: 'Manager',
      complaintId: complaint.id,
      title: `Ticket Reopened: ${complaint.reference}`,
      message: `${activeResident.displayName} reopened complaint with note: "${reopenReason.trim()}".`,
      createdAt: now,
    });

    // If a worker was assigned, notify them too per requirements
    if (complaint.assignedWorkerId) {
      await repository.addNotification({
        id: crypto.randomUUID(),
        recipientRole: 'Worker',
        recipientId: complaint.assignedWorkerId,
        complaintId: complaint.id,
        title: `Task Reopened: ${complaint.reference}`,
        message: `Resident reopened "${complaint.title}": "${reopenReason.trim()}".`,
        createdAt: now,
      });
    }

    setShowReopenModal(false);
    setReopenReason('');
    setReopenError('');
    await loadComplaintData();
    await refreshAll();
  };

  // Save Feedback & Rating
  const handleSaveRating = async () => {
    if (rating === 0) return;
    setIsSavingRating(true);
    const now = new Date().toISOString();
    const updated: Complaint = {
      ...complaint,
      rating,
      ratingFeedback: feedback.trim() || undefined,
      ratingUpdatedAt: now,
      updatedAt: now,
    };
    await repository.saveComplaint(updated);

    await repository.addEvent({
      id: crypto.randomUUID(),
      complaintId: complaint.id,
      eventType: 'ResidentUpdate',
      action: 'Resident Rated Resolution',
      actorRole: 'Resident',
      actorName: activeResident?.displayName || 'Resident',
      visibility: 'public',
      note: `Rating: ${rating}/5 stars.${feedback.trim() ? ` Comment: "${feedback.trim()}"` : ''}`,
      createdAt: now,
    });

    setRatingSaved(true);
    setTimeout(() => setRatingSaved(false), 3000);
    setIsSavingRating(false);
    await loadComplaintData();
    await refreshAll();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back Button */}
      <button
        type="button"
        onClick={() => navigate('/resident/complaints')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 hover:text-teal-900 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to My Complaints</span>
      </button>

      {/* Main Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                {complaint.reference}
              </span>
              <span className="text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                {complaint.category}
              </span>
              <PriorityBadge priority={complaint.priority} />
              {complaint.source && (complaint.source === 'WhatsApp' || complaint.source === 'Mock WhatsApp') && (
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded">
                  WhatsApp
                </span>
              )}
            </div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900">{complaint.title}</h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={complaint.status} size="lg" showFullLabel />
          </div>
        </div>

        {complaint.matchReason && (
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <span>AI Dispatch & Verification Note:</span>
              {complaint.matchScore !== undefined && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-mono text-[10px]">
                  {complaint.matchScore}% confidence
                </span>
              )}
            </div>
            <p className="text-emerald-800 leading-relaxed">{complaint.matchReason}</p>
          </div>
        )}

        {/* Location & Metadata Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <MapPin className="w-4 h-4 text-teal-700 shrink-0" />
            <div className="truncate">
              <div className="font-semibold text-slate-800">{complaint.block}</div>
              <div className="text-[11px] text-slate-500 truncate">{complaint.specificLocation}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <Calendar className="w-4 h-4 text-teal-700 shrink-0" />
            <div>
              <div className="font-semibold text-slate-800">Submitted On</div>
              <div className="text-[11px] text-slate-500">
                {new Date(complaint.createdAt).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <Wrench className="w-4 h-4 text-teal-700 shrink-0" />
            <div>
              <div className="font-semibold text-slate-800">Assigned Worker</div>
              <div className="text-[11px] text-slate-500">
                {complaint.assignedWorkerName ? complaint.assignedWorkerName : 'Pending Assignment'}
              </div>
            </div>
          </div>
        </div>

        {/* Rejection / Correction Callout */}
        {complaint.status === 'Rejected' && complaint.rejectionReason && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900">
            <div className="font-bold flex items-center gap-1.5 mb-1">
              <XCircle className="w-4 h-4 text-rose-700" />
              <span>Complaint Rejected by Management</span>
            </div>
            <p className="text-[11px] text-rose-800">{complaint.rejectionReason}</p>
          </div>
        )}

        {/* Detailed Description */}
        <div className="space-y-1.5 pt-1">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Issue Description
          </div>
          <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {complaint.description}
          </p>
        </div>

        {/* Attached Photos */}
        {complaint.originalImageIds.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Submitted Photographs ({complaint.originalImageIds.length})
            </div>
            <ImageViewer imageIds={complaint.originalImageIds} />
          </div>
        )}
      </div>

      {/* Completion Evidence Section (When worker submits or complaint is resolved) */}
      {(complaint.completionNotes || (complaint.completionImageIds && complaint.completionImageIds.length > 0)) && (
        <div className="bg-white rounded-2xl border border-emerald-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-700" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Worker Completion Evidence
              </h2>
            </div>
            {complaint.completionAwaitingReview && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                Evidence Awaiting Manager Review
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Worker Notes:</span>
            <p className="text-xs sm:text-sm text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
              {complaint.completionNotes || 'No written notes provided.'}
            </p>
          </div>

          {complaint.completionImageIds && complaint.completionImageIds.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Resolution Proof Photos ({complaint.completionImageIds.length}):
              </span>
              <ImageViewer imageIds={complaint.completionImageIds} />
            </div>
          )}

          {/* Action to confirm resolution or reopen */}
          {isOwner && complaint.status === 'Resolved' && (
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-3 pt-3">
              <div className="text-xs text-emerald-900">
                <span className="font-bold">Are you satisfied with the repair?</span> Confirming resolution will officially close this ticket.
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowReopenModal(true)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Request Reopen
                </button>
                <button
                  type="button"
                  onClick={handleConfirmResolution}
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  Confirm Resolution & Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Post-Resolution Rating & Feedback (Editable per requirements) */}
      {isOwner && (complaint.status === 'Resolved' || complaint.status === 'Closed') && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Rate Resolution Quality
              </h2>
            </div>
            {complaint.status === 'Closed' && (
              <button
                type="button"
                onClick={() => setShowReopenModal(true)}
                className="text-xs text-amber-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reopen Issue</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <span className="text-xs font-semibold text-slate-700 block mb-1">
                Your Rating (1–5 Stars)
              </span>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRating(s)}
                    className="p-1.5 rounded-lg hover:bg-amber-50 transition-colors cursor-pointer"
                    aria-label={`Rate ${s} star${s > 1 ? 's' : ''}`}
                  >
                    <Star
                      className={`w-7 h-7 ${
                        rating >= s
                          ? 'text-amber-500 fill-amber-500'
                          : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-xs font-bold text-slate-600 ml-2">
                  {rating > 0 ? `${rating} of 5 stars` : 'Select a rating'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Optional Feedback or Comments
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Share thoughts on the timeliness or workmanship..."
                rows={2}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-1 focus:ring-teal-700 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-400">
                You can edit your rating or feedback at any time.
              </span>
              <button
                type="button"
                disabled={rating === 0 || isSavingRating}
                onClick={handleSaveRating}
                className="px-4 py-2 bg-teal-800 hover:bg-teal-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {ratingSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>{complaint.rating ? 'Update Feedback' : 'Submit Feedback'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resident Update Section */}
      {isOwner && complaint.status !== 'Closed' && complaint.status !== 'Rejected' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <form onSubmit={handleAddUpdate} className="space-y-3">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Add Update to Your Complaint
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={updateNote}
                onChange={(e) => setUpdateNote(e.target.value)}
                placeholder="e.g. Issue is worsening after rainfall, or additional detail..."
                className="flex-1 text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!updateNote.trim() || isSubmittingNote}
                className="px-4 py-2.5 bg-teal-800 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Note</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Notes added here are logged in the public activity timeline and notify community managers.
            </p>
          </form>
        </div>
      )}

      {/* Public Activity Timeline */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm sm:text-base font-bold text-slate-900">
            Activity Timeline & Progress History
          </h2>
          <span className="text-xs text-slate-400 font-medium">
            {events.length} event{events.length !== 1 ? 's' : ''}
          </span>
        </div>

        {events.length === 0 ? (
          <div className="text-xs text-slate-500 italic py-3 text-center">
            No activity events recorded yet.
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {events.map((ev) => (
              <div key={ev.id} className="relative text-xs">
                <div className="absolute -left-6 top-0.5 w-3 h-3 rounded-full bg-teal-700 ring-4 ring-white" />
                <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                  <span className="font-bold text-slate-900">{ev.action}</span>
                  <span className="text-[11px] text-slate-400">
                    {new Date(ev.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="text-slate-500 mb-1">
                  By <span className="font-semibold text-slate-700">{ev.actorName}</span> ({ev.actorRole})
                </div>
                {ev.note && (
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-slate-700">
                    {ev.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reopen Modal */}
      <Modal
        isOpen={showReopenModal}
        onClose={() => setShowReopenModal(false)}
        title="Reopen Maintenance Complaint"
        maxWidth="md"
      >
        <form onSubmit={handleReopen} className="space-y-4">
          <p className="text-xs text-slate-600">
            If the repair was incomplete or the issue has recurred, please explain the current condition.
          </p>

          {reopenError && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-medium">
              {reopenError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Reason for Reopening <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="e.g. The leak resumed after high water pressure this morning..."
              rows={3}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-teal-700 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowReopenModal(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs"
            >
              Confirm Reopen
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
