import { createContext } from 'react'
import type { AuthUser } from '@/types'

export interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isInitializing: boolean
  login: (email: string, password: string) => Promise<AuthUser>
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
