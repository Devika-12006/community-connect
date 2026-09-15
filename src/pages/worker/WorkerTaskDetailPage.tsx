import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { repository } from '../../db/repository';
import type { Complaint, ComplaintEvent, ImageAsset } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PriorityBadge } from '../../components/common/PriorityBadge';
import { ImageViewer } from '../../components/common/ImageViewer';
import {
  ArrowLeft,
  Play,
  Upload,
  CheckCircle,
  MapPin,
  Calendar,
  AlertTriangle,
  X,
  Send,
  Camera,
  RotateCcw,
} from 'lucide-react';

interface CompletionImageFile {
  id: string;
  file: File;
  previewUrl: string;
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

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // File Upload Handlers for Completion Proof
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCompletionError(null);
    if (!e.target.files) return;

    const files = Array.from(e.target.files);
    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSizeBytes = 5 * 1024 * 1024;

    const newUploaded: CompletionImageFile[] = [];

    for (const file of files) {
      if (!validMimes.includes(file.type)) {
        setCompletionError(`"${file.name}" is not supported. Please upload JPG, PNG, or WebP.`);
        return;
      }
      if (file.size > maxSizeBytes) {
        setCompletionError(`"${file.name}" exceeds 5 MB.`);
        return;
      }
      newUploaded.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    setCompletionImages((prev) => [...prev, ...newUploaded]);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
      for (const img of completionImages) {
        const asset: ImageAsset = {
          id: img.id,
          blob: img.file,
          mimeType: img.file.type,
          originalName: img.file.name,
          size: img.file.size,
          createdAt: new Date().toISOString(),
        };
        await repository.saveImage(asset);
        imageIds.push(img.id);
      }

      const now = new Date().toISOString();
      // Keep status as In Progress while evidence awaits approval per requirements
      const updated: Complaint = {
        ...task,
        status: 'In Progress',
        completionAwaitingReview: true,
        completionNotes: completionNote.trim(),
        completionImageIds: imageIds,
        completionSubmittedAt: now,
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
                  <div key={img.id} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                    <img src={img.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(img.id)}
                      className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full hover:bg-black"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 hover:border-amber-600 hover:bg-amber-50/40 flex flex-col items-center justify-center text-slate-500 hover:text-amber-800 transition-colors cursor-pointer"
                >
                  <Upload className="w-5 h-5 mb-1 text-slate-400" />
                  <span className="text-[10px] font-bold">Upload</span>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleFileSelect}
                className="hidden"
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
