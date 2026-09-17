// Domain models for Community Connect Prototype

export type ComplaintCategory =
  | 'Garbage'
  | 'Roads and Potholes'
  | 'Streetlights'
  | 'Drainage'
  | 'Water Leakage'
  | 'Common-Area Electrical'
  | 'Other';

export const COMPLAINT_CATEGORIES: ComplaintCategory[] = [
  'Garbage',
  'Roads and Potholes',
  'Streetlights',
  'Drainage',
  'Water Leakage',
  'Common-Area Electrical',
  'Other',
];

export type ComplaintStatus =
  | 'Submitted'
  | 'Under Review'
  | 'Assigned'
  | 'In Progress'
  | 'Resolved'
  | 'Closed'
  | 'Rejected'
  | 'Reopened';

export const COMPLAINT_STATUSES: ComplaintStatus[] = [
  'Submitted',
  'Under Review',
  'Assigned',
  'In Progress',
  'Resolved',
  'Closed',
  'Rejected',
  'Reopened',
];

export type ComplaintPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export const COMPLAINT_PRIORITIES: ComplaintPriority[] = ['Low', 'Medium', 'High', 'Urgent'];

export type RoleType = 'Resident' | 'Manager' | 'Worker';

export interface CommunitySettings {
  id: string;
  name: string;
  address: string;
  blocks: string[];
  geminiApiKey?: string;
  updatedAt: string;
}

export const DEFAULT_SETTINGS: CommunitySettings = {
  id: 'community-default',
  name: 'Green Meadows Gated Community',
  address: '42 Palm Avenue, Sector 5',
  blocks: ['Block A', 'Block B', 'Block C', 'Block D', 'Clubhouse', 'Common Grounds'],
  updatedAt: new Date().toISOString(),
};

export interface Resident {
  id: string;
  displayName: string;
  block: string;
  flatNumber: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Worker {
  id: string;
  name: string;
  contactNumber?: string;
  specialty: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Complaint {
  id: string;
  reference: string;
  residentId: string;
  residentName: string;
  residentBlock: string;
  residentFlat?: string;
  title: string;
  description: string;
  category: ComplaintCategory;
  suggestedCategory?: ComplaintCategory;
  block: string;
  specificLocation: string;
  latitude?: number;
  longitude?: number;
  priority: ComplaintPriority;
  suggestedPriority?: ComplaintPriority;
  priorityReason?: string;
  status: ComplaintStatus;
  assignedWorkerId?: string;
  assignedWorkerName?: string;
  assignedAt?: string;
  originalImageIds: string[];
  requestUrgentAttention?: boolean;
  urgentReason?: string;
  rejectionReason?: string;
  reopenReason?: string;
  correctionReason?: string;
  completionAwaitingReview?: boolean;
  completionNotes?: string;
  completionImageIds?: string[];
  completionSubmittedAt?: string;
  rating?: number;
  ratingFeedback?: string;
  ratingUpdatedAt?: string;
  // Verification and Suspicious flags
  isSuspicious?: boolean;
  suspiciousFlags?: SuspiciousFlag[];
  dismissedSuspiciousFlags?: boolean;
  imageVerificationStatus?: 'Verified' | 'Mismatch' | 'Uncertain' | 'Unavailable';
  visualCategorySuggested?: ComplaintCategory | 'Uncertain';
  visualExplanation?: string;
  // Geolocation & Live Capture Metadata
  captureLatitude?: number;
  captureLongitude?: number;
  captureAccuracy?: number;
  captureLocationTimestamp?: string;
  captureClientTimestamp?: string;
  captureServerTimestamp?: string;
  captureSessionId?: string;
  captureAddress?: string;
  isLiveCapture?: boolean;
  reportedLatitude?: number; // Separate resident map pin if adjusted
  reportedLongitude?: number;
  // Worker completion location check
  completionLatitude?: number;
  completionLongitude?: number;
  completionAccuracy?: number;
  completionDistanceToIssueMeters?: number;
  completionLocationDiscrepancy?: boolean;
  completionLocationDetails?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  closedAt?: string;
}

export interface ImageQualityReport {
  brightness: number; // 0-255 average luminance
  sharpness: number; // edge variance
  isDark: boolean;
  isBlurry: boolean;
  status: 'Clear' | 'Blurry' | 'Too Dark' | 'Low Contrast';
  feedback?: string;
}

export type SuspiciousFlagType =
  | 'REUSED_PHOTO'
  | 'CATEGORY_MISMATCH'
  | 'UNUSABLE_IMAGE'
  | 'POSSIBLE_SCREEN_PHOTO'
  | 'LOCATION_DISCREPANCY';

export interface SuspiciousFlag {
  type: SuspiciousFlagType;
  severity: 'warning' | 'suspicious';
  details: string;
  matchedComplaintId?: string;
  matchedComplaintReference?: string;
  matchedImageId?: string;
  similarityPercentage?: number;
}

export interface GeoLocationData {
  latitude: number;
  longitude: number;
  accuracy: number; // meters
  altitude?: number | null;
  locationTimestamp: string;
  clientCaptureTimestamp: string;
  serverReceivedTimestamp?: string;
  address?: string;
}

export interface CaptureSession {
  id: string;
  token: string;
  userId: string;
  role: RoleType;
  communityId: string;
  draftType: 'complaint' | 'worker_completion';
  draftId: string;
  createdAt: string;
  expiresAt: string;
  isConsumed: boolean;
  consumedAt?: string;
  consumedWithImageHash?: string;
}

export interface StampedImageRecord {
  originalImageId: string;
  stampedImageId?: string;
  sessionId: string;
  geo: GeoLocationData;
  formattedCoordinates: string;
  stampedAt: string;
}

export type ComplaintEventType =
  | 'Submitted'
  | 'UnderReview'
  | 'Assigned'
  | 'Reassigned'
  | 'WorkStarted'
  | 'ProgressUpdate'
  | 'CompletionSubmitted'
  | 'CorrectionRequested'
  | 'Resolved'
  | 'Closed'
  | 'Reopened'
  | 'Rejected'
  | 'InternalNote'
  | 'ResidentUpdate'
  | 'CategoryChanged'
  | 'PriorityChanged'
  | 'FlagDismissed'
  | 'ImageVerified';

export interface ComplaintEvent {
  id: string;
  complaintId: string;
  eventType: ComplaintEventType;
  action: string;
  actorRole: 'Resident' | 'Manager' | 'Worker' | 'System';
  actorName: string;
  visibility: 'public' | 'internal';
  note?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  recipientRole: 'Resident' | 'Manager' | 'Worker';
  recipientId?: string; // Resident ID or Worker ID, or 'ALL' for Manager
  complaintId?: string;
  title: string;
  message: string;
  readAt?: string;
  createdAt: string;
  deduplicationKey?: string;
}

export interface ImageAsset {
  id: string;
  complaintId?: string;
  blob: Blob;
  stampedBlob?: Blob;
  mimeType: string;
  originalName: string;
  size: number;
  createdAt: string;
  perceptualHash?: string; // 64-bit dHash hex string
  contentHash?: string; // SHA-256 or digest hex
  quality?: ImageQualityReport;
  captureSessionId?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  locationTimestamp?: string;
  clientCaptureTimestamp?: string;
  serverReceivedTimestamp?: string;
  address?: string;
  isLiveCapture?: boolean;
}
