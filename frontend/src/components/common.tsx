import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons'
import { Card, Select, Typography } from 'antd'
import type { ReactNode } from 'react'
import { CURRENCIES, type Currency, type Money, type TransactionType } from '../api/types'
import { formatMoney } from '../utils/format'

export function CurrencySelect({
  value,
  onChange,
  options = CURRENCIES,
}: {
  value?: Currency
  onChange?: (value: Currency) => void
  options?: Currency[]
}) {
  return (
    <Select
      value={value}
      onChange={onChange}
      style={{ width: 100 }}
      options={options.map((c) => ({ value: c, label: c }))}
    />
  )
}

export function Amount({ value, currency, type }: { value: Money; currency: Currency; type?: TransactionType }) {
  const sign = type === 'income' ? '+' : type === 'expense' ? '−' : ''
  return (
    <span className={`amount-${type ?? 'transfer'}`}>
      {sign}
      {formatMoney(value, currency)}
    </span>
  )
}

export function StatCard({
  title,
  value,
  currency,
  change,
  invertChange,
  extra,
  color,
}: {
  title: string
  value: Money | string
  currency?: Currency
  change?: number | null
  invertChange?: boolean
  extra?: ReactNode
  color?: string
}) {
  const positive = (change ?? 0) >= 0
  const good = invertChange ? !positive : positive
  return (
    <Card size="small" style={{ height: '100%' }} styles={{ body: { padding: 18 } }}>
      <Typography.Text type="secondary">{title}</Typography.Text>
      <div className="stat-value" style={{ color }}>
        {currency ? formatMoney(value, currency) : value}
      </div>
      {change !== undefined && change !== null && (
        <Typography.Text style={{ color: good ? '#16a34a' : '#dc2626', fontSize: 13 }}>
          {positive ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {Math.abs(change)}% vs last month
        </Typography.Text>
      )}
      {extra && <div style={{ marginTop: 4 }}>{extra}</div>}
    </Card>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <Typography.Title level={2} style={{ margin: 0 }}>{title}</Typography.Title>
        {subtitle && <Typography.Text type="secondary">{subtitle}</Typography.Text>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  )
}

export function ColorDot({ color }: { color?: string | null }) {
  return <span className="color-dot" style={{ background: color ?? '#8c8c8c' }} />
}
