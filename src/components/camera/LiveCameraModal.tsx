import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  RotateCcw,
  Check,
  X,
  AlertTriangle,
  MapPin,
  Loader2,
  Shield,
  RefreshCw,
} from 'lucide-react';
import type { GeoLocationData } from '../../types';
import { formatCoordinates, isLocationFresh } from '../../lib/geoUtils';
import { generateStampedPhoto } from '../../lib/photoStamper';
import { reverseGeocodeCoordinates } from '../../lib/reverseGeocode';

export interface LiveCaptureResult {
  rawBlob: Blob;
  stampedBlob: Blob;
  geoData: GeoLocationData;
  previewUrl: string;
}

interface LiveCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoCaptured: (result: LiveCaptureResult) => void;
  communityName?: string;
  title?: string;
  onEnterManually?: () => void;
}

export const LiveCameraModal: React.FC<LiveCameraModalProps> = ({
  isOpen,
  onClose,
  onPhotoCaptured,
  communityName = 'Community Connect',
  title = 'Take Live Issue Photograph',
  onEnterManually,
}) => {
  // Stream & Video states
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  // Geolocation states
  const [locationData, setLocationData] = useState<GeoLocationData | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    'idle' | 'acquiring' | 'ready' | 'poor_accuracy' | 'stale' | 'denied' | 'unavailable' | 'timeout'
  >('idle');
  const [locationError, setLocationError] = useState<string | null>(null);
  const geoWatchIdRef = useRef<number | null>(null);

  // Error & Status
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Captured preview state
  const [capturedRawBlob, setCapturedRawBlob] = useState<Blob | null>(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(null);
  const [isProcessingStamp, setIsProcessingStamp] = useState(false);

  // Stop camera tracks helper
  const stopCameraStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (geoWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(geoWatchIdRef.current);
      geoWatchIdRef.current = null;
    }
    setIsVideoReady(false);
  }, [stream]);

  // Handle closing modal
  const handleModalClose = useCallback(() => {
    stopCameraStream();
    if (capturedPreviewUrl) {
      URL.revokeObjectURL(capturedPreviewUrl);
      setCapturedPreviewUrl(null);
    }
    setCapturedRawBlob(null);
    onClose();
  }, [stopCameraStream, capturedPreviewUrl, onClose]);

  // Check camera support & device enumerate
  useEffect(() => {
    if (!isOpen) return;

    // Check secure context (getUserMedia requires HTTPS or localhost)
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';
    if (!window.isSecureContext && !isLocalhost) {
      setCameraError('In-app camera capture requires a secure connection (HTTPS) or localhost.');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Your browser does not support in-app camera capture. Please use a modern browser.');
      return;
    }

    // Check if multiple cameras exist (rear/front toggle)
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setHasMultipleCameras(videoInputs.length > 1);
      })
      .catch(() => setHasMultipleCameras(false));
  }, [isOpen]);

  // Acquire Geolocation reading
  const acquireFreshLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('unavailable');
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setLocationStatus('acquiring');
    setLocationError(null);

    const onLocationSuccess = (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy, altitude } = pos.coords;
      const locTimestamp = new Date(pos.timestamp).toISOString();

      // Check accuracy (threshold <= 150m)
      if (accuracy > 150) {
        setLocationStatus('poor_accuracy');
        setLocationError(`GPS accuracy is ±${Math.round(accuracy)}m (required ≤150m). Moving outdoors or near a window improves accuracy.`);
        return;
      }

      // Check freshness (< 60 seconds)
      if (!isLocationFresh(pos.timestamp, 60)) {
        setLocationStatus('stale');
        setLocationError('Location reading was stale. Waiting for fresh satellite fix...');
        return;
      }

      const freshGeo: GeoLocationData = {
        latitude,
        longitude,
        accuracy,
        altitude,
        locationTimestamp: locTimestamp,
        clientCaptureTimestamp: new Date().toISOString(),
      };

      setLocationData(freshGeo);
      setLocationStatus('ready');
      setLocationError(null);
    };

    const onLocationError = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) {
        setLocationStatus('denied');
        setLocationError('Location permission was denied. Location tagging is required for live issue verification.');
      } else if (err.code === err.TIMEOUT) {
        setLocationStatus('timeout');
        setLocationError('GPS location request timed out. Please click Retry.');
      } else {
        setLocationStatus('unavailable');
        setLocationError('GPS location is currently unavailable. Please check location settings.');
      }
    };

    // Watch position for continuous high-accuracy fix
    if (geoWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(geoWatchIdRef.current);
    }

    geoWatchIdRef.current = navigator.geolocation.watchPosition(
      onLocationSuccess,
      onLocationError,
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 15000,
      }
    );
  }, []);

  // Start Camera stream
  const startCameraStream = useCallback(async () => {
    setCameraError(null);
    setIsVideoReady(false);

    try {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false, // strictly no microphone
      });

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera access was denied. Please allow camera permissions in browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera found on your device.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError('Camera is already in use by another application.');
      } else {
        setCameraError(err.message || 'Unable to access camera stream.');
      }
    }
  }, [facingMode, stream]);

  // Initial startup when modal opens
  useEffect(() => {
    if (isOpen && !capturedRawBlob) {
      startCameraStream();
      acquireFreshLocation();
    } else if (!isOpen) {
      stopCameraStream();
    }

    return () => {
      stopCameraStream();
    };
  }, [isOpen]);

  // Attach stream to video tag whenever stream changes
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Switch facing mode (Front/Back)
  const handleToggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Capture frame from active stream
  const handleCaptureFrame = () => {
    if (!videoRef.current || !isVideoReady || !locationData) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCapturedRawBlob(blob);
        const preview = URL.createObjectURL(blob);
        setCapturedPreviewUrl(preview);
        stopCameraStream();
      },
      'image/jpeg',
      0.95
    );
  };

  // Retake photo: discard captured frame, resume camera & GPS
  const handleRetake = () => {
    if (capturedPreviewUrl) {
      URL.revokeObjectURL(capturedPreviewUrl);
      setCapturedPreviewUrl(null);
    }
    setCapturedRawBlob(null);
    startCameraStream();
    acquireFreshLocation();
  };

  // Confirm photo: stamp photo and pass result back
  const handleAcceptPhoto = async () => {
    if (!capturedRawBlob || !locationData) return;

    setIsProcessingStamp(true);

    try {
      // 1. Try reverse geocoding address
      let resolvedAddress: string | null = null;
      try {
        resolvedAddress = await reverseGeocodeCoordinates(
          locationData.latitude,
          locationData.longitude
        );
      } catch {
        resolvedAddress = null;
      }

      const finalGeoData: GeoLocationData = {
        ...locationData,
        address: resolvedAddress || undefined,
      };

      // 2. Generate stamped copy
      const stampedBlob = await generateStampedPhoto(capturedRawBlob, finalGeoData, {
        communityName,
      });

      const previewUrl = URL.createObjectURL(stampedBlob);

      onPhotoCaptured({
        rawBlob: capturedRawBlob,
        stampedBlob,
        geoData: finalGeoData,
        previewUrl,
      });

      handleModalClose();
    } catch (err) {
      console.error('Failed to stamp photo:', err);
      // Fallback: use raw blob
      const previewUrl = URL.createObjectURL(capturedRawBlob);
      onPhotoCaptured({
        rawBlob: capturedRawBlob,
        stampedBlob: capturedRawBlob,
        geoData: locationData,
        previewUrl,
      });
      handleModalClose();
    } finally {
      setIsProcessingStamp(false);
    }
  };

  if (!isOpen) return null;

  const canCapture = isVideoReady && locationStatus === 'ready' && locationData !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-slate-900 text-white rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-700 flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-teal-400" />
            <h3 className="font-bold text-sm sm:text-base">{title}</h3>
          </div>
          <button
            type="button"
            onClick={handleModalClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            aria-label="Close camera"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational Disclosure Banner */}
        <div className="px-4 py-2 bg-teal-950/60 border-b border-teal-900/50 flex items-start gap-2 text-[11px] text-teal-200">
          <Shield className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
          <span>
            <strong>Required Live Workflow:</strong> Your camera and location are used exclusively to record issue evidence at the actual scene. Gallery uploads, file picking, and past attachments are disabled.
          </span>
        </div>

        {/* Viewfinder / Preview Body */}
        <div className="relative flex-1 bg-black min-h-[320px] max-h-[500px] flex items-center justify-center overflow-hidden">
          {/* 1. Captured Photo Preview Screen */}
          {capturedPreviewUrl && (
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <img
                src={capturedPreviewUrl}
                alt="Captured live frame"
                className="max-h-[460px] w-full object-contain"
              />
              {/* Overlay preview tag */}
              <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/70 backdrop-blur-xs rounded-lg border border-teal-500/40 text-[11px] text-teal-300 font-mono flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-teal-400" />
                <span>
                  {locationData ? formatCoordinates(locationData.latitude, locationData.longitude) : 'GPS Tagged'}
                </span>
              </div>
            </div>
          )}

          {/* 2. Live Camera Viewfinder */}
          {!capturedPreviewUrl && (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={() => setIsVideoReady(true)}
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />

              {/* Stream initializing spinner */}
              {!isVideoReady && !cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-slate-300 gap-2 text-xs">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
                  <span>Connecting to camera sensor...</span>
                </div>
              )}

              {/* Camera Error Display */}
              {cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-slate-900/95 text-center space-y-3">
                  <AlertTriangle className="w-10 h-10 text-amber-500" />
                  <h4 className="font-bold text-sm text-amber-200">Camera Unavailable</h4>
                  <p className="text-xs text-slate-300 max-w-sm">{cameraError}</p>
                  <button
                    type="button"
                    onClick={startCameraStream}
                    className="px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Camera Access</span>
                  </button>
                </div>
              )}

              {/* Live Location Tag on Viewfinder */}
              {isVideoReady && !cameraError && (
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                  <div
                    className={`px-2.5 py-1 rounded-lg backdrop-blur-xs text-[11px] font-mono flex items-center gap-1.5 border shadow-lg ${
                      locationStatus === 'ready'
                        ? 'bg-black/70 text-emerald-300 border-emerald-500/50'
                        : locationStatus === 'acquiring'
                        ? 'bg-black/70 text-amber-300 border-amber-500/50'
                        : 'bg-black/70 text-rose-300 border-rose-500/50'
                    }`}
                  >
                    {locationStatus === 'acquiring' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <MapPin className="w-3.5 h-3.5 text-current" />
                    )}
                    <span>
                      {locationStatus === 'ready' && locationData
                        ? `${formatCoordinates(locationData.latitude, locationData.longitude)} (±${Math.round(locationData.accuracy)}m)`
                        : locationStatus === 'acquiring'
                        ? 'Acquiring GPS fix...'
                        : locationError || 'Location needed'}
                    </span>
                  </div>

                  {hasMultipleCameras && (
                    <button
                      type="button"
                      onClick={handleToggleFacingMode}
                      className="pointer-events-auto p-2 bg-black/60 hover:bg-black text-white rounded-xl border border-slate-700 text-xs font-bold transition-all cursor-pointer shadow-lg"
                      title="Switch Camera (Front/Rear)"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Location Notice / Error Footer */}
        {locationError && !capturedPreviewUrl && (
          <div className="px-4 py-2.5 bg-amber-950/80 border-t border-amber-900/60 text-xs text-amber-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{locationError}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={acquireFreshLocation}
                className="px-2.5 py-1 bg-amber-800/80 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold cursor-pointer"
              >
                Retry GPS
              </button>
              {onEnterManually && (
                <button
                  type="button"
                  onClick={() => {
                    handleModalClose();
                    onEnterManually();
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-medium cursor-pointer"
                >
                  Enter Manually
                </button>
              )}
            </div>
          </div>
        )}

        {/* Controls Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          {!capturedPreviewUrl ? (
            <>
              <button
                type="button"
                onClick={handleModalClose}
                className="px-4 py-2 text-slate-400 hover:text-white text-xs font-semibold"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleCaptureFrame}
                disabled={!canCapture}
                className={`px-6 py-2.5 rounded-xl text-xs font-black shadow-lg flex items-center gap-2 transition-all cursor-pointer ${
                  canCapture
                    ? 'bg-teal-500 hover:bg-teal-400 text-slate-950 scale-100'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>
                  {!isVideoReady
                    ? 'Preparing Camera...'
                    : locationStatus === 'acquiring'
                    ? 'Acquiring GPS Fix...'
                    : !locationData
                    ? 'GPS Location Required'
                    : 'Capture Photo'}
                </span>
              </button>

              <div className="w-16" />
            </>
          ) : (
            <div className="w-full flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleRetake}
                disabled={isProcessingStamp}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <span>Retake</span>
              </button>

              <div className="text-[11px] text-slate-400 text-center truncate hidden sm:block">
                {locationData && formatCoordinates(locationData.latitude, locationData.longitude)}
              </div>

              <button
                type="button"
                onClick={handleAcceptPhoto}
                disabled={isProcessingStamp}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg cursor-pointer disabled:opacity-50"
              >
                {isProcessingStamp ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Stamping & Validating...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Use This Photo</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
