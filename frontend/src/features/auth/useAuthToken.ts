import { useEffect, useState } from 'react'
import { AUTH_TOKEN_CHANGED_EVENT, getAuthToken } from '@/services/apiClient'

export function useAuthToken(): string | null {
  const [token, setToken] = useState(getAuthToken)

  useEffect(() => {
    const refreshToken = () => setToken(getAuthToken())
    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, refreshToken)
    return () => window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, refreshToken)
  }, [])

  return token
}
