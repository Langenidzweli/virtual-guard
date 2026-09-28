export const ROUTES = {
  login: '/login',
  changePassword: '/change-password',
  liveMonitoring: '/',
  analytics: '/analytics',
  reports: '/reports',
  history: '/history',
  settings: '/settings',
  guards: '/guards',
} as const

export type RouteKey = keyof typeof ROUTES
