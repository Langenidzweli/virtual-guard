import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, id, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-text-secondary">
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          'h-9 rounded-lg border border-line-strong bg-surface-2 px-3 text-sm text-text-primary',
          'placeholder:text-text-muted focus:border-brand-red focus:outline-none',
          'read-only:cursor-default read-only:opacity-70 read-only:focus:border-line-strong',
          error && 'border-status-alert',
          className,
        )}
        {...props}
      />
      {error && <span className="text-xs text-status-alert">{error}</span>}
    </div>
  )
}
