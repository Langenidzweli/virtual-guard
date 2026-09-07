import { cn } from '@/lib/utils'
import type { CameraStatus } from '@/types'

const STATUS_COLOR: Record<CameraStatus, string> = {
  idle: 'bg-text-muted',
  normal: 'bg-status-normal',
  review: 'bg-status-review',
  alert: 'bg-status-alert',
  offline: 'bg-text-muted/50',
}

interface StatusDotProps {
  status: CameraStatus
  pulse?: boolean
  className?: string
}

export function StatusDot({ status, pulse = false, className }: StatusDotProps) {
  const showPulse = pulse && status !== 'idle'

  return (
    <span className={cn('relative inline-flex h-2 w-2', className)}>
      {showPulse && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
            STATUS_COLOR[status],
          )}
        />
      )}
      <span
        className={cn('relative inline-flex h-2 w-2 rounded-full', STATUS_COLOR[status])}
      />
    </span>
  )
}
