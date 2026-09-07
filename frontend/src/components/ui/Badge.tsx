import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'info' | 'success' | 'warning' | 'danger' | 'neutral'

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  info: 'bg-status-info/15 text-status-info border-status-info/30',
  success: 'bg-status-normal/15 text-status-normal border-status-normal/30',
  warning: 'bg-status-review/15 text-status-review border-status-review/30',
  danger: 'bg-status-alert/15 text-status-alert border-status-alert/30',
  neutral: 'bg-surface-3 text-text-secondary border-line-strong',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  children: ReactNode
}

export function Badge({ variant = 'neutral', children, className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium',
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
