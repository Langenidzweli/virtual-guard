import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from './navConfig'
import { StatusDot } from '@/components/ui'
import { useAuth } from '@/features/auth/useAuth'
import logo from '@/assets/logo.png'
import { api } from '@/services/apiClient'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user } = useAuth()
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null)
  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)))

  useEffect(() => {
    let cancelled = false
    const checkHealth = () => {
      api.get<{ status: string }>('/health')
        .then(() => { if (!cancelled) setBackendOnline(true) })
        .catch(() => { if (!cancelled) setBackendOnline(false) })
    }
    checkHealth()
    const timer = window.setInterval(checkHealth, 30_000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [])
  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-black/60 transition-opacity duration-200',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      {/* Drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] shrink-0 flex-col',
          'border-r border-line bg-surface-1 transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between gap-2.5 px-5 py-5">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="" className="h-8 w-8 rounded-md" />
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-wide text-text-primary">VIRTUAL</p>
              <p className="text-sm font-bold tracking-wide text-text-primary">GUARD</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-2 hover:text-text-primary"
          >
            <X className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
          {visibleItems.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'border border-brand-red-dim bg-brand-red-dim/40 text-text-primary'
                    : 'border border-transparent text-text-secondary hover:bg-surface-2 hover:text-text-primary',
                )
              }
            >
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-line px-4 py-4">
          <div className="rounded-lg border border-line bg-surface-2 px-3 py-3">
            <div className="flex items-center gap-2">
              <StatusDot status={backendOnline === false ? 'offline' : backendOnline ? 'normal' : 'idle'} />
              <span className="text-xs font-medium text-text-secondary">System Status</span>
            </div>
            <p className="mt-1 text-xs text-text-primary">
              {backendOnline === null ? 'Checking backend…' : backendOnline ? 'Backend operational' : 'Backend unavailable'}
            </p>
          </div>
          <p className="mt-3 px-1 text-[11px] text-text-muted">Version 1.0.0</p>
        </div>
      </aside>
    </>
  )
}
