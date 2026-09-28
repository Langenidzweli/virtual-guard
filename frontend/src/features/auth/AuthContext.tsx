import { useEffect, useState, type ReactNode } from 'react'
import type { AuthUser } from '@/types'
import { api, AUTH_EXPIRED_EVENT, AUTH_USER_CHANGED_EVENT, setAuthToken, setRefreshToken } from '@/services/apiClient'
import { AuthContext } from './auth-context'
const SESSION_KEY = 'virtual-guard.session'
type Session = { accessToken: string; refreshToken: string; user: AuthUser }
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  useEffect(() => {
    let cancelled = false
    const clear = () => { setUser(null); setAuthToken(null); setRefreshToken(null); localStorage.removeItem(SESSION_KEY) }
    const update = (event: Event) => { const next = (event as CustomEvent<AuthUser>).detail; setUser(next); localStorage.setItem(SESSION_KEY, JSON.stringify(next)) }
    window.addEventListener(AUTH_EXPIRED_EVENT, clear)
    window.addEventListener(AUTH_USER_CHANGED_EVENT, update)
    if (localStorage.getItem('accessToken') || localStorage.getItem('refreshToken')) {
      api.get<AuthUser>('/api/auth/me').then(next => {
        if (!cancelled) { setUser(next); localStorage.setItem(SESSION_KEY, JSON.stringify(next)) }
      }).catch(() => { if (!cancelled) clear() }).finally(() => { if (!cancelled) setIsInitializing(false) })
    } else setIsInitializing(false)
    return () => { cancelled = true; window.removeEventListener(AUTH_EXPIRED_EVENT, clear); window.removeEventListener(AUTH_USER_CHANGED_EVENT, update) }
  }, [])
  function acceptSession(response: Session) {
    setAuthToken(response.accessToken); setRefreshToken(response.refreshToken); setUser(response.user)
    localStorage.setItem(SESSION_KEY, JSON.stringify(response.user))
  }
  async function login(email: string, password: string): Promise<AuthUser> {
    const response = await api.post<Session>('/api/auth/login', { email, password }); acceptSession(response); return response.user
  }
  async function changePassword(currentPassword: string, newPassword: string, confirmPassword: string) {
    acceptSession(await api.post<Session>('/api/auth/change-password', { currentPassword, newPassword, confirmPassword }))
  }
  function logout() { setUser(null); setAuthToken(null); setRefreshToken(null); localStorage.removeItem(SESSION_KEY) }
  return <AuthContext.Provider value={{ user, isAuthenticated: user !== null, isInitializing, login, logout, changePassword }}>{children}</AuthContext.Provider>
}
