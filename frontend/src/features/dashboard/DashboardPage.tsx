// frontend/src/features/dashboard/DashboardPage.tsx

import { useEffect, useRef, useState } from 'react'
import { StoreOverview } from './components/StoreOverview'
import { StoreMap } from './components/StoreMap'
import { CameraFeedsPanel } from './components/CameraFeedsPanel'
import { useStoreCameras } from './hooks/useStoreCameras'
import { api } from '@/services/apiClient'
import { cameraService } from '@/services/cameraService'
import type { CameraFeed, StoreCamera } from '@/types'

interface UploadJobResponse {
  jobId: string
  videoFileName?: string
}

interface JobProgressData {
  failureReason?: string | null
  jobId: string
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  currentStage: CameraFeed['currentStage']
  progressPercent: number
  behaviour?: string | null
  confidence?: number | null
  suspicionScore?: number | null
  annotatedVideoFileName?: string | null
  cameraId: string
  videoFileName: string
  createdAt: string
}

const NOTIFICATIONS_CHANGED_EVENT = 'virtual-guard:notifications-changed'
const DASHBOARD_RESET_AT_KEY = 'virtual-guard:dashboard-reset-at'

function getDashboardResetAt(): number {
  const storedValue = window.localStorage.getItem(DASHBOARD_RESET_AT_KEY)
  const resetAt = storedValue ? Number(storedValue) : 0
  return Number.isFinite(resetAt) ? resetAt : 0
}

function isAfterDashboardReset(job: JobProgressData): boolean {
  const createdAt = Date.parse(job.createdAt)
  return Number.isNaN(createdAt) || createdAt > getDashboardResetAt()
}

function buildFeedSlots(cameras: StoreCamera[]): CameraFeed[] {
  const seenCameraIds = new Set<string>()
  return cameras
    .filter((camera) => camera.monitored)
    .filter((camera) => {
      if (seenCameraIds.has(camera.id)) return false
      seenCameraIds.add(camera.id)
      return true
    })
    .map((camera) => ({
      id: camera.id,
      location: camera.label,
      fileName: null,
      status: 'idle' as const,
      currentStage: 'queued' as const,
      progressPercent: 0,
      isAnalyzing: false,
      isUploading: false,
      uploadProgress: 0,
      latestDetection: null,
    }))
}

export function DashboardPage() {
  const { cameras: registryCameras, isLoading } = useStoreCameras()
  const [cameras, setCameras] = useState<StoreCamera[]>([])
  const [feeds, setFeeds] = useState<CameraFeed[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const startInFlightRef = useRef(false)
  const alertAudioContextRef = useRef<AudioContext | null>(null)

  function prepareAlertSound() {
    if (!alertAudioContextRef.current) {
      alertAudioContextRef.current = new AudioContext()
    }
    if (alertAudioContextRef.current.state === 'suspended') {
      void alertAudioContextRef.current.resume()
    }
  }

  function playAlertSound() {
    const context = alertAudioContextRef.current
    if (!context || context.state === 'closed') return

    const startAt = context.currentTime
    for (let index = 0; index < 3; index += 1) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const beepStart = startAt + index * 0.32
      oscillator.type = 'square'
      oscillator.frequency.setValueAtTime(index % 2 === 0 ? 880 : 660, beepStart)
      gain.gain.setValueAtTime(0.0001, beepStart)
      gain.gain.exponentialRampToValueAtTime(0.16, beepStart + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, beepStart + 0.22)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(beepStart)
      oscillator.stop(beepStart + 0.24)
    }
  }

  useEffect(() => {
    if (isLoading) return
    let cancelled = false

    async function restoreDashboard() {
      const baseFeeds = buildFeedSlots(registryCameras)
      try {
        const jobs = (await api.get<JobProgressData[]>('/api/jobs')).filter(isAfterDashboardReset)
        if (cancelled) return
        const latestByCamera = new Map<string, JobProgressData>()
        for (const job of jobs) {
          if (!latestByCamera.has(job.cameraId)) latestByCamera.set(job.cameraId, job)
        }
        setFeeds(baseFeeds.map((feed) => {
          const job = latestByCamera.get(feed.id)
          if (!job) return feed
          return {
            ...feed,
            jobId: job.jobId,
            fileName: job.annotatedVideoFileName || job.videoFileName,
            annotatedVideoFileName: job.annotatedVideoFileName,
            currentStage: job.currentStage,
            failureReason: job.failureReason,
            progressPercent: job.progressPercent,
            isAnalyzing: job.status === 'PROCESSING',
            behaviour: job.behaviour ?? undefined,
            confidence: job.confidence,
            suspicionScore: job.suspicionScore,
          }
        }))
        setCameras(registryCameras)
      } catch {
        if (!cancelled) {
          setCameras(registryCameras)
          setFeeds(baseFeeds)
        }
      }
    }

    void restoreDashboard()
    return () => { cancelled = true }
  }, [isLoading, registryCameras])

  useEffect(() => {
    let cancelled = false

    const refreshCameraStatuses = () => {
      cameraService.getCameras()
        .then((latestCameras) => {
          if (cancelled) return
          setCameras(latestCameras)
        })
        .catch(() => { /* Keep the current map state during a transient outage. */ })
    }

    const refreshTimer = window.setInterval(refreshCameraStatuses, 10_000)
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refreshCameraStatuses)
    return () => {
      cancelled = true
      window.clearInterval(refreshTimer)
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refreshCameraStatuses)
    }
  }, [])

  useEffect(() => {
    const activeFeeds = feeds.filter((feed) => feed.jobId && feed.isAnalyzing)
    if (activeFeeds.length === 0) return
    let cancelled = false

    const refreshActiveJobs = async () => {
      for (const feed of activeFeeds) {
        try {
          const progressData = await api.get<JobProgressData>(`/api/jobs/${feed.jobId}`)
          if (cancelled) return
          if (progressData.status === 'COMPLETED') {
            const latest = await cameraService.getCameras()
            if (cancelled) return
            setCameras(latest)
            if (latest.find(camera => camera.id === feed.id)?.status === 'alert') playAlertSound()
            window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT))
          }
          setFeeds((current) => current.map((item) => item.id === feed.id ? {
            ...item,
            currentStage: progressData.currentStage,
            failureReason: progressData.failureReason,
            progressPercent: progressData.progressPercent,
            isAnalyzing: progressData.status === 'PROCESSING'
              || (progressData.status === 'QUEUED' && startInFlightRef.current),
            behaviour: progressData.behaviour ?? undefined,
            confidence: progressData.confidence,
            suspicionScore: progressData.suspicionScore,
            annotatedVideoFileName: progressData.annotatedVideoFileName,
            fileName: progressData.annotatedVideoFileName || item.fileName,
          } : item))
        } catch (error) {
          console.error('Failed to refresh analysis progress:', error)
        }
      }
    }

    void refreshActiveJobs()
    const timer = window.setInterval(refreshActiveJobs, 1_000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [feeds])

  async function uploadVideoToBackend(cameraId: string, file: File): Promise<UploadJobResponse> {
    const formData = new FormData()
    formData.append('cameraId', cameraId)
    formData.append('file', file)
    return api.upload<UploadJobResponse>('/api/jobs', formData)
  }

  async function handleFileSelected(cameraId: string, file: File) {
    if (isUploading) return

    setIsUploading(true)

    try {
      setFeeds((prev) => prev.map((feed) =>
        feed.id === cameraId && feed.fileName === null
          ? { ...feed, fileName: file.name, isUploading: true, uploadProgress: 0 }
          : feed
      ))

      const uploadResult = await uploadVideoToBackend(cameraId, file)
      const storedFileName = (uploadResult.videoFileName || file.name).split(/[\\/]/).pop() || file.name

      setFeeds((prev) => prev.map((feed) =>
        feed.id === cameraId && feed.fileName === file.name && feed.isUploading
          ? {
              ...feed,
              fileName: storedFileName,
              jobId: uploadResult.jobId,
              isUploading: false,
              uploadProgress: 100,
            }
          : feed
      ))
    } catch (error) {
      setFeeds((prev) => prev.map((feed) =>
        feed.id === cameraId && feed.isUploading
          ? { ...feed, fileName: null, isUploading: false, uploadProgress: 0 }
          : feed
      ))
      alert('Failed to upload video: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setIsUploading(false)
    }
  }

  async function handleAnalyze() {
    if (startInFlightRef.current) return
    prepareAlertSound()
    const feedsToAnalyze = feeds.filter((f) => f.fileName && f.jobId && !f.isAnalyzing && f.currentStage !== 'complete')

    if (feedsToAnalyze.length === 0) {
      alert('No videos to analyze. Please upload a video first.')
      return
    }

    startInFlightRef.current = true

    async function refreshJob(feed: CameraFeed) {
      const job = await api.get<JobProgressData>(`/api/jobs/${feed.jobId}`)
      setFeeds((current) => current.map((item) => item.jobId === feed.jobId ? {
        ...item,
        currentStage: job.status === 'COMPLETED' ? 'complete' : job.currentStage,
        progressPercent: job.progressPercent,
        isAnalyzing: job.status === 'PROCESSING',
        behaviour: job.behaviour ?? undefined,
        confidence: job.confidence,
        suspicionScore: job.suspicionScore,
        annotatedVideoFileName: job.annotatedVideoFileName,
        fileName: job.annotatedVideoFileName || item.fileName,
      } : item))
      return job
    }

    for (const feed of feedsToAnalyze) {
      try {
        const job = await refreshJob(feed)
        if (job.status !== 'QUEUED' && job.status !== 'FAILED') continue
        // Set analyzing state
        setFeeds((prev) =>
          prev.map((f) =>
            f.id === feed.id
              ? { ...f, isAnalyzing: true, currentStage: 'extracting-frames', progressPercent: 10 }
              : f
          )
        )

        await api.post<void>(`/api/jobs/${feed.jobId}/start`)

      } catch (error) {
        console.error('Analysis failed:', error)
        try {
          const job = await refreshJob(feed)
          if (job.status === 'PROCESSING' || job.status === 'COMPLETED') continue
        } catch {
          setFeeds((current) => current.map((item) => item.jobId === feed.jobId
            ? { ...item, isAnalyzing: false }
            : item))
        }
        alert(`Failed to analyze ${feed.location}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    startInFlightRef.current = false
  }

  function handleReset() {
    window.localStorage.setItem(DASHBOARD_RESET_AT_KEY, String(Date.now()))
    setFeeds(buildFeedSlots(registryCameras))
    void cameraService.getCameras().then(setCameras)
  }

  const camerasOnline = cameras.filter((camera) => camera.monitored && camera.status !== 'offline').length
  const activeAlerts = cameras.filter((camera) => camera.monitored && camera.status === 'alert').length
  const videosProcessing = feeds.filter((f) => f.isAnalyzing).length

  if (isLoading) {
    return <div className="py-16 text-center text-sm text-text-muted">Loading store layout…</div>
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(280px,320px)_1fr]">
      <div className="flex flex-col gap-6">
        <StoreOverview
          camerasOnline={camerasOnline}
          activeAlerts={activeAlerts}
          videosProcessing={videosProcessing}
          avgConfidence="--"
          isMonitoring={videosProcessing > 0}
        />
        <StoreMap cameras={cameras} />
      </div>

      <CameraFeedsPanel
        feeds={feeds}
        cameras={cameras}
        onFileSelected={handleFileSelected}
        onAnalyze={handleAnalyze}
        onReset={handleReset}
      />
    </div>
  )
}
