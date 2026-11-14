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
  | 'Reopened'
  | 'Pending';

export const COMPLAINT_STATUSES: ComplaintStatus[] = [
  'Submitted',
  'Under Review',
  'Assigned',
  'In Progress',
  'Resolved',
  'Closed',
  'Rejected',
  'Reopened',
  'Pending',
];

export type ComplaintPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type UrgencyLevel = 'Low' | 'Medium' | 'High' | 'Urgent' | 'Emergency';

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
  skills?: string[];
  supportedCategories?: ComplaintCategory[];
  completedTasksCount?: number;
  activeWorkload?: number;
  averageRating?: number;
  availabilityStatus?: 'Available' | 'Busy' | 'On Leave';
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  assetCode: string; // e.g. "AST-ELEV-01", "AST-PUMP-01"
  name: string;
  category: ComplaintCategory;
  building: string;
  location: string;
  criticality: number; // 1 to 5 scale
  condition: 'Operational' | 'Degraded' | 'Critical Failure' | 'Maintenance Due';
  installationDate?: string;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  frequencyDays?: number;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PriorityAssessment {
  severity: number; // S (0-5)
  affected: number; // A (0-5)
  waitingTime: number; // W (0-5)
  recurrence: number; // R (0-5)
  score: number; // P = 7S + 5A + 4W + 4R (max 100)
  level: 'Low' | 'Medium' | 'High' | 'Critical';
  breakdown: {
    safetyScore: number;
    affectedScore: number;
    waitingScore: number;
    recurrenceScore: number;
  };
  formula: string;
  explanation: string;
  isOverridden?: boolean;
  originalScore?: number;
  originalLevel?: 'Low' | 'Medium' | 'High' | 'Critical';
  overrideReason?: string;
  overriddenBy?: string;
  overriddenAt?: string;
}

export interface DuplicateMatch {
  matchedComplaintId: string;
  matchedReference: string;
  matchedTitle: string;
  category: ComplaintCategory;
  block: string;
  similarityScore: number; // 0 to 100
  factors: string[];
  status: 'Flagged' | 'Confirmed' | 'Dismissed' | 'Separate Issue';
}

export interface CommunityKnowledgeItem {
  id: string;
  category:
    | 'Water Schedule'
    | 'Garbage Schedule'
    | 'Maintenance Contact'
    | 'Emergency Contact'
    | 'Community Rule'
    | 'Notice'
    | 'FAQ'
    | 'Maintenance Timings';
  title: string;
  content: string;
  details?: Record<string, any>;
  sourceName?: string;
  active: boolean;
  lastUpdated: string;
  createdAt: string;
}

export interface UserAccount {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  salt: string;
  role: RoleType;
  fullName: string;
  phone?: string;
  active: boolean;
  residentId?: string;
  workerId?: string;
  createdAt: string;
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
  // Asset binding (Manual search only - NO QR)
  assetId?: string;
  assetCode?: string;
  assetName?: string;
  latitude?: number;
  longitude?: number;
  priority: ComplaintPriority;
  suggestedPriority?: ComplaintPriority;
  priorityReason?: string;
  priorityAssessment?: PriorityAssessment;
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
  managerReviewDecision?: 'Approved' | 'Flagged' | 'Uncertain' | 'Dismissed';
  managerReviewNotes?: string;
  managerReviewedAt?: string;
  managerReviewedBy?: string;
  // Duplicate detection details
  isDuplicate?: boolean;
  duplicateOfId?: string;
  duplicateStatus?: 'None' | 'Flagged' | 'Confirmed' | 'Dismissed' | 'Linked';
  duplicateMatch?: DuplicateMatch;
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
  // AI WhatsApp Routing Extension
  organizationId?: string;
  source?: 'web' | 'whatsapp' | 'WhatsApp' | 'Mock WhatsApp' | 'Web' | string;
  externalMessageId?: string;
  reporterPhone?: string;
  aiExtractedUrgency?: 'Low' | 'Medium' | 'High' | 'Urgent' | 'Emergency';
  recommendedContactId?: string;
  recommendedContactName?: string;
  matchScore?: number;
  matchReason?: string;
  supportingMessageEvidence?: string | string[];
  needsClarification?: boolean;
  clarificationQuestion?: string;
  routingStatus?:
    | 'Auto-Matched'
    | 'Needs Clarification'
    | 'Awaiting Confirmation'
    | 'Routed'
    | 'Manual Required'
    | 'Auto-Routed'
    | 'Recommended'
    | 'Requires Review';
  location?: string;
  urgency?: UrgencyLevel | string;
  priorityRank?: number;
  verificationAttempts?: any[];
  escalated?: boolean;
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
  | 'Created'
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

// --- Organizations & Memberships ---
export interface Organization {
  id: string;
  name: string;
  organizationType: 'RWA' | 'Municipal Corporation' | 'Maintenance Agency' | 'Facility Management' | 'Other';
  serviceAreas: string[];
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface OrganizationMembership {
  id: string;
  organizationId: string;
  userId: string;
  role: 'Admin' | 'Dispatcher' | 'Viewer';
  createdAt: string;
}

// --- Contact Directory ---
export interface Contact {
  id: string;
  organizationId: string;
  name: string;
  role: string; // e.g. "Lead Electrician", "Sanitation Supervisor", "Ward Officer"
  department: string; // e.g. "Electrical", "Water & Sanitation", "Civil Works"
  phoneNumber: string;
  email?: string;
  categories: ComplaintCategory[];
  serviceAreas: string[]; // Blocks or Ward numbers
  verified: boolean;
  active: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Authorized Group Messages ---
export interface AuthorizedGroupMessage {
  id: string;
  organizationId: string;
  sourceName: string; // e.g. "Block A Residents Noticeboard", "Maintenance Alert Group"
  sourceType: 'WhatsApp Community' | 'Telegram Official' | 'Admin Notice' | 'Exported CSV' | 'Direct Import' | string;
  messageText: string;
  messageTimestamp: string;
  permissionStatus: 'Authorized' | 'Pending Review' | 'Revoked';
  importedBy: string;
  categoryTag?: ComplaintCategory;
  locationTag?: string;
  createdAt: string;
}

// --- AI Complaint Understanding & Analysis ---
export interface AIComplaintAnalysis {
  category: ComplaintCategory;
  confidence: number; // 0 to 1
  description: string;
  summary?: string;
  location: string;
  urgency: UrgencyLevel | 'Urgent';
  language?: string;
  needsClarification: boolean;
  clarificationQuestion?: string;
  missingDetails?: string[];
  rawSummary?: string;
  isAiGenerated?: boolean;
  modelUsed?: string;
  extractedKeywords?: string[];
  keywords?: string[];
  sentiment?: string;
  reasoning?: string;
}

// --- Contact Matching Engine ---
export interface ContactMatchScore {
  contactId?: string;
  contactName?: string;
  contactRole?: string;
  department?: string;
  contact?: Contact;
  totalScore: number; // 0 to 100
  breakdown: {
    categoryScore?: number;
    locationScore?: number;
    roleScore?: number;
    evidenceScore?: number;
    categoryMatch?: number; // Max 40%
    locationMatch?: number; // Max 30%
    roleResponsibilityMatch?: number; // Max 20%
    messageEvidenceMatch?: number; // Max 10%
  };
  explanation?: string;
  reason?: string;
  supportingEvidence?: string[];
  supportingMessages?: AuthorizedGroupMessage[];
}

export interface ComplaintAssignmentRecord {
  id: string;
  complaintId: string;
  organizationId: string;
  contactId: string;
  contactName?: string;
  matchScore: number;
  matchReason: string;
  supportingEvidence?: string | string[];
  assignmentStatus:
    | 'Pending Confirmation'
    | 'Confirmed'
    | 'Dispatched'
    | 'Acknowledged'
    | 'Rejected'
    | 'Auto-Assigned'
    | 'Suggested'
    | 'Manager-Assigned';
  assignedBy: string; // 'AI Router' or User Name
  candidateRank?: number;
  breakdown?: {
    categoryScore: number;
    locationScore: number;
    roleScore: number;
    evidenceScore: number;
  };
  createdAt: string;
  updatedAt?: string;
}

// --- Audit Logging ---
export interface AuditLogEntry {
  id: string;
  organizationId: string;
  actorId: string;
  actorRole?: string;
  actorName?: string;
  action:
    | 'CONTACT_CREATED'
    | 'CONTACT_VERIFIED'
    | 'CONTACT_DEACTIVATED'
    | 'MESSAGES_IMPORTED'
    | 'AI_CLASSIFIED'
    | 'CONTACT_MATCHED'
    | 'COMPLAINT_ROUTED'
    | 'ASSIGNMENT_CONFIRMED'
    | 'STATUS_CHANGED'
    | 'SETTINGS_UPDATED'
    | 'VERIFY_CONTACT'
    | 'UNVERIFY_CONTACT'
    | 'ACTIVATE_CONTACT'
    | 'DEACTIVATE_CONTACT'
    | 'IMPORT_CONTACTS_CSV'
    | 'DELETE_GROUP_MESSAGE'
    | 'IMPORT_GROUP_MESSAGES_CSV'
    | 'ROUTED_COMPLAINT'
    | 'REASSIGN_CONTACT'
    | 'UPDATE_INTEGRATION_SETTINGS'
    | string;
  recordType:
    | 'Contact'
    | 'Complaint'
    | 'GroupMessage'
    | 'Assignment'
    | 'Setting'
    | 'CONTACT'
    | 'COMPLAINT'
    | 'GROUP_MESSAGE'
    | 'INTEGRATION_CONFIG'
    | string;
  recordId: string;
  details: string | Record<string, any>;
  createdAt: string;
}

// --- WhatsApp Integration Models ---
export interface WhatsAppIncomingMessage {
  messageId: string;
  fromPhoneNumber: string;
  senderName?: string;
  text: string;
  timestamp: string;
  hasMedia?: boolean;
  mediaUrl?: string;
  rawPayload?: any;
}

export interface WhatsAppOutgoingReply {
  id?: string;
  toPhoneNumber?: string;
  toPhone?: string;
  text?: string;
  messageText?: string;
  complaintReference?: string;
  timestamp: string;
  status: 'Simulated' | 'Sent' | 'Delivered' | 'Failed';
  error?: string;
}

export interface WhatsAppIntegrationConfig {
  id: string;
  enabled: boolean;
  mode?: 'simulator' | 'meta_cloud_api';
  aiProvider?: 'local' | 'openai';
  phoneNumberId?: string;
  businessAccountId?: string;
  verifyToken?: string;
  whatsappVerifyToken?: string;
  accessToken?: string;
  appSecret?: string;
  apiVersion?: string;
  webhookUrl?: string;
  openAiApiKey?: string;
  openaiApiKey?: string;
  openAiModel?: string;
  aiModel?: string;
  minConfidenceThreshold?: number;
  minimumConfidenceThreshold?: number;
  autoRoutingEnabled?: boolean;
  autoRoutingThreshold?: number;
  requireAdminConfirmation?: boolean;
  defaultOrganizationId?: string;
  updatedAt: string;
}

export const DEFAULT_INTEGRATION_CONFIG: WhatsAppIntegrationConfig = {
  id: 'default-integration-config',
  enabled: true,
  mode: 'simulator',
  aiProvider: 'local',
  phoneNumberId: '',
  businessAccountId: '',
  verifyToken: 'community_connect_verify_token',
  whatsappVerifyToken: 'community_connect_verify_token',
  accessToken: '',
  appSecret: '',
  apiVersion: 'v21.0',
  webhookUrl: 'http://localhost:5173/api/whatsapp/webhook',
  openAiApiKey: '',
  openaiApiKey: '',
  openAiModel: 'gpt-4o-mini',
  aiModel: 'gpt-4o-mini',
  minConfidenceThreshold: 40,
  minimumConfidenceThreshold: 40,
  autoRoutingEnabled: true,
  autoRoutingThreshold: 70,
  requireAdminConfirmation: false,
  defaultOrganizationId: 'org-rwa-1',
  updatedAt: new Date().toISOString(),
};

