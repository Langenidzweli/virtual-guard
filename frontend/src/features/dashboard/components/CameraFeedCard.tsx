import { useState, useRef, useEffect } from 'react'
import { Video, VideoOff, Play, Upload, Loader2 } from 'lucide-react'
import { Card, Badge, Button, ProgressBar, Modal } from '@/components/ui'
import { PipelineChecklist } from './PipelineChecklist'
import type { CameraFeed } from '@/types'
import { useAuthToken } from '@/features/auth/useAuthToken'

interface CameraFeedCardProps {
  feed: CameraFeed
}

export function CameraFeedCard({ feed }: CameraFeedCardProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [videoSrc, setVideoSrc] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const authToken = useAuthToken()

  const hasVideo = feed.fileName !== null
  const isUploading = feed.isUploading || false
  const uploadProgress = feed.uploadProgress || 0
  const statusLabel = feed.isAnalyzing
    ? 'Analyzing'
    : isUploading
      ? 'Uploading...'
      : feed.currentStage === 'complete'
        ? 'Complete'
        : feed.currentStage === 'failed'
          ? 'Failed'
          : hasVideo ? 'Queued' : 'No Feed'
  const statusVariant = feed.currentStage === 'failed'
    ? 'danger'
    : feed.currentStage === 'complete'
      ? 'success'
      : feed.isAnalyzing
        ? 'info'
        : isUploading ? 'warning' : 'neutral'

  useEffect(() => {
    setIsPlaying(false)
    setHasLoaded(false)
    setVideoSrc('')
    setIsLoading(Boolean(feed.fileName))
    setVideoError(false)

    if (!feed.fileName) return

    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8090'
    const fileName = (feed.fileName as string).split(/[\\/]/).pop()
    if (!fileName) return

    const url = new URL(`/api/video/${encodeURIComponent(fileName)}`, `${baseUrl}/`)
    if (authToken) url.searchParams.set('token', authToken)
    setVideoSrc(url.toString())
  }, [feed.fileName, authToken])

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play().catch(() => setVideoError(true))
      }
    }
  }

  const handleVideoClick = () => {
    togglePlay()
  }

  const handleVideoLoaded = () => {
    setHasLoaded(true)
    setIsLoading(false)
    setVideoError(false)
  }

  const handleVideoError = () => {
    setIsLoading(false)
    setVideoError(true)
  }

  return (
    <Card className="@container flex flex-col">
      <div className="flex items-center justify-between px-3.5 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Video className="h-3.5 w-3.5 shrink-0 text-text-muted" strokeWidth={1.75} />
          <span className="truncate text-xs font-semibold tracking-wide text-text-primary uppercase">
            {feed.location}
          </span>
        </div>
        <Badge variant={statusVariant}>
          {statusLabel}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-3 px-3.5 @sm:grid-cols-[1.5fr_1fr]">
        <div>
          <div className="relative aspect-video rounded-lg bg-surface-3 overflow-hidden">
            {isUploading ? (
              // Uploading state
              <div className="flex h-full flex-col items-center justify-center gap-3 bg-surface-2">
                <div className="relative">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-red border-t-transparent" />
                  <Upload className="absolute inset-0 h-5 w-5 m-auto text-text-muted" strokeWidth={1.5} />
                </div>
                <span className="text-sm font-medium text-text-primary">Uploading...</span>
                <span className="text-xs text-text-muted">{uploadProgress}%</span>
                <div className="w-3/4 max-w-[200px]">
                  <ProgressBar value={uploadProgress} className="h-1.5" />
                </div>
              </div>
            ) : hasVideo && videoSrc ? (
              // Video player
              <>
                <video
                  ref={videoRef}
                  src={videoSrc}
                  controls
                  preload="metadata"
                  className="h-full w-full object-contain"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onLoadedMetadata={handleVideoLoaded}
                  onCanPlay={handleVideoLoaded}
                  onLoadStart={() => setIsLoading(true)}
                  onError={handleVideoError}
                />
                {videoError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4 text-center text-xs text-white">
                    Video could not be loaded. Check that the backend is running and the file exists.
                  </div>
                )}
                {!isPlaying && !isLoading && hasLoaded && (
                  <button
                    onClick={handleVideoClick}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors group"
                  >
                    <Play className="h-12 w-12 text-white opacity-80 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                  </button>
                )}
                {!videoError && (isLoading || !hasLoaded) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 className="h-8 w-8 text-white animate-spin" strokeWidth={2} />
                  </div>
                )}
              </>
            ) : (
              // No video uploaded
              <div className="flex h-full flex-col items-center justify-center gap-1">
                <VideoOff className="h-6 w-6 text-text-muted/40" strokeWidth={1.5} />
                <span className="text-[10px] text-text-muted">No video uploaded</span>
              </div>
            )}
          </div>

        </div>

        <PipelineChecklist currentStage={feed.currentStage} />
      </div>

      <div className="px-3.5 pt-3 pb-3.5">
        <div className="flex items-center justify-between text-[11px] text-text-secondary">
          <span>Progress</span>
          <span className="tabular-nums">{isUploading ? uploadProgress : feed.progressPercent}%</span>
        </div>
        <ProgressBar value={isUploading ? uploadProgress : feed.progressPercent} className="mt-1.5" />

        <Button variant="secondary" size="sm" className="mt-3 w-full" disabled={!hasVideo || isUploading} onClick={() => setShowDetails(true)}>
          View Details
        </Button>
      </div>

      <Modal open={showDetails} onClose={() => setShowDetails(false)} title={`${feed.location} analysis`}>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-text-muted">Status</span><span className="text-text-primary">{feed.currentStage}</span></div>
          <div className="flex justify-between"><span className="text-text-muted">Behaviour</span><span className="font-medium text-text-primary">{feed.behaviour || 'No result available'}</span></div>
          <div className="flex justify-between"><span className="text-text-muted">Confidence</span><span className="text-text-primary">{feed.confidence == null ? '--' : `${(feed.confidence * 100).toFixed(1)}%`}</span></div>
          <div className="flex justify-between"><span className="text-text-muted">Suspicion score</span><span className="text-text-primary">{feed.suspicionScore == null ? '--' : feed.suspicionScore.toFixed(1)}</span></div>
          {feed.behaviour === 'shoplifting' && <p className="border-t border-line pt-3 text-text-secondary">The model classified this video as suspicious behaviour. A security officer should review the footage before taking action.</p>}
        </div>
      </Modal>
    </Card>
  )
}
