import { cn } from '@/lib/utils'
import { PIPELINE_STEPS } from '../data/pipelineConfig'
import type { PipelineStage } from '@/types'

interface PipelineChecklistProps {
  currentStage: PipelineStage
}

export function PipelineChecklist({ currentStage }: PipelineChecklistProps) {
  const currentIndex = currentStage === 'complete'
    ? PIPELINE_STEPS.length
    : PIPELINE_STEPS.findIndex((step) => step.stage === currentStage)

  return (
    <ul className="flex flex-col gap-1.5">
      {PIPELINE_STEPS.map((step, index) => {
        const isActive = index === currentIndex
        const isDone = index < currentIndex

        return (
          <li key={step.stage} className="flex items-center gap-2">
            <span
              className={cn(
                'relative flex h-2 w-2 shrink-0 items-center justify-center rounded-full border',
                isActive && 'border-status-info bg-status-info',
                isDone && 'border-status-normal bg-status-normal',
                !isActive && !isDone && 'border-line-strong bg-transparent',
              )}
            >
              {isActive && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-info opacity-60" />
              )}
            </span>
            <span
              className={cn(
                'text-[11px]',
                isActive ? 'font-medium text-text-primary' : 'text-text-secondary',
              )}
            >
              {step.label}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
