import dayjs from 'dayjs'
import type { Currency, Money } from '../api/types'

const LOCALES: Record<Currency, string> = { AED: 'en-AE', INR: 'en-IN', USD: 'en-US' }

export function formatMoney(value: Money | null | undefined, currency: Currency, opts: { compact?: boolean } = {}) {
  const amount = Number(value ?? 0)
  return new Intl.NumberFormat(LOCALES[currency], {
    style: 'currency',
    currency,
    notation: opts.compact ? 'compact' : 'standard',
    maximumFractionDigits: opts.compact ? 1 : 2,
    minimumFractionDigits: opts.compact ? 0 : 2,
  }).format(amount)
}

export function formatNumber(value: Money | null | undefined) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(value ?? 0))
}

export function formatDate(value: string | null | undefined, pattern = 'D MMM YYYY') {
  return value ? dayjs(value).format(pattern) : '—'
}

export function formatPct(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : `${value > 0 ? '+' : ''}${value}%`
}

export const ACCOUNT_TYPE_LABELS = {
  bank: 'Bank account',
  cash: 'Cash',
  wallet: 'Digital wallet',
  credit_card: 'Credit card',
} as const

export const FREQUENCY_LABELS = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
} as const

export const PRESET_COLORS = [
  '#1677ff', '#52c41a', '#fa8c16', '#f5222d', '#722ed1',
  '#13c2c2', '#eb2f96', '#faad14', '#2f54eb', '#8c8c8c',
]
