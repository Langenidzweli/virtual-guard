import { Badge } from '@/components/ui'
import type { GuardStatus } from '@/types'

const STATUS_LABEL: Record<GuardStatus, string> = {
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  DEACTIVATED: 'Deactivated',
}

const STATUS_VARIANT: Record<GuardStatus, 'success' | 'warning' | 'neutral'> = {
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  DEACTIVATED: 'neutral',
}

export function GuardStatusBadge({ status }: { status: GuardStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
}
