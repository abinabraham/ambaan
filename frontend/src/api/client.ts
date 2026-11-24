import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

const ACCESS_KEY = 'ambaan.access'
const REFRESH_KEY = 'ambaan.refresh'

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY)
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY)
  },
  set(access: string, refresh?: string) {
    localStorage.setItem(ACCESS_KEY, access)
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

export const api = axios.create({ baseURL: API_URL })

api.interceptors.request.use((config) => {
  const access = tokens.access
  if (access) config.headers.Authorization = `Bearer ${access}`
  return config
})

let refreshing: Promise<string> | null = null
let onSessionExpired: () => void = () => {}

export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler
}

async function refreshAccessToken(): Promise<string> {
  const refresh = tokens.refresh
  if (!refresh) throw new Error('No refresh token')
  const { data } = await axios.post(`${API_URL}/auth/refresh/`, { refresh })
  tokens.set(data.access, data.refresh)
  return data.access
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined
    const isAuthCall = original?.url?.includes('/auth/')
    if (error.response?.status !== 401 || !original || original._retry || isAuthCall) {
      throw error
    }
    original._retry = true
    try {
      refreshing ??= refreshAccessToken().finally(() => {
        refreshing = null
      })
      const access = await refreshing
      original.headers.Authorization = `Bearer ${access}`
      return api(original)
    } catch {
      tokens.clear()
      onSessionExpired()
      throw error
    }
  },
)

/** Turns a DRF error payload into a single readable message. */
export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (!axios.isAxiosError(error)) return fallback
  const data = error.response?.data as unknown
  if (!data) return error.message || fallback
  if (typeof data === 'string') return fallback
  const flatten = (value: unknown): string[] => {
    if (typeof value === 'string') return [value]
    if (Array.isArray(value)) return value.flatMap(flatten)
    if (value && typeof value === 'object') {
      return Object.entries(value).flatMap(([key, v]) =>
        flatten(v).map((msg) => (key === 'detail' || key === 'non_field_errors' ? msg : `${key}: ${msg}`)),
      )
    }
    return []
  }
  return flatten(data).join(' ') || fallback
}

/** Maps DRF field errors onto Ant Design form fields. */
export function fieldErrors<T>(error: unknown): { name: keyof T & string; errors: string[] }[] {
  if (!axios.isAxiosError(error)) return []
  const data = error.response?.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return []
  return Object.entries(data as Record<string, unknown>)
    .filter(([key, value]) => key !== 'detail' && key !== 'non_field_errors' && Array.isArray(value))
    .map(([name, value]) => ({ name: name as keyof T & string, errors: (value as unknown[]).map(String) }))
}
