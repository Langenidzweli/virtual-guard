import type { PipelineStep } from '@/types'

/**
 * Fixed definition of the AI analysis pipeline stages. This is
 * configuration, not data - every job goes through these same stages,
 * so it's safe to keep as a constant rather than fetching it.
 */
export const PIPELINE_STEPS: PipelineStep[] = [
  { stage: 'extracting-frames', label: 'Starting Analysis' },
  { stage: 'validating-video', label: 'Validating Video' },
  { stage: 'vision-analysis', label: 'Detecting and Tracking Objects' },
  { stage: 'behaviour-analysis', label: 'Behaviour Analysis' },
]
