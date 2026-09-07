import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Bell, ChevronDown, ShieldUser, LogOut } from 'lucide-react'
import { IconButton } from '@/components/ui'
import { useClock } from '@/lib/useClock'
import { useAuth } from '@/features/auth/useAuth'
import { ROUTES } from '@/app/routes'
import { api } from '@/services/apiClient'

const NOTIFICATIONS_CHANGED_EVENT = 'virtual-guard:notifications-changed'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
})

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrator',
  SECURITY_GUARD: 'Security Guard',
}

interface HeaderProps {
  title: string
  subtitle: string
  onMenuClick: () => void
}

export function Header({ title, subtitle, onMenuClick }: HeaderProps) {
  const now = useClock()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!user) {
      setUnreadNotifications(0)
      return
    }
    let cancelled = false
    const refreshCount = () => {
      api.get<{ count: number }>('/api/notifications/count')
        .then((result) => { if (!cancelled) setUnreadNotifications(result.count) })
        .catch(() => { /* Keep the previous count during a transient outage. */ })
    }
    refreshCount()
    const handleVisibility = () => { if (!document.hidden) refreshCount() }
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refreshCount)
    window.addEventListener('focus', refreshCount)
    document.addEventListener('visibilitychange', handleVisibility)
    const timer = window.setInterval(refreshCount, 10_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refreshCount)
      window.removeEventListener('focus', refreshCount)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [user])

  function handleLogout() {
    logout()
    navigate(ROUTES.login, { replace: true })
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line bg-surface-1 px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <IconButton label="Open menu" onClick={onMenuClick} className="-ml-1.5 shrink-0">
          <Menu className="h-5 w-5" strokeWidth={1.75} />
        </IconButton>
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="truncate text-lg font-semibold text-text-primary">{title}</h1>
          <span className="hidden truncate text-sm text-text-muted sm:inline">{subtitle}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-5">
        <time
          className="hidden text-sm text-text-secondary tabular-nums md:block"
          dateTime={now.toISOString()}
        >
          {dateFormatter.format(now)}&nbsp;&nbsp;{timeFormatter.format(now)}
        </time>

        <IconButton label="Notifications" onClick={() => navigate(ROUTES.history)}>
          <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
          {unreadNotifications > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-semibold text-white">
              {unreadNotifications > 99 ? '99+' : unreadNotifications}
            </span>
          )}
        </IconButton>

        <div className="relative" ref={menuRef}>
          {user ? (
            <>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2.5 rounded-lg py-1.5 pr-1 pl-1.5 transition-colors hover:bg-surface-2 sm:pr-2"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-text-secondary">
                  <ShieldUser className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-sm font-medium text-text-primary">{user.name}</span>
                  <span className="block text-xs text-text-muted">
                    {ROLE_LABEL[user.role] ?? user.role}
                  </span>
                </span>
                <ChevronDown className="hidden h-4 w-4 text-text-muted sm:block" strokeWidth={1.75} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-lg border border-line bg-surface-1 shadow-xl">
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-3.5 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
                  >
                    <LogOut className="h-4 w-4" strokeWidth={1.75} />
                    Log out
                  </button>
                </div>
              )}
            </>
          ) : (
            <button
              onClick={() => navigate(ROUTES.login)}
              className="flex items-center gap-2 rounded-lg border border-line-strong px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
            >
              <ShieldUser className="h-4 w-4" strokeWidth={1.75} />
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
