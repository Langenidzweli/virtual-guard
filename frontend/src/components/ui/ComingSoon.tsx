interface ComingSoonProps {
  title: string
}

/**
 * Used only for routes that are on the roadmap but not yet built
 * (Analytics, Reports, History, Settings). The Live Monitoring
 * dashboard does not use this - it is fully built in Phase 1.
 */
export function ComingSoon({ title }: ComingSoonProps) {
  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-line-strong text-center">
      <p className="text-sm font-medium text-text-primary">{title}</p>
      <p className="mt-1 text-xs text-text-muted">This screen is planned for a later phase</p>
    </div>
  )
}
