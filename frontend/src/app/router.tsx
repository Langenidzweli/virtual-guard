import { ChangePasswordPage } from '@/features/auth/ChangePasswordPage'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { LoginPage } from '@/features/auth/LoginPage'
import { ROUTES } from './routes'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { IncidentWorkspace } from '@/features/reports/IncidentWorkspace'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { GuardsPage } from '@/features/guards/GuardsPage'

export const router = createBrowserRouter([
  { path: ROUTES.login, element: <LoginPage /> },
  { path: ROUTES.changePassword, element: <RequireAuth><ChangePasswordPage /></RequireAuth> },
  {
    path: ROUTES.liveMonitoring,
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: ROUTES.analytics.slice(1), element: <Navigate to="/reports?view=trends" replace /> },
      { path: ROUTES.reports.slice(1), element: <IncidentWorkspace /> },
      { path: ROUTES.history.slice(1), element: <Navigate to="/reports" replace /> },
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
