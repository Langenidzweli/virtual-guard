import { AuthorizedVideo } from '@/components/AuthorizedVideo'
import { useEffect, useRef, useState } from 'react'
import { api } from '@/services/apiClient'
import type { Incident } from '@/types'
import { Button } from '@/components/ui'

interface Segment { start_seconds: number; end_seconds: number; confidence: number }
const timestamp = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

export function ReviewFootage({ incidentId, src }: { incidentId: string; src: string }) {
  const video = useRef<HTMLVideoElement>(null)
  const [segments, setSegments] = useState<Segment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [index, setIndex] = useState(0)
  const [full, setFull] = useState(false)
  const [duration, setDuration] = useState(Infinity)

  useEffect(() => {
    let cancelled = false
    api.get<Incident>(`/api/incidents/${incidentId}`).then((incident) => {
      if (cancelled) return
      const raw = incident.evidence?.reviewSegments
      setSegments(Array.isArray(raw) ? raw.filter((value): value is Segment =>
        value !== null && typeof value === 'object'
        && Number.isFinite(value.start_seconds) && Number.isFinite(value.end_seconds)
        && value.start_seconds >= 0 && value.end_seconds > value.start_seconds,
      ).sort((a, b) => a.start_seconds - b.start_seconds) : [])
    }).catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [incidentId])

  const usable = segments.filter((segment) => segment.start_seconds < duration)
  const active = !full ? usable[index] : undefined
  const end = active ? Math.min(active.end_seconds, duration) : duration
  function seek(start: number) {
    if (video.current) {
      video.current.pause()
      video.current.currentTime = start
    }
  }
  function choose(next: number) {
    setFull(false)
    setIndex(next)
    seek(usable[next]?.start_seconds ?? 0)
  }

  if (loading) return <p className="text-sm text-text-secondary">Loading review footage…</p>
  return <div className="space-y-3">
    <AuthorizedVideo ref={video} controls preload="metadata" src={src}
      className="aspect-video w-full rounded-lg bg-black object-contain"
      onLoadedMetadata={(event) => {
        const media = event.currentTarget
        setDuration(media.duration)
        const first = segments.find((segment) => segment.start_seconds < media.duration)
        if (!full && first) media.currentTime = first.start_seconds
      }}
      onPlay={(event) => {
        if (active && (event.currentTarget.currentTime < active.start_seconds || event.currentTarget.currentTime >= end)) {
          event.currentTarget.currentTime = active.start_seconds
        }
      }}
      onTimeUpdate={(event) => {
        if (active && event.currentTarget.currentTime >= end) event.currentTarget.pause()
      }}
      onSeeking={(event) => {
        if (active && event.currentTarget.currentTime < active.start_seconds) event.currentTarget.currentTime = active.start_seconds
        if (active && event.currentTarget.currentTime > end) event.currentTarget.currentTime = end
      }}
      onError={() => setVideoError(true)} />
    {videoError && <p role="alert" className="text-sm text-status-alert">The recording could not be loaded. Check that the video file is still available.</p>}
    {usable.length > 0 ? <>
      <p className="text-sm text-text-secondary">{full ? 'Full recording' : `Model-flagged segment ${index + 1} of ${usable.length}: ${timestamp(active?.start_seconds ?? 0)}–${timestamp(end)}`}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={!full && index === 0} onClick={() => choose(full ? 0 : index - 1)}>Previous segment</Button>
        <Button size="sm" disabled={!full && index >= usable.length - 1} onClick={() => choose(full ? 0 : index + 1)}>Next segment</Button>
        <Button size="sm" onClick={() => { if (full) choose(index); else { setFull(true); seek(0) } }}>{full ? 'Review segments' : 'Watch full recording'}</Button>
      </div>
      <p className="text-xs text-text-muted">Suggested moments include surrounding context. Review the full recording when needed.</p>
    </> : <p className="text-sm text-text-secondary">{error ? 'Segment information could not be loaded.' : 'No model-flagged timestamps are available for this incident.'} Full recording is available.</p>}
  </div>
}
