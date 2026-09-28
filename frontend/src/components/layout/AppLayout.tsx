import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export function AppLayout() {
  const [navOpen, setNavOpen] = useState(false)

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-surface-0">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <Header
        title="Virtual Guard"
        subtitle="Security Operations Center"
        onMenuClick={() => setNavOpen(true)}
      />
      <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  )
}
