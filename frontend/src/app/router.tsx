import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { LoginPage } from '@/features/auth/LoginPage'
import { ROUTES } from './routes'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { AnalyticsPage } from '@/features/analytics/AnalyticsPage'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { HistoryPage } from '@/features/history/HistoryPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { GuardsPage } from '@/features/guards/GuardsPage'

export const router = createBrowserRouter([
  { path: ROUTES.login, element: <LoginPage /> },
  {
    path: ROUTES.liveMonitoring,
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: ROUTES.analytics.slice(1), element: <AnalyticsPage /> },
      { path: ROUTES.reports.slice(1), element: <ReportsPage /> },
      { path: ROUTES.history.slice(1), element: <HistoryPage /> },
      {
        path: ROUTES.settings.slice(1),
        element: (
          <RequireAuth roles={['ADMIN']}>
            <SettingsPage />
          </RequireAuth>
        ),
      },
      {
        path: ROUTES.guards.slice(1),
        element: (
          <RequireAuth roles={['ADMIN']}>
            <GuardsPage />
          </RequireAuth>
        ),
      },
    ],
  },
])
