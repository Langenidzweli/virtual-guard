import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusDot } from '@/components/ui'
import type { CameraStatus } from '@/types'

interface StatCardProps {
  label: string
  value: string | number
  icon?: LucideIcon
  dotStatus?: CameraStatus
  tone?: 'default' | 'success' | 'warning' | 'danger'
}

const TONE_CLASSES: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'text-text-primary',
  success: 'text-status-normal',
  warning: 'text-status-review',
  danger: 'text-status-alert',
}

export function StatCard({ label, value, icon: Icon, dotStatus, tone = 'default' }: StatCardProps) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-line bg-surface-2 px-3.5 py-3">
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
        {dotStatus ? (
          <StatusDot status={dotStatus} />
        ) : Icon ? (
          <Icon className="h-4 w-4 text-text-muted" strokeWidth={1.75} />
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="block text-xs leading-tight text-text-secondary">{label}</span>
        <span className={cn('mt-1 block text-lg font-semibold leading-none', TONE_CLASSES[tone])}>
          {value}
        </span>
      </span>
    </div>
  )
}
