import { Monitor, BarChart3, FileText, History, Settings, ShieldCheck } from 'lucide-react'
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
  { label: 'Live Monitoring', path: ROUTES.liveMonitoring, icon: Monitor },
  { label: 'Analytics', path: ROUTES.analytics, icon: BarChart3 },
  { label: 'Reports', path: ROUTES.reports, icon: FileText },
  { label: 'History', path: ROUTES.history, icon: History },
  { label: 'Guards', path: ROUTES.guards, icon: ShieldCheck, roles: ['ADMIN'] },
  { label: 'Settings', path: ROUTES.settings, icon: Settings },
]
