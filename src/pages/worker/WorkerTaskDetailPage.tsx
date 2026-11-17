import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { repository } from '../../db/repository';
import type { Complaint, ComplaintEvent, ImageAsset, GeoLocationData } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PriorityBadge } from '../../components/common/PriorityBadge';
import { ImageViewer } from '../../components/common/ImageViewer';
import { LiveCameraModal, type LiveCaptureResult } from '../../components/camera/LiveCameraModal';
import { createCaptureSession, validateAndConsumeSession } from '../../services/captureSessionService';
import { checkLocationDiscrepancy } from '../../lib/geoUtils';
import {
  ArrowLeft,
  Play,
  CheckCircle,
  MapPin,
  Calendar,
  AlertTriangle,
  X,
  Send,
  Camera,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';

interface CompletionImageFile {
  id: string;
  rawBlob: Blob;
  stampedBlob?: Blob;
  previewUrl: string;
  fileName: string;
  geo?: GeoLocationData;
  captureSessionId?: string;
  discrepancy?: {
    isDiscrepancy: boolean;
    distanceMeters: number;
    workerDistanceToIssue?: number;
  };
}

export const WorkerTaskDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeWorker, refreshAll } = useApp();

  const [task, setTask] = useState<Complaint | null>(null);
  const [events, setEvents] = useState<ComplaintEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Progress update state
  const [progressNote, setProgressNote] = useState('');
  const [isSubmittingProgress, setIsSubmittingProgress] = useState(false);

  // Completion submission state
  const [completionNote, setCompletionNote] = useState('');
  const [completionImages, setCompletionImages] = useState<CompletionImageFile[]>([]);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [dragOrPasteNotice, setDragOrPasteNotice] = useState<string | null>(null);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      completionImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
  }, [completionImages]);

  const loadTaskData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const c = await repository.getComplaint(id);
      setTask(c);
      if (c) {
        const evs = await repository.getEvents(id);
        // Exclude internal management notes from worker view
        setEvents(evs.filter((ev) => ev.visibility !== 'internal'));
      }
    } catch (err) {
      console.error('Failed to load task:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadTaskData();
  }, [loadTaskData]);

  if (loading) {
    return <div className="py-12 text-center text-xs text-slate-500">Loading task details...</div>;
  }

  if (!task) {
    return (
      <div className="max-w-md mx-auto py-12 text-center">
        <h2 className="text-base font-bold text-slate-900 mb-2">Task Not Found</h2>
        <Link to="/worker/tasks" className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold">
          Return to My Tasks
        </Link>
      </div>
    );
  }

  // Security / Role check: must be assigned to active worker
  if (!activeWorker || task.assignedWorkerId !== activeWorker.id) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto mb-2" />
        <h2 className="text-base font-bold text-slate-900 mb-1">Access Restricted</h2>
        <p className="text-xs text-slate-500 mb-4">
          This task is not assigned to the currently selected worker ({activeWorker?.name || 'None'}).
        </p>
        <Link to="/worker/tasks" className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold">
          View My Tasks
        </Link>
      </div>
    );
  }

  // Action: Start Work
  const handleStartWork = async () => {
    const now = new Date().toISOString();
    const updated: Complaint = {
      ...task,
      status: 'In Progress',
      updatedAt: now,
    };
    await repository.saveComplaint(updated);

    await repository.addEvent({
      id: crypto.randomUUID(),
      complaintId: task.id,
      eventType: 'WorkStarted',
      action: 'Work Started by Technician',
      actorRole: 'Worker',
      actorName: activeWorker.name,
      visibility: 'public',
      note: `Maintenance worker ${activeWorker.name} has begun work on this issue.`,
      createdAt: now,
    });

    // Notify Resident
    await repository.addNotification({
      id: crypto.randomUUID(),
      recipientRole: 'Resident',
      recipientId: task.residentId,
      complaintId: task.id,
      title: `Work Started: ${task.reference}`,
      message: `${activeWorker.name} has started work on "${task.title}".`,
      createdAt: now,
    });

    await loadTaskData();
    await refreshAll();
  };

  // Action: Add Progress Update
  const handleAddProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!progressNote.trim()) return;

    setIsSubmittingProgress(true);
    try {
      const now = new Date().toISOString();
      await repository.addEvent({
        id: crypto.randomUUID(),
        complaintId: task.id,
        eventType: 'ProgressUpdate',
        action: 'Worker Progress Update',
        actorRole: 'Worker',
        actorName: activeWorker.name,
        visibility: 'public',
        note: progressNote.trim(),
        createdAt: now,
      });

      // Notify Manager
      await repository.addNotification({
        id: crypto.randomUUID(),
        recipientRole: 'Manager',
        complaintId: task.id,
        title: `Worker Progress: ${task.reference}`,
        message: `${activeWorker.name} logged an update: "${progressNote.trim()}"`,
        createdAt: now,
      });

      setProgressNote('');
      await loadTaskData();
      await refreshAll();
    } catch (err) {
      console.error('Failed to log progress:', err);
    } finally {
      setIsSubmittingProgress(false);
    }
  };

  // In-app live camera capture for worker completion evidence
  const handlePhotoCaptured = async (result: LiveCaptureResult) => {
    setCompletionError(null);
    if (!activeWorker || !task) return;

    try {
      // 1. Authoritative Capture Session
      const session = createCaptureSession({
        userId: activeWorker.id,
        role: 'Worker',
        communityId: 'default',
        draftType: 'worker_completion',
        draftId: task.id,
      });

      const validation = await validateAndConsumeSession({
        sessionId: session.id,
        token: session.token,
        userId: activeWorker.id,
        role: 'Worker',
        draftId: task.id,
        imageBlob: result.rawBlob,
        geoData: result.geoData,
      });

      if (!validation.valid) {
        setCompletionError(validation.error);
        return;
      }

      // 2. Check location discrepancy against original complaint coordinates
      const taskCoords =
        task.latitude !== undefined && task.longitude !== undefined
          ? { latitude: task.latitude, longitude: task.longitude, accuracy: 50 }
          : null;

      const discrepancyCheck = result.geoData
        ? checkLocationDiscrepancy(
            {
              latitude: result.geoData.latitude,
              longitude: result.geoData.longitude,
              accuracy: result.geoData.accuracy,
            },
            taskCoords,
            250 // 250m community tolerance
          )
        : undefined;

      const newRecord: CompletionImageFile = {
        id: crypto.randomUUID(),
        rawBlob: result.rawBlob,
        stampedBlob: result.stampedBlob,
        previewUrl: result.previewUrl,
        fileName: `completion_proof_${Date.now().toString().slice(-6)}.jpg`,
        geo: result.geoData,
        captureSessionId: session.id,
        discrepancy: discrepancyCheck,
      };

      setCompletionImages((prev) => [...prev, newRecord]);
    } catch (err: any) {
      console.error('Failed to capture completion photo:', err);
      setCompletionError(err.message || 'Error capturing completion photo.');
    }
  };

  const handleRemoveImage = (id: string) => {
    setCompletionImages((prev) => {
      const filtered = prev.filter((img) => img.id !== id);
      const target = prev.find((img) => img.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return filtered;
    });
  };

  // Action: Submit Completion for Manager Review
  const handleSubmitCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompletionError(null);

    // Rule requirement: Require at least one completion image and a note!
    if (completionImages.length === 0) {
      setCompletionError('At least one completion photograph is required as visual evidence.');
      return;
    }

    if (!completionNote.trim()) {
      setCompletionError('Please enter a completion note explaining the repairs performed.');
      return;
    }

    setIsSubmittingCompletion(true);
    try {
      const imageIds: string[] = [];
      let primaryGeo: GeoLocationData | undefined;
      let primaryDiscrepancy: { isDiscrepancy: boolean; distanceMeters: number } | undefined;

      for (const img of completionImages) {
        const asset: ImageAsset = {
          id: img.id,
          blob: img.rawBlob,
          stampedBlob: img.stampedBlob,
          mimeType: 'image/jpeg',
          originalName: img.fileName,
          size: img.rawBlob.size,
          createdAt: new Date().toISOString(),
          captureSessionId: img.captureSessionId,
          latitude: img.geo?.latitude,
          longitude: img.geo?.longitude,
          accuracy: img.geo?.accuracy,
          address: img.geo?.address,
          locationTimestamp: img.geo?.locationTimestamp,
          clientCaptureTimestamp: img.geo?.clientCaptureTimestamp,
          serverReceivedTimestamp: img.geo?.serverReceivedTimestamp,
          isLiveCapture: true,
        };
        await repository.saveImage(asset);
        imageIds.push(img.id);

        if (img.geo && !primaryGeo) {
          primaryGeo = img.geo;
        }
        if (img.discrepancy && !primaryDiscrepancy) {
          primaryDiscrepancy = img.discrepancy;
        }
      }

      const now = new Date().toISOString();
      const hasDiscrepancy = !!primaryDiscrepancy?.isDiscrepancy;
      const discrepancyDist = primaryDiscrepancy ? Math.round(primaryDiscrepancy.distanceMeters) : undefined;

      // Keep status as In Progress while evidence awaits approval per requirements
      const updated: Complaint = {
        ...task,
        status: 'In Progress',
        completionAwaitingReview: true,
        completionNotes: completionNote.trim(),
        completionImageIds: imageIds,
        completionSubmittedAt: now,
        completionLatitude: primaryGeo?.latitude,
        completionLongitude: primaryGeo?.longitude,
        completionAccuracy: primaryGeo?.accuracy,
        completionDistanceToIssueMeters: discrepancyDist,
        completionLocationDiscrepancy: hasDiscrepancy,
        isSuspicious: hasDiscrepancy ? true : task.isSuspicious,
        suspiciousFlags: hasDiscrepancy
          ? [
              ...(task.suspiciousFlags || []),
              {
                type: 'LOCATION_DISCREPANCY',
                severity: 'warning',
                details: `Worker completion photo was recorded ~${discrepancyDist}m from reported complaint coordinates.`,
              },
            ]
          : task.suspiciousFlags,
        correctionReason: undefined, // Clear past correction request
        updatedAt: now,
      };

      await repository.saveComplaint(updated);

      await repository.addEvent({
        id: crypto.randomUUID(),
        complaintId: task.id,
        eventType: 'CompletionSubmitted',
        action: 'Completion Evidence Submitted',
        actorRole: 'Worker',
        actorName: activeWorker.name,
        visibility: 'public',
        note: `Worker submitted resolution evidence with ${imageIds.length} photo(s). Note: "${completionNote.trim()}"`,
        createdAt: now,
      });

      // Notify Manager
      await repository.addNotification({
        id: crypto.randomUUID(),
        recipientRole: 'Manager',
        complaintId: task.id,
        title: `Evidence Awaiting Review: ${task.reference}`,
        message: `${activeWorker.name} has submitted completion proof for "${task.title}".`,
        createdAt: now,
      });

      setCompletionNote('');
      setCompletionImages([]);
      await loadTaskData();
      await refreshAll();
    } catch (err) {
      console.error('Failed to submit completion:', err);
      setCompletionError('Failed to save completion proof. Please try again.');
    } finally {
      setIsSubmittingCompletion(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button
        type="button"
        onClick={() => navigate('/worker/tasks')}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to My Tasks</span>
      </button>

      {/* Task Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                {task.reference}
              </span>
              <span className="text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                {task.category}
              </span>
              <PriorityBadge priority={task.priority} />
              {task.completionAwaitingReview && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold">
                  Completion Awaiting Review
                </span>
              )}
            </div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900">{task.title}</h1>
          </div>

          <StatusBadge status={task.status} size="md" showFullLabel />
        </div>

        {/* Manager Correction Alert if present */}
        {task.correctionReason && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-800">
              <RotateCcw className="w-4 h-4" />
              <span>Manager Requested Corrections</span>
            </div>
            <p className="text-slate-700 bg-white p-2.5 rounded-lg border border-amber-200">
              {task.correctionReason}
            </p>
            <p className="text-[11px] text-amber-800 italic pt-1">
              Please perform the required adjustments and submit new completion evidence below.
            </p>
          </div>
        )}

        {/* Location & Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <MapPin className="w-4 h-4 text-teal-700 shrink-0" />
            <div>
              <div className="font-bold text-slate-800">{task.block}</div>
              <div className="text-[11px] text-slate-500">{task.specificLocation}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <div className="font-bold text-slate-800">Reported By</div>
              <div className="text-[11px] text-slate-500">{task.residentName} (Flat {task.residentFlat})</div>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1 pt-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Resident&apos;s Description
          </span>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 whitespace-pre-wrap">
            {task.description}
          </p>
        </div>

        {/* Resident Submitted Photos */}
        {task.originalImageIds.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Resident Attached Photos ({task.originalImageIds.length})
            </span>
            <ImageViewer imageIds={task.originalImageIds} />
          </div>
        )}

        {/* Start Work CTA if still in Assigned state */}
        {task.status === 'Assigned' && (
          <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 flex flex-col sm:flex-row items-center justify-between gap-3 pt-3">
            <div className="text-xs text-teal-950">
              <span className="font-bold block">Ready to start?</span>
              Clicking below transitions this complaint to &quot;In Progress&quot; and notifies the resident that work has commenced.
            </div>
            <button
              type="button"
              onClick={handleStartWork}
              className="px-5 py-2.5 bg-teal-800 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Start Work</span>
            </button>
          </div>
        )}
      </div>

      {/* Progress Updates Section */}
      {task.status === 'In Progress' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Post Progress Note
          </h2>
          <form onSubmit={handleAddProgress} className="space-y-2">
            <input
              type="text"
              value={progressNote}
              onChange={(e) => setProgressNote(e.target.value)}
              placeholder="e.g. Cleared blockage, waiting for area to dry before final inspection..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-amber-600 focus:outline-none"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!progressNote.trim() || isSubmittingProgress}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Log Progress Note</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Completion Evidence Submission Section */}
      {task.status === 'In Progress' && (
        <div className="bg-white rounded-2xl border border-amber-300 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="border-b border-amber-100 pb-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <Camera className="w-4 h-4 text-amber-600" />
              <span>Submit Completion Evidence for Manager Verification</span>
            </h2>
            <p className="text-xs text-slate-500">
              Upload at least one clear photograph of the completed repair and enter a note.
            </p>
          </div>

          {completionError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold">
              {completionError}
            </div>
          )}

          <form onSubmit={handleSubmitCompletion} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Completion Note <span className="text-red-500">*</span>
              </label>
              <textarea
                value={completionNote}
                onChange={(e) => setCompletionNote(e.target.value)}
                placeholder="Explain the repair details (e.g. replaced worn rubber gasket and verified zero leakage at 4.5 bar pressure)..."
                rows={3}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-1 focus:ring-amber-600 focus:outline-none"
              />
            </div>

            {/* Photo Upload */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700">
                  Resolution Proof Photographs <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400">
                  {completionImages.length} photo(s) selected
                </span>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {completionImages.map((img) => (
                  <div key={img.id} className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 group shadow-2xs">
                    <img src={img.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    
                    {img.geo && (
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/70 text-teal-300 text-[9px] font-mono rounded flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5 text-teal-400" />
                        <span>GPS</span>
                      </span>
                    )}

                    {img.discrepancy?.isDiscrepancy && (
                      <span
                        className="absolute top-1 left-1 px-1.5 py-0.5 bg-amber-600 text-white text-[8px] font-bold rounded shadow-xs"
                        title={`~${Math.round(img.discrepancy.distanceMeters)}m from reported issue`}
                      >
                        ~{Math.round(img.discrepancy.distanceMeters)}m
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveImage(img.id)}
                      className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full hover:bg-black transition-colors"
                      aria-label="Remove photo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => setShowCameraModal(true)}
                  className="w-24 h-24 rounded-xl border-2 border-dashed border-amber-500/50 hover:border-amber-600 hover:bg-amber-50/40 flex flex-col items-center justify-center text-amber-800 transition-colors cursor-pointer"
                >
                  <Camera className="w-5 h-5 mb-1 text-amber-600" />
                  <span className="text-[10px] font-bold text-center leading-tight">Take Live Photo</span>
                  <span className="text-[8px] text-amber-600/80 mt-0.5">GPS Tagged</span>
                </button>
              </div>

              {/* In-App Camera Only Disclosure */}
              <div className="mt-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2 text-[11px] text-slate-600">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Camera & Location Required:</strong> Resolution photos must be captured live at the job site. Direct file picking, gallery selection, and drag-and-drop are disabled.
                </span>
              </div>

              {/* Drag or Paste blocked feedback */}
              {dragOrPasteNotice && (
                <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-900 font-medium flex items-center justify-between">
                  <span>{dragOrPasteNotice}</span>
                  <button
                    type="button"
                    onClick={() => setDragOrPasteNotice(null)}
                    className="text-amber-700 hover:text-amber-900 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Live Camera Modal */}
              <LiveCameraModal
                isOpen={showCameraModal}
                onClose={() => setShowCameraModal(false)}
                onPhotoCaptured={handlePhotoCaptured}
                title="Capture Resolution Evidence Photo"
              />
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 italic">
                Status remains &quot;In Progress&quot; with &quot;Completion awaiting review&quot; badge until manager approves.
              </span>

              <button
                type="submit"
                disabled={isSubmittingCompletion}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {isSubmittingCompletion ? (
                  <span>Saving Evidence...</span>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Submit for Review</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Task History Timeline */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
          Task Activity History ({events.length})
        </h2>

        <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
          {events.map((ev) => (
            <div key={ev.id} className="p-2.5 bg-slate-50 rounded-lg text-xs border border-slate-100">
              <div className="flex items-center justify-between font-semibold text-slate-800 mb-0.5">
                <span>{ev.action}</span>
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
  );
};
