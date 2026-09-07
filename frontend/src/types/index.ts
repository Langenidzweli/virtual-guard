// frontend/src/types/index.ts

export type CameraStatus = 'idle' | 'normal' | 'review' | 'alert' | 'offline'

export type PipelineStage =
  | 'queued'
  | 'extracting-frames'
  | 'validating-video'
  | 'vision-analysis'
  | 'detecting-people'
  | 'tracking-individuals'
  | 'behaviour-analysis'
  | 'calculating-score'
  | 'generating-result'
  | 'complete'
  | 'failed'

export interface PipelineStep {
  stage: PipelineStage
  label: string
}

export type DetectionEventType =
  | 'PERSON_DETECTED'
  | 'VEHICLE_DETECTED'
  | 'INTRUSION_DETECTED'
  | 'WEAPON_DETECTED'
  | 'FIRE_DETECTED'
  | 'SUSPICIOUS_ACTIVITY'
  | 'CAMERA_OFFLINE'

export interface AIDetection {
  type: DetectionEventType
  confidence: number
  detectedAt: string
}

export interface CameraFeed {
  id: string
  jobId?: string
  behaviour?: string
  confidence?: number | null
  suspicionScore?: number | null
  annotatedVideoFileName?: string | null
  location: string
  fileName: string | null
  status: CameraStatus
  currentStage: PipelineStage
  progressPercent: number
  isAnalyzing: boolean
  isUploading?: boolean      // ← Add this
  uploadProgress?: number    // ← Add this
  latestDetection: AIDetection | null
}

export interface StoreCamera {
  id: string
  label: string
  status: CameraStatus
  x: number
  y: number
  monitored: boolean
  siteId?: string
  streamUrl?: string | null
  lastUpdateAt?: string | null
}

export type UserRole = 'ADMIN' | 'SECURITY_GUARD'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
}

export type GuardStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED'

export interface Guard {
  id: string
  name: string
  email: string
  phone: string
  badgeNumber: string
  status: GuardStatus
  dateJoined: string
}

export type ReviewStatus = 'PENDING_REVIEW' | 'CONFIRMED' | 'DISMISSED' | 'ESCALATED'

export interface Incident {
  id: string
  jobId: string
  cameraId: string
  cameraLabel: string
  detectionType: string
  confidence: number
  suspicionScore: number | null
  annotatedVideoFileName?: string | null
  evidence?: Record<string, unknown> | null
  reviewStatus: ReviewStatus
  detectedAt: string
  reviewedAt: string | null
  reviewedBy: string | null
}
