import { forwardRef, useEffect, useRef, useState, type VideoHTMLAttributes } from 'react'
import { api } from '@/services/apiClient'

// A ticket is valid for one file for two minutes, never an access/refresh token.
export const AuthorizedVideo = forwardRef<HTMLVideoElement, VideoHTMLAttributes<HTMLVideoElement>>(
  function AuthorizedVideo({ src, onError, onLoadedMetadata, ...props }, forwardedRef) {
    const media = useRef<HTMLVideoElement | null>(null)
    const [url, setUrl] = useState<string>()
    const [message, setMessage] = useState('')
    const renew = useRef<(() => boolean) | null>(null)
    const retry = useRef(false)
    const lastRecovery = useRef(0)
    const recovering = useRef(false)
    const saved = useRef<{ time: number; playing: boolean } | null>(null)
    useEffect(() => {
      let cancelled = false
      retry.current = false
      lastRecovery.current = 0
      setUrl(undefined)
      setMessage('')
      saved.current = null
      recovering.current = false
      async function acquire() {
        if (!src) return
        try {
          const path = new URL(src, window.location.origin)
          const filename = decodeURIComponent(path.pathname.split('/').pop() ?? '')
          const { ticket } = await api.post<{ ticket: string }>(`/api/video/${encodeURIComponent(filename)}/ticket`)
          if (cancelled) return
          path.search = ''
          path.searchParams.set('ticket', ticket)
          setUrl(path.toString())
        } catch (error) {
          if (!cancelled) setMessage(error instanceof Error ? error.message : 'Unable to authorize footage')
        }
      }
      renew.current = () => {
        if (retry.current || recovering.current || Date.now() - lastRecovery.current < 30_000) return false
        lastRecovery.current = Date.now()
        retry.current = true
        recovering.current = true
        const element = media.current
        if (element) saved.current = { time: element.currentTime, playing: !element.paused }
        void acquire()
        return true
      }
      void acquire()
      return () => { cancelled = true; renew.current = null }
    }, [src])
    return <>
      {url && <video {...props} data-media-src={src} src={url} ref={(element) => {
        media.current = element
        if (typeof forwardedRef === 'function') forwardedRef(element)
        else if (forwardedRef) forwardedRef.current = element
      }} onLoadedMetadata={(event) => {
        onLoadedMetadata?.(event)
        if (saved.current) {
          event.currentTarget.currentTime = Math.min(saved.current.time, event.currentTarget.duration)
          if (saved.current.playing) void event.currentTarget.play().catch(() => {})
          saved.current = null
        }
        recovering.current = false
        retry.current = false
      }} onError={(event) => {
        if (!renew.current?.()) onError?.(event)
      }} />}
      {message && <p role="alert" className="text-sm text-status-alert">{message}</p>}
    </>
  },
)
