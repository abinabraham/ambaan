import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, setSessionExpiredHandler, tokens } from '../api/client'
import type { AuthResponse, Currency, User } from '../api/types'

interface RegisterInput {
  email: string
  password: string
  full_name: string
  base_currency: Currency
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(Boolean(tokens.access))

  const clearSession = useCallback(() => {
    tokens.clear()
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    setSessionExpiredHandler(clearSession)
    if (!tokens.access) return
    api
      .get<User>('/accounts/profile/')
      .then(({ data }) => setUser(data))
      .catch(clearSession)
      .finally(() => setLoading(false))
  }, [clearSession])

  const startSession = useCallback((data: AuthResponse) => {
    tokens.set(data.access, data.refresh)
    setUser(data.user)
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post<AuthResponse>('/auth/login/', { email, password })
      startSession(data)
    },
    [startSession],
  )

  const register = useCallback(
    async (input: RegisterInput) => {
      const { data } = await api.post<AuthResponse>('/auth/register/', input)
      startSession(data)
    },
    [startSession],
  )

  const logout = useCallback(async () => {
    const refresh = tokens.refresh
    if (refresh) await api.post('/auth/logout/', { refresh }).catch(() => undefined)
    clearSession()
  }, [clearSession])

  const value = useMemo(
    () => ({ user, loading, login, register, logout, setUser }),
    [user, loading, login, register, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
