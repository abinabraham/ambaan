import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App } from 'antd'
import { api, errorMessage } from './client'
import type {
  AdviceResponse,
  Budget,
  Category,
  Dashboard,
  ExchangeRate,
  FinanceAccount,
  MonthlyReport,
  Notification,
  Paginated,
  RecurringItem,
  SavingsGoal,
  Transaction,
  UpcomingItem,
  YearlyReport,
} from './types'

type Params = Record<string, string | number | boolean | undefined | null>

function clean(params?: Params) {
  if (!params) return undefined
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
}

export function useApiQuery<T>(url: string, params?: Params, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [url, clean(params)],
    queryFn: async () => (await api.get<T>(url, { params: clean(params) })).data,
    enabled: options.enabled,
  })
}

/**
 * Mutation that refreshes every cached query on success: balances, budgets and reports all
 * depend on each other, so a targeted invalidation would be easy to get wrong.
 */
export function useApiMutation<TVars, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  successMessage?: string,
) {
  const queryClient = useQueryClient()
  const { message } = App.useApp()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries()
      if (successMessage) message.success(successMessage)
    },
    onError: (error) => message.error(errorMessage(error)),
  })
}

export function useResource<T extends { id: string }>(path: string, label: string) {
  const create = useApiMutation(
    async (data: Partial<T> | FormData) => (await api.post<T>(`${path}/`, data)).data,
    `${label} created`,
  )
  const update = useApiMutation(
    async ({ id, data }: { id: string; data: Partial<T> }) => (await api.patch<T>(`${path}/${id}/`, data)).data,
    `${label} updated`,
  )
  const remove = useApiMutation(async (id: string) => {
    await api.delete(`${path}/${id}/`)
  }, `${label} deleted`)
  return { create, update, remove }
}

export const useAccounts = (params?: Params) => useApiQuery<FinanceAccount[]>('/finance-accounts/', params)
export const useCategories = (params?: Params) => useApiQuery<Category[]>('/categories/', params)
export const useTransactions = (params?: Params) => useApiQuery<Paginated<Transaction>>('/transactions/', params)
export const useBudgets = (params?: Params) => useApiQuery<Budget[]>('/budgets/', params)
export const useSavingsGoals = (params?: Params) => useApiQuery<SavingsGoal[]>('/savings/', params)
export const useRecurring = (params?: Params) => useApiQuery<RecurringItem[]>('/recurring/', params)
export const useUpcoming = (days = 30) => useApiQuery<UpcomingItem[]>('/recurring/upcoming/', { days })
export const useExchangeRates = () => useApiQuery<Paginated<ExchangeRate>>('/exchange-rates/', { page_size: 200 })
export const useNotifications = () => useApiQuery<Paginated<Notification>>('/notifications/', { page_size: 20 })
export const useDashboard = (currency?: string) => useApiQuery<Dashboard>('/dashboard/', { currency })
export const useMonthlyReport = (params: Params) => useApiQuery<MonthlyReport>('/analytics/monthly/', params)
export const useYearlyReport = (params: Params) => useApiQuery<YearlyReport>('/analytics/yearly/', params)
export const useAdvice = (currency?: string) => useApiQuery<AdviceResponse>('/analytics/ai-advice/', { currency })
