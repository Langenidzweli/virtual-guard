import { Monitor, FileText, Settings, ShieldCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ROUTES } from '@/app/routes'
import type { UserRole } from '@/types'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  roles?: UserRole[]
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Monitoring', path: ROUTES.liveMonitoring, icon: Monitor },
  { label: 'Incidents', path: ROUTES.reports, icon: FileText },
  { label: 'Guards', path: ROUTES.guards, icon: ShieldCheck, roles: ['ADMIN'] },
  { label: 'Settings', path: ROUTES.settings, icon: Settings, roles: ['ADMIN'] },
]
