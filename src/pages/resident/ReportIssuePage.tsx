import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { repository } from '../../db/repository';
import { validateImageFile } from '../../lib/validationUtils';
import {
  COMPLAINT_CATEGORIES,
  type ComplaintCategory,
  type ComplaintPriority,
  type Complaint,
  type ImageAsset,
  type ImageQualityReport,
  type GeoLocationData,
  type Asset,
  type PriorityAssessment,
  type DuplicateMatch,
} from '../../types';
import { suggestCategory, checkPossibleDuplicate, type DuplicateWarning } from '../../lib/smartAssistance';
import { priorityEngine } from '../../services/priorityEngine';
import { duplicateDetectionService } from '../../services/duplicateDetectionService';
import {
  inspectImageWithCanvas,
  computeContentHash,
  checkImageDuplicates,
  classifyImageWithVisionModel,
  compareSelectedWithVisualCategory,
  detectScreenOrDisplayArtifacts,
  buildSuspiciousFlags,
  type ReusedPhotoMatch,
  type VisualClassificationResult,
} from '../../lib/imageVerification';
import { LiveCameraModal, type LiveCaptureResult } from '../../components/camera/LiveCameraModal';
import { createCaptureSession, validateAndConsumeSession } from '../../services/captureSessionService';
import { formatCoordinates } from '../../lib/geoUtils';
import {
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  Compass,
  AlertCircle,
  Eye,
  Loader2,
  Camera,
  Image,
} from 'lucide-react';

interface UploadedImageFile {
  id: string;
  rawBlob: Blob;
  stampedBlob?: Blob;
  previewUrl: string;
  fileName: string;
  quality?: ImageQualityReport;
  dHash?: string;
  contentHash?: string;
  reusedMatch?: ReusedPhotoMatch | null;
  screenCheck?: { isScreenPhoto: boolean; score: number; details?: string };
  geo?: GeoLocationData;
  captureSessionId?: string;
  isValidating?: boolean;
}

export const ReportIssuePage: React.FC = () => {
  const navigate = useNavigate();
  const { activeResident, settings, complaints, refreshAll } = useApp();

  // Step state (1: Details, 2: Location, 3: Review, 4: Success)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Form state
  const [category, setCategory] = useState<ComplaintCategory>('Garbage');
  const [suggestedCat, setSuggestedCat] = useState<ComplaintCategory | null>(null);
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<UploadedImageFile[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [visualResult, setVisualResult] = useState<VisualClassificationResult | null>(null);
  const [visualDismissed, setVisualDismissed] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdComplaint, setCreatedComplaint] = useState<Complaint | null>(null);

  // Location state
  const [block, setBlock] = useState(activeResident?.block || settings.blocks[0] || 'Block A');
  const [specificLocation, setSpecificLocation] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'success' | 'denied' | 'unavailable'>('idle');
  const [geoMessage, setGeoMessage] = useState<string | null>(null);

  // Urgency & Priority state
  const [requestUrgent, setRequestUrgent] = useState(false);
  const [urgentReason, setUrgentReason] = useState('');

  // Duplicate Warning state
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning>({ hasDuplicate: false });
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // Asset state (Manual selection only - STRICTLY NO QR)
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  // Explainable Priority parameters (P = 7S + 5A + 4W + 4R)
  const [severity, setSeverity] = useState<number>(3); // 1-5 scale
  const [affected, setAffected] = useState<number>(2); // 1-5 scale
  const [recurrenceScore, setRecurrenceScore] = useState<number>(1);
  const [livePriorityAssessment, setLivePriorityAssessment] = useState<PriorityAssessment | null>(null);

  // Multi-signal duplicate detection
  const [multiDuplicate, setMultiDuplicate] = useState<DuplicateMatch | null>(null);

  // Load community assets
  useEffect(() => {
    repository.getAssets({ activeOnly: true }).then(setAvailableAssets);
  }, []);

  // Compute live recurrence & priority score dynamically
  useEffect(() => {
    let isMounted = true;
    priorityEngine
      .calculateRecurrenceScore({
        assetId: selectedAsset?.id,
        category,
        block,
      })
      .then((rec) => {
        if (!isMounted) return;
        setRecurrenceScore(rec);
        const assessment = priorityEngine.computePriority({
          severity,
          affected: selectedAsset ? Math.max(affected, selectedAsset.criticality) : affected,
          waitingTime: 1, // Just submitted
          recurrence: rec,
          assetName: selectedAsset?.name,
        });
        setLivePriorityAssessment(assessment);
      });
    return () => {
      isMounted = false;
    };
  }, [severity, affected, selectedAsset, category, block]);

  // Derived issue title from first sentence of description or asset/category
  const derivedTitle =
    description.trim().split('\n')[0].slice(0, 75) ||
    (selectedAsset ? `${selectedAsset.name} Maintenance` : `${category} Issue`);

  // Multi-signal duplicate check
  useEffect(() => {
    let isMounted = true;
    if (description.trim().length >= 10) {
      duplicateDetectionService
        .scanForDuplicates({
          title: derivedTitle,
          description,
          category,
          block,
          assetId: selectedAsset?.id,
        })
        .then((match) => {
          if (isMounted) setMultiDuplicate(match);
        });
    } else {
      setMultiDuplicate(null);
    }
    return () => {
      isMounted = false;
    };
  }, [derivedTitle, description, category, block, selectedAsset]);

  const [draftId] = useState(() => crypto.randomUUID());
  const [showCameraModal, setShowCameraModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
  }, [images]);

  // Smart assistance: category suggestion
  useEffect(() => {
    if (description.trim().length >= 5) {
      const match = suggestCategory(derivedTitle, description);
      if (match) {
        setSuggestedCat(match.category);
      } else {
        setSuggestedCat(null);
      }
    } else {
      setSuggestedCat(null);
    }
  }, [derivedTitle, description]);

  // Smart assistance: duplicate check
  useEffect(() => {
    if (description.trim().length >= 10 && block) {
      const dup = checkPossibleDuplicate(derivedTitle, category, block, complaints);
      setDuplicateWarning(dup);
    } else {
      setDuplicateWarning({ hasDuplicate: false });
    }
  }, [derivedTitle, category, block, complaints]);

  // Handle in-app live camera capture with optional GPS fix
  const handlePhotoCaptured = async (result: LiveCaptureResult) => {
    setUploadError(null);
    if (!activeResident) {
      setUploadError('Active resident profile required to capture photos.');
      return;
    }

    if (images.length >= 3) {
      setUploadError('You can attach a maximum of 3 photographs.');
      return;
    }

    setIsAnalyzingImage(true);

    try {
      // 1. Authoritative Capture Session creation & atomic validation
      const session = createCaptureSession({
        userId: activeResident.id,
        role: 'Resident',
        communityId: settings.name || 'default',
        draftType: 'complaint',
        draftId,
      });

      const validation = await validateAndConsumeSession({
        sessionId: session.id,
        token: session.token,
        userId: activeResident.id,
        role: 'Resident',
        draftId,
        imageBlob: result.rawBlob,
        geoData: result.geoData,
      });

      if (!validation.valid) {
        setUploadError(validation.error);
        setIsAnalyzingImage(false);
        return;
      }

      // 2. Offscreen Canvas quality analysis & 64-bit dHash
      let quality: ImageQualityReport | undefined;
      let dHash: string | undefined;
      let contentHash: string | undefined;
      let reusedMatch: ReusedPhotoMatch | null = null;
      let screenCheck: { isScreenPhoto: boolean; score: number; details?: string } | undefined;

      try {
        const canvasInspection = await inspectImageWithCanvas(result.rawBlob);
        quality = canvasInspection.quality;
        dHash = canvasInspection.dHash;
        contentHash = await computeContentHash(result.rawBlob);

        const existingImages = await repository.getAllImages();
        reusedMatch = checkImageDuplicates(dHash, contentHash, existingImages, complaints);
        screenCheck = await detectScreenOrDisplayArtifacts(result.rawBlob);
      } catch (inspectErr) {
        console.warn('Image analysis error:', inspectErr);
      }

      // 3. Populate complaint location from camera GPS if acquired
      if (result.geoData) {
        setLatitude(result.geoData.latitude);
        setLongitude(result.geoData.longitude);
        setGeoStatus('success');
        setGeoMessage(
          `GPS coordinates captured from photo: ${formatCoordinates(result.geoData.latitude, result.geoData.longitude)} (±${Math.round(result.geoData.accuracy)}m)`
        );

        if (!specificLocation.trim() && result.geoData.address) {
          setSpecificLocation(result.geoData.address.slice(0, 120));
        }
      }

      const id = crypto.randomUUID();
      const capturedRecord: UploadedImageFile = {
        id,
        rawBlob: result.rawBlob,
        stampedBlob: result.stampedBlob,
        previewUrl: result.previewUrl,
        fileName: `live_capture_${Date.now().toString().slice(-6)}.jpg`,
        quality,
        dHash,
        contentHash,
        reusedMatch,
        screenCheck,
        geo: result.geoData,
        captureSessionId: session.id,
      };

      setImages((prev) => [...prev, capturedRecord]);

      // 4. Real Vision Model category classification (if configured)
      const hasKey = !!(settings.geminiApiKey?.trim() || (import.meta as any).env?.VITE_GEMINI_API_KEY?.trim());
      if (hasKey && !visualResult) {
        try {
          const vResult = await classifyImageWithVisionModel(result.rawBlob, settings.geminiApiKey);
          setVisualResult(vResult);
          setVisualDismissed(false);
        } catch {
          // Graceful fallback
        }
      }
    } catch (err: any) {
      console.error('Failed to process live photo:', err);
      setUploadError(err.message || 'Error processing live photograph.');
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  // Process selected files from gallery or drag-drop
  const processFiles = async (files: FileList | File[] | null) => {
    setUploadError(null);
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    if (images.length + fileArray.length > 3) {
      setUploadError('You can attach a maximum of 3 photographs in total.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsAnalyzingImage(true);

    try {
      for (const file of fileArray) {
        const check = validateImageFile(file);
        if (!check.valid) {
          setUploadError(check.error || 'Invalid image file.');
          continue;
        }

        let quality: ImageQualityReport | undefined;
        let dHash: string | undefined;
        let contentHash: string | undefined;
        let reusedMatch: ReusedPhotoMatch | null = null;
        let screenCheck: { isScreenPhoto: boolean; score: number; details?: string } | undefined;

        try {
          const canvasInspection = await inspectImageWithCanvas(file);
          quality = canvasInspection.quality;
          dHash = canvasInspection.dHash;
          contentHash = await computeContentHash(file);

          const existingImages = await repository.getAllImages();
          reusedMatch = checkImageDuplicates(dHash, contentHash, existingImages, complaints);
          screenCheck = await detectScreenOrDisplayArtifacts(file);
        } catch (err) {
          console.warn('Image analysis notice:', err);
        }

        const previewUrl = URL.createObjectURL(file);
        const record: UploadedImageFile = {
          id: crypto.randomUUID(),
          rawBlob: file,
          previewUrl,
          fileName: file.name || `photo_${Date.now().toString().slice(-6)}.jpg`,
          quality,
          dHash,
          contentHash,
          reusedMatch,
          screenCheck,
        };

        setImages((prev) => [...prev, record]);

        const hasKey = !!(settings.geminiApiKey?.trim() || (import.meta as any).env?.VITE_GEMINI_API_KEY?.trim());
        if (hasKey && !visualResult) {
          try {
            const vResult = await classifyImageWithVisionModel(file, settings.geminiApiKey);
            setVisualResult(vResult);
            setVisualDismissed(false);
          } catch {}
        }
      }
    } catch (err: any) {
      console.error('File upload error:', err);
      setUploadError(err.message || 'Failed to process selected photo.');
    } finally {
      setIsAnalyzingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle gallery file selection (Desktop and Mobile)
  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await processFiles(e.target.files);
  };

  const handleRemoveImage = (id: string) => {
    setImages((prev) => {
      const filtered = prev.filter((img) => img.id !== id);
      const target = prev.find((img) => img.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return filtered;
    });
  };

  // Browser Geolocation
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('unavailable');
      setGeoMessage('Geolocation is not supported by your browser.');
      return;
    }

    setGeoStatus('loading');
    setGeoMessage('Detecting current GPS coordinates...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setGeoStatus('success');
        setGeoMessage(`Coordinates captured: ${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setGeoStatus('denied');
          setGeoMessage('Location permission denied. Please enter the specific location or landmark manually below.');
        } else {
          setGeoStatus('unavailable');
          setGeoMessage('Unable to retrieve coordinates. Manual location entry is always supported.');
        }
      },
      { timeout: 8000 }
    );
  };

  // Validation
  const validateStep1 = () => {
    setValidationError(null);
    if (!description.trim()) {
      setValidationError('Please describe the issue so workers can understand the repair needed.');
      return false;
    }
    if (description.trim().length < 15) {
      setValidationError('Description is too brief. Please enter at least 15 characters describing the issue.');
      return false;
    }
    if (description.length > 1000) {
      setValidationError('Description cannot exceed the maximum limit of 1000 characters.');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    setValidationError(null);
    if (!block.trim()) {
      setValidationError('Please select a building or block.');
      return false;
    }
    if (!specificLocation.trim()) {
      setValidationError('Please specify a landmark or floor/corridor location.');
      return false;
    }
    return true;
  };

  // Final Submission
  const handleSubmitComplaint = async () => {
    if (!activeResident) {
      setValidationError('Active resident profile required.');
      return;
    }

    if (requestUrgent && !urgentReason.trim()) {
      setValidationError('Please specify why this issue requires urgent attention.');
      return;
    }

    setIsSubmitting(true);
    setValidationError(null);

    try {
      // 1. Save live captured images to IndexedDB with verification & geolocation attributes
      const imageIds: string[] = [];
      const qualityReports: ImageQualityReport[] = [];
      let topReusedMatch: ReusedPhotoMatch | null = null;
      let detectedScreenPhoto: { isScreenPhoto: boolean; details?: string } | undefined;

      for (const img of images) {
        const imageRecord: ImageAsset = {
          id: img.id,
          blob: img.rawBlob,
          stampedBlob: img.stampedBlob,
          mimeType: 'image/jpeg',
          originalName: img.fileName,
          size: img.rawBlob.size,
          createdAt: new Date().toISOString(),
          perceptualHash: img.dHash,
          contentHash: img.contentHash,
          quality: img.quality,
          captureSessionId: img.captureSessionId,
          latitude: img.geo?.latitude,
          longitude: img.geo?.longitude,
          accuracy: img.geo?.accuracy,
          locationTimestamp: img.geo?.locationTimestamp,
          clientCaptureTimestamp: img.geo?.clientCaptureTimestamp,
          serverReceivedTimestamp: img.geo?.serverReceivedTimestamp,
          address: img.geo?.address,
          isLiveCapture: true,
        };
        await repository.saveImage(imageRecord);
        imageIds.push(img.id);
        if (img.quality) qualityReports.push(img.quality);
        if (img.reusedMatch && (!topReusedMatch || img.reusedMatch.similarityPercentage > topReusedMatch.similarityPercentage)) {
          topReusedMatch = img.reusedMatch;
        }
        if (img.screenCheck?.isScreenPhoto && !detectedScreenPhoto) {
          detectedScreenPhoto = img.screenCheck;
        }
      }

      // Check category comparison against visual model (if configured)
      const categoryComparison = visualResult
        ? compareSelectedWithVisualCategory(category, visualResult)
        : undefined;

      const suspiciousFlags = buildSuspiciousFlags({
        reusedMatch: topReusedMatch,
        qualityReports,
        categoryComparison,
        screenCheck: detectedScreenPhoto,
      });

      const isSuspicious = suspiciousFlags.length > 0;
      const imageVerificationStatus = categoryComparison ? categoryComparison.status : 'Unavailable';

      // 2. Generate Reference
      const reference = await repository.getNextReference();

      // 3. Create Complaint record
      const complaintId = crypto.randomUUID();
      const now = new Date().toISOString();

      const complaint: Complaint = {
        id: complaintId,
        reference,
        residentId: activeResident.id,
        residentName: activeResident.displayName,
        residentBlock: activeResident.block,
        residentFlat: activeResident.flatNumber,
        title: derivedTitle,
        description: description.trim(),
        category,
        suggestedCategory: suggestedCat || undefined,
        block,
        specificLocation: specificLocation.trim(),
        latitude: latitude ?? images[0]?.geo?.latitude,
        longitude: longitude ?? images[0]?.geo?.longitude,
        captureLatitude: images[0]?.geo?.latitude,
        captureLongitude: images[0]?.geo?.longitude,
        captureAccuracy: images[0]?.geo?.accuracy,
        captureLocationTimestamp: images[0]?.geo?.locationTimestamp,
        captureClientTimestamp: images[0]?.geo?.clientCaptureTimestamp,
        captureServerTimestamp: images[0]?.geo?.serverReceivedTimestamp,
        captureSessionId: images[0]?.captureSessionId,
        captureAddress: images[0]?.geo?.address,
        isLiveCapture: images.length > 0,
        assetId: selectedAsset?.id,
        assetCode: selectedAsset?.assetCode,
        assetName: selectedAsset?.name,
        priority: (livePriorityAssessment?.level === 'Critical' ? 'Urgent' : (livePriorityAssessment?.level as ComplaintPriority)) || (requestUrgent ? 'Urgent' : 'Low'),
        priorityAssessment: livePriorityAssessment || undefined,
        suggestedPriority: (livePriorityAssessment?.level === 'Critical' ? 'Urgent' : (livePriorityAssessment?.level as ComplaintPriority)) || (requestUrgent ? 'Urgent' : undefined),
        status: 'Submitted',
        originalImageIds: imageIds,
        duplicateMatch: multiDuplicate || undefined,
        requestUrgentAttention: requestUrgent,
        urgentReason: requestUrgent ? urgentReason.trim() : undefined,
        isSuspicious,
        suspiciousFlags: isSuspicious ? suspiciousFlags : undefined,
        imageVerificationStatus,
        visualCategorySuggested: visualResult?.category,
        visualExplanation: visualResult?.explanation,
        createdAt: now,
        updatedAt: now,
      };

      await repository.saveComplaint(complaint);

      // 4. Record first timeline event
      await repository.addEvent({
        id: crypto.randomUUID(),
        complaintId,
        eventType: 'Submitted',
        action: 'Complaint Submitted',
        actorRole: 'Resident',
        actorName: activeResident.displayName,
        visibility: 'public',
        note: `Report filed by ${activeResident.displayName} (${activeResident.block}, Flat ${activeResident.flatNumber}).`,
        createdAt: now,
      });

      // 5. Create notification for Managers
      await repository.addNotification({
        id: crypto.randomUUID(),
        recipientRole: 'Manager',
        complaintId,
        title: `New Complaint: ${reference}`,
        message: `${activeResident.displayName} reported a ${category} issue in ${block}.`,
        createdAt: now,
      });

      setCreatedComplaint(complaint);
      await refreshAll();
      setCurrentStep(4);
    } catch (err) {
      console.error('Failed to submit complaint:', err);
      setValidationError('An error occurred while saving the complaint. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!activeResident) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center">
        <h2 className="text-lg font-bold text-slate-900 mb-2">Resident Profile Required</h2>
        <p className="text-xs text-slate-600 mb-4">
          Please create or select a resident profile before filing a complaint.
        </p>
        <button
          type="button"
          onClick={() => navigate('/resident/profile')}
          className="px-4 py-2 bg-teal-800 text-white rounded-lg text-xs font-bold"
        >
          Open Resident Setup
        </button>
      </div>
    );
  }

  // STEP 4: Success Screen
  if (currentStep === 4 && createdComplaint) {
    return (
      <div className="max-w-lg mx-auto bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 text-center shadow-xs">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">Complaint Successfully Submitted</h2>
        <p className="text-xs sm:text-sm text-slate-600 mb-6">
          Your report has been received by community management and is pending review.
        </p>

        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-6 text-left space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Complaint Reference:</span>
            <span className="text-sm font-mono font-bold text-teal-900 bg-teal-100/70 px-2 py-0.5 rounded">
              {createdComplaint.reference}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <span className="text-xs font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
              Submitted
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Location:</span>
            <span className="text-xs font-semibold text-slate-800">
              {createdComplaint.block} • {createdComplaint.specificLocation}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => navigate(`/resident/complaints/${createdComplaint.id}`)}
            className="flex-1 px-4 py-2.5 bg-teal-800 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            View Complaint
          </button>
          <button
            type="button"
            onClick={() => navigate('/resident/home')}
            className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step Progress Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">Report a Maintenance Issue</h1>
          <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">
            Step {currentStep} of 3
          </span>
        </div>

        {/* Stepper indicator */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { num: 1, label: 'Issue Details' },
            { num: 2, label: 'Location' },
            { num: 3, label: 'Review & Submit' },
          ].map((s) => (
            <div key={s.num} className="space-y-1">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  currentStep >= s.num ? 'bg-teal-700' : 'bg-slate-200'
                }`}
              />
              <span className="text-[10px] font-medium text-slate-500 block truncate">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Validation Error Alert */}
      {validationError && (
        <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-800 font-medium">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{validationError}</span>
        </div>
      )}

      {/* STEP 1: Issue Details */}
      {currentStep === 1 && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              processFiles(e.dataTransfer.files);
            }
          }}
          onPaste={(e) => {
            if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
              e.preventDefault();
              processFiles(e.clipboardData.files);
            }
          }}
          className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-5"
        >
          {/* Linked Community Asset (Manual Selection Only - No QR) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Linked Community Asset (Optional)
              </label>
              <span className="text-[11px] text-slate-500 font-normal">Manual search & select</span>
            </div>
            <select
              value={selectedAsset?.id || ''}
              onChange={(e) => {
                const found = availableAssets.find((a) => a.id === e.target.value) || null;
                setSelectedAsset(found);
                if (found) {
                  if (found.category) setCategory(found.category);
                  if (found.building) setBlock(found.building);
                  if (found.location && !specificLocation) setSpecificLocation(found.location);
                }
              }}
              className="w-full text-sm px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 focus:outline-none bg-white"
            >
              <option value="">(None / General Society Area)</option>
              {availableAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  [{asset.assetCode}] {asset.name} — {asset.building} ({asset.category})
                </option>
              ))}
            </select>
            {selectedAsset && (
              <div className="mt-2 p-2.5 rounded-xl bg-teal-50 border border-teal-200 text-xs text-teal-900 flex items-center justify-between">
                <div>
                  <div className="font-bold flex items-center gap-1.5">
                    <span>{selectedAsset.name}</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-teal-200 text-teal-900 font-bold">{selectedAsset.assetCode}</span>
                  </div>
                  <div className="text-[11px] text-teal-700 mt-0.5">
                    {selectedAsset.building} • {selectedAsset.location} • Criticality: {selectedAsset.criticality}/5
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAsset(null)}
                  className="text-xs text-teal-800 hover:text-teal-950 font-bold px-2 py-1 bg-teal-100 hover:bg-teal-200 rounded"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Transparent Category Suggestion Helper */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Category <span className="text-red-500">*</span>
              </label>

              {suggestedCat && suggestedCat !== category && (
                <button
                  type="button"
                  onClick={() => setCategory(suggestedCat)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 text-[11px] font-semibold hover:bg-teal-100 transition-colors"
                  title="Suggested category based on entered keywords"
                >
                  <Sparkles className="w-3 h-3 text-teal-600" />
                  <span>Suggested: {suggestedCat} (Click to apply)</span>
                </button>
              )}
            </div>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
              className="w-full text-sm px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 focus:outline-none bg-white"
            >
              {COMPLAINT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Detailed Description <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                Min 15 — Max 1000 characters
              </span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the condition, exact signs of damage, or hazard present..."
              rows={4}
              minLength={15}
              maxLength={1000}
              className="w-full text-sm px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 focus:outline-none"
            />
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-[11px] gap-1 mt-1.5">
              <div>
                {description.trim().length === 0 ? (
                  <span className="text-slate-400">
                    Minimum 15 characters required
                  </span>
                ) : description.trim().length < 15 ? (
                  <span className="text-amber-600 font-semibold">
                    {15 - description.trim().length} more character{15 - description.trim().length === 1 ? '' : 's'} needed
                  </span>
                ) : (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <span>✓</span> Minimum requirement met
                  </span>
                )}
              </div>
              <div className="text-slate-500 font-mono text-right">
                <span className={description.length >= 950 ? 'text-amber-600 font-bold' : ''}>
                  {description.length}
                </span> / 1000 characters
                <span className="text-slate-400 ml-1">
                  ({1000 - description.length} remaining)
                </span>
              </div>
            </div>
          </div>

          {/* Optional Photos (Max 3, Max 5MB, JPG/PNG/WebP) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Photographs (Optional, max 3)
              </label>
              <span className="text-[11px] text-slate-500">
                {images.length}/3 photos added
              </span>
            </div>

            {uploadError && (
              <div className="mb-2.5 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                {uploadError}
              </div>
            )}

            {isAnalyzingImage && (
              <div className="mb-2.5 p-2 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-800 font-medium flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                <span>Validating image file headers and inspecting quality...</span>
              </div>
            )}

            {/* Hidden File Input for Gallery */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleGalleryUpload}
              className="hidden"
            />

            {/* Attached Photo Previews */}
            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-3">
                {images.map((img, idx) => (
                  <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 group shadow-2xs">
                    <img src={img.previewUrl} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                    
                    {/* Quality Pill */}
                    {img.quality?.status === 'Too Dark' && (
                      <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-amber-600 text-white text-[9px] font-bold rounded shadow-xs">
                        Dark
                      </span>
                    )}
                    {img.quality?.status === 'Blurry' && (
                      <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-amber-600 text-white text-[9px] font-bold rounded shadow-xs">
                        Blurry
                      </span>
                    )}
                    {img.quality?.status === 'Clear' && (
                      <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-emerald-700 text-white text-[9px] font-bold rounded shadow-xs">
                        Clear
                      </span>
                    )}

                    {/* Duplicate Reused Warning Pill */}
                    {img.reusedMatch && (
                      <span className="absolute bottom-6 left-1.5 px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-bold rounded shadow-xs">
                        Reused
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveImage(img.id)}
                      className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-black text-white rounded-full transition-colors"
                      aria-label="Remove image"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 text-white text-[9px] font-mono rounded truncate max-w-[70%]">
                      {img.fileName}
                    </span>
                    {img.geo && (
                      <span className="absolute top-1 right-8 px-1.5 py-0.5 bg-teal-900/80 text-teal-300 text-[9px] font-mono rounded flex items-center gap-1 shadow-xs">
                        <MapPin className="w-2.5 h-2.5 text-teal-400" />
                        <span>GPS</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Photo capture & gallery upload buttons */}
            {images.length < 3 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2.5">
                <button
                  type="button"
                  onClick={() => setShowCameraModal(true)}
                  disabled={isAnalyzingImage}
                  className="rounded-xl border-2 border-dashed border-teal-600/40 hover:border-teal-700 hover:bg-teal-50/40 flex items-center gap-3 p-3 text-teal-800 transition-all cursor-pointer disabled:opacity-50 text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
                    <Camera className="w-5 h-5 text-teal-700" />
                  </div>
                  <div>
                    <span className="text-xs font-bold block text-slate-800">Take Live Photo</span>
                    <span className="text-[11px] text-slate-500">Capture with device camera</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isAnalyzingImage}
                  className="rounded-xl border-2 border-dashed border-slate-300 hover:border-teal-600 hover:bg-slate-50 flex items-center gap-3 p-3 text-slate-700 transition-all cursor-pointer disabled:opacity-50 text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Image className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <span className="text-xs font-bold block text-slate-800">Choose from Gallery</span>
                    <span className="text-[11px] text-slate-500">JPG, PNG, WebP up to 5MB</span>
                  </div>
                </button>
              </div>
            )}

            {/* Localized Limitations for Camera & Gallery */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2 text-[11px] text-slate-600">
                <Camera className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Camera Access:</strong> Requires camera permission and hardware support. Photos can be captured with or without GPS coordinates.
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2 text-[11px] text-slate-600">
                <Image className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Gallery Access:</strong> Requires photo/media access. Accepts JPG, PNG, and WebP up to 5MB.
                </span>
              </div>
            </div>

            {/* Live Camera Modal */}
            <LiveCameraModal
              isOpen={showCameraModal}
              onClose={() => setShowCameraModal(false)}
              onPhotoCaptured={handlePhotoCaptured}
              communityName={settings.name}
              title="Capture Live Issue Photograph"
              onEnterManually={() => {
                setShowCameraModal(false);
                setCurrentStep(2);
              }}
            />

            {/* Quality Suggestions */}
            {images.some((img) => img.quality?.isDark || img.quality?.isBlurry) && (
              <div className="mt-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Photo Quality Tip</span>
                </div>
                {images.map((img, idx) => (img.quality?.isDark || img.quality?.isBlurry) && (
                  <p key={img.id} className="text-[11px] text-amber-800">
                    • <strong>Photo {idx + 1}:</strong> {img.quality.feedback}
                  </p>
                ))}
              </div>
            )}

            {/* Duplicate Photo Detection Alert */}
            {images.some((img) => img.reusedMatch) && (
              <div className="mt-2.5 p-3.5 rounded-xl bg-red-50 border border-red-300 text-xs text-red-900 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>Reused / Duplicate Photograph Detected</span>
                </div>
                {images.filter((img) => img.reusedMatch).map((img, idx) => (
                  <p key={img.id} className="text-[11px] text-red-800">
                    Photo {idx + 1} matches a photo previously submitted in report{' '}
                    <strong>{img.reusedMatch?.matchedComplaintReference || 'an existing report'}</strong>{' '}
                    ({img.reusedMatch?.similarityPercentage}% visual match). Please confirm you are not filing an accidental duplicate report.
                  </p>
                ))}
              </div>
            )}

            {/* Visual AI Classification & Category Alignment */}
            {visualResult && !visualDismissed && (
              <div className={`mt-2.5 p-3.5 rounded-xl border text-xs ${
                visualResult.category === 'Uncertain'
                  ? 'bg-slate-50 border-slate-200 text-slate-800'
                  : visualResult.category === category
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-teal-50 border-teal-300 text-teal-950'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-teal-700 shrink-0" />
                      <span>Visual Image Verification: {visualResult.category}</span>
                    </div>
                    <p className="text-[11px] opacity-90">{visualResult.explanation}</p>
                    {visualResult.category !== 'Uncertain' && visualResult.category !== category && (
                      <div className="pt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCategory(visualResult.category as ComplaintCategory);
                            setVisualDismissed(true);
                          }}
                          className="px-3 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-bold text-[11px] cursor-pointer"
                        >
                          Switch to {visualResult.category}
                        </button>
                        <button
                          type="button"
                          onClick={() => setVisualDismissed(true)}
                          className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-semibold text-[11px] cursor-pointer"
                        >
                          Keep {category}
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setVisualDismissed(true)}
                    className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    aria-label="Dismiss visual check"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Explainable Priority Formula Assessment: P = 7S + 5A + 4W + 4R */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Priority & Impact Assessment
              </label>
              {livePriorityAssessment && (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  livePriorityAssessment.level === 'Critical' ? 'bg-red-100 text-red-800 border border-red-300' :
                  livePriorityAssessment.level === 'High' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                  livePriorityAssessment.level === 'Medium' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                  'bg-slate-200 text-slate-800 border border-slate-300'
                }`}>
                  {livePriorityAssessment.level} Priority ({livePriorityAssessment.score}/100)
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-700">Safety Hazard / Severity (S: {severity}/5)</label>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={severity}
                  onChange={(e) => setSeverity(Number(e.target.value))}
                  className="w-full accent-teal-700 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>1: Minor inconvenience</span>
                  <span>3: Moderate</span>
                  <span>5: Life / property danger</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-700">People Affected (A: {affected}/5)</label>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={affected}
                  onChange={(e) => setAffected(Number(e.target.value))}
                  className="w-full accent-teal-700 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>1: Single unit</span>
                  <span>3: Floor / corridor</span>
                  <span>5: Entire community</span>
                </div>
              </div>
            </div>

            {livePriorityAssessment && (
              <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <div className="font-mono font-bold text-teal-900">
                  Formula: P = 7S + 5A + 4W + 4R = 7({severity}) + 5({selectedAsset ? Math.max(affected, selectedAsset.criticality) : affected}) + 4(1) + 4({recurrenceScore}) = {livePriorityAssessment.score}/100
                </div>
                <div className="text-[10px] text-slate-500">
                  {livePriorityAssessment.explanation}
                </div>
              </div>
            )}
          </div>

          {/* Multi-Signal Smart Duplicate Warning */}
          {multiDuplicate && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Smart Duplicate Warning ({multiDuplicate.similarityScore}% Match)</span>
              </div>
              <p className="text-[11px] text-amber-800">
                Matches complaint <strong>{multiDuplicate.matchedReference}</strong> ("{multiDuplicate.matchedTitle}")
              </p>
              <div className="text-[10px] text-amber-700 font-mono">
                Matching factors: {multiDuplicate.factors.join(', ')}
              </div>
            </div>
          )}

          {/* Transparent Duplicate Warning Helper */}
          {duplicateWarning.hasDuplicate && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs text-amber-900">
                <div className="font-bold mb-0.5">A similar issue may already be reported</div>
                <p className="text-[11px] text-amber-800 mb-2">{duplicateWarning.reason}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDuplicateModal(true)}
                    className="px-2.5 py-1 bg-amber-200/80 hover:bg-amber-300 text-amber-900 rounded font-semibold text-[11px] flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    <span>View Privacy-Safe Summary</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => {
                if (validateStep1()) setCurrentStep(2);
              }}
              className="px-5 py-2.5 bg-teal-800 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <span>Continue to Location</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Location */}
      {currentStep === 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Building or Block <span className="text-red-500">*</span>
            </label>
            <select
              value={block}
              onChange={(e) => setBlock(e.target.value)}
              className="w-full text-sm px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 focus:outline-none bg-white"
            >
              {settings.blocks.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Specific Location or Landmark <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                {specificLocation.length} / 120 characters
              </span>
            </div>
            <input
              type="text"
              value={specificLocation}
              onChange={(e) => setSpecificLocation(e.target.value)}
              placeholder="e.g. Ground floor lobby, adjacent to mailbox row"
              maxLength={120}
              className="w-full text-sm px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 focus:outline-none"
            />
            
            {/* Quick Society Common Area Chips */}
            <div className="mt-2">
              <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                Common society areas (click to apply):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Clubhouse',
                  'Lift Lobby',
                  'Main Gate & Security',
                  'Basement Parking (B1)',
                  'Basement Parking (B2)',
                  'Central Garden / Park',
                  'Swimming Pool Deck',
                  'Gymnasium',
                  'Staircase Landing',
                  'Terrace / Roof',
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      if (!specificLocation) {
                        setSpecificLocation(chip);
                      } else if (!specificLocation.includes(chip)) {
                        setSpecificLocation(`${specificLocation}, ${chip}`);
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-700 text-xs border border-slate-200 transition-colors cursor-pointer"
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mt-1.5">
              Manual location entry is always supported and helps workers find the spot quickly.
            </p>
          </div>

          {/* Browser Geolocation (Optional with clear fallbacks) */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-teal-700" />
                <span className="text-xs font-bold text-slate-800">Pin GPS Coordinates (Optional)</span>
              </div>
              <button
                type="button"
                onClick={handleGetLocation}
                disabled={geoStatus === 'loading'}
                className="px-3 py-1 bg-white hover:bg-teal-50 text-teal-800 border border-teal-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>{geoStatus === 'loading' ? 'Locating...' : 'Use Current Location'}</span>
              </button>
            </div>

            {geoMessage && (
              <div
                className={`text-xs p-2.5 rounded-lg border ${
                  geoStatus === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : geoStatus === 'denied' || geoStatus === 'unavailable'
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-teal-50 border-teal-200 text-teal-800'
                }`}
              >
                {geoMessage}
              </div>
            )}

            {/* GPS Limitations Notice */}
            <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-start gap-2 text-[11px] text-slate-600">
              <Compass className="w-3.5 h-3.5 text-teal-700 shrink-0 mt-0.5" />
              <span>
                <strong>GPS & Location Notice:</strong> Device geolocation is optional. Accuracy depends on browser permissions, GPS hardware, and satellite reception. Manual location selection is always supported.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (validateStep2()) setCurrentStep(3);
              }}
              className="px-5 py-2.5 bg-teal-800 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <span>Continue to Review</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Review & Submit */}
      {currentStep === 3 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">Review Report Details</h2>
            <p className="text-xs text-slate-500">
              Check all entered information before submitting to management.
            </p>
          </div>

          <div className="space-y-3.5 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Category & Description</span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="text-teal-700 font-bold hover:underline text-[11px]"
                >
                  Edit
                </button>
              </div>
              <div className="inline-block px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-medium">
                {category}
              </div>
              <p className="text-slate-700 whitespace-pre-wrap mt-1 text-xs">{description}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Location</span>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="text-teal-700 font-bold hover:underline text-[11px]"
                >
                  Edit
                </button>
              </div>
              <div className="text-xs font-semibold text-slate-800">
                {block} • {specificLocation}
              </div>
              {latitude && longitude && (
                <div className="text-[11px] text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-teal-700" />
                  <span>GPS: {latitude.toFixed(5)}, {longitude.toFixed(5)}</span>
                </div>
              )}
            </div>

            {/* Priority Assessment & Asset Summary */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Asset & Priority Assessment</span>
              <div className="flex flex-wrap items-center gap-2">
                {selectedAsset ? (
                  <span className="px-2.5 py-1 rounded bg-teal-100 text-teal-800 text-xs font-semibold">
                    Asset: {selectedAsset.name} ({selectedAsset.assetCode})
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded bg-slate-200 text-slate-700 text-xs">
                    No specific asset linked
                  </span>
                )}
                {livePriorityAssessment && (
                  <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                    livePriorityAssessment.level === 'Critical' ? 'bg-red-100 text-red-800' :
                    livePriorityAssessment.level === 'High' ? 'bg-amber-100 text-amber-800' :
                    livePriorityAssessment.level === 'Medium' ? 'bg-blue-100 text-blue-800' :
                    'bg-slate-200 text-slate-800'
                  }`}>
                    Priority: {livePriorityAssessment.level} ({livePriorityAssessment.score}/100)
                  </span>
                )}
              </div>
              {livePriorityAssessment && (
                <div className="text-[11px] text-slate-600 font-mono">
                  Formula: P = 7({severity}) + 5({selectedAsset ? Math.max(affected, selectedAsset.criticality) : affected}) + 4(1) + 4({recurrenceScore}) = {livePriorityAssessment.score}/100
                </div>
              )}
            </div>

            {images.length > 0 && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Attached Photographs ({images.length})</span>
                <div className="flex gap-2">
                  {images.map((img) => (
                    <img key={img.id} src={img.previewUrl} alt="Thumbnail" className="w-14 h-14 object-cover rounded-lg border border-slate-200" />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Optional Urgent Attention Request */}
          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2.5">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={requestUrgent}
                onChange={(e) => setRequestUrgent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-amber-400 text-teal-800 focus:ring-teal-700"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Request urgent attention for this issue
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Note: Community management reviews all requests and sets the final operational priority.
                </span>
              </div>
            </label>

            {requestUrgent && (
              <div className="pt-1">
                <label className="block text-[11px] font-bold text-amber-900 mb-1">
                  Reason for Urgency <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={urgentReason}
                  onChange={(e) => setUrgentReason(e.target.value)}
                  placeholder="e.g. Active water seepage reaching electric mains, or open pit hazard"
                  className="w-full text-xs px-3 py-2 border border-amber-300 rounded-lg focus:ring-1 focus:ring-amber-500 focus:outline-none bg-white"
                />
              </div>
            )}
          </div>

          {/* Submission and Sync Notice */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5 text-[11px] text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <span>
              <strong>Submission & Data Handling:</strong> Complaints are verified, timestamped, and dispatched immediately to management. Records are also retained in local storage for offline continuity.
            </span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmitComplaint}
              className="px-6 py-2.5 bg-teal-800 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Submitting Record...</span>
                </>
              ) : (
                <>
                  <span>Submit Complaint</span>
                  <CheckCircle2 className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Duplicate Safe Summary Modal */}
      {showDuplicateModal && duplicateWarning.similarComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Existing Similar Complaint</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowDuplicateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs space-y-2 text-slate-600">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-slate-800">
                    {duplicateWarning.similarComplaint.reference}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold text-[10px]">
                    {duplicateWarning.similarComplaint.status}
                  </span>
                </div>
                <div className="font-semibold text-slate-900">
                  {duplicateWarning.similarComplaint.title}
                </div>
                <div className="text-[11px] text-slate-500">
                  {duplicateWarning.similarComplaint.category} • {duplicateWarning.similarComplaint.block}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 italic">
                Resident names and private contact details are withheld for privacy. You may still proceed with your submission if your report concerns a separate or distinct issue.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowDuplicateModal(false)}
                className="px-4 py-1.5 bg-teal-800 hover:bg-teal-700 text-white text-xs font-bold rounded-lg"
              >
                Continue Submission
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
