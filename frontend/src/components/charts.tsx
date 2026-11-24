import { Empty } from 'antd'
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { CategoryTotal, Currency, MonthPoint } from '../api/types'
import { formatMoney } from '../utils/format'

const INCOME = '#16a34a'
const EXPENSE = '#ef4444'
const NET = '#0f766e'

export function CashFlowChart({ data, currency, height = 300 }: { data: MonthPoint[]; currency: Currency; height?: number }) {
  if (!data.some((d) => d.income || d.expenses)) {
    return <Empty description="No income or expenses yet" style={{ padding: 40 }} />
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f2" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={12}
          width={64}
          tickFormatter={(v: number) => formatMoney(v, currency, { compact: true })}
        />
        <Tooltip formatter={(v) => formatMoney(Number(v), currency)} />
        <Legend />
        <Bar dataKey="income" name="Income" fill={INCOME} radius={[4, 4, 0, 0]} maxBarSize={36} />
        <Bar dataKey="expenses" name="Expenses" fill={EXPENSE} radius={[4, 4, 0, 0]} maxBarSize={36} />
        <Line dataKey="net_cash_flow" name="Net cash flow" stroke={NET} strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export function CategoryPie({ data, currency, height = 300 }: { data: CategoryTotal[]; currency: Currency; height?: number }) {
  if (!data.length) return <Empty description="No spending recorded" style={{ padding: 40 }} />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="total"
          nameKey="name"
          innerRadius="55%"
          outerRadius="85%"
          paddingAngle={2}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip formatter={(v, name) => [formatMoney(Number(v), currency), name]} />
        <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function CumulativeSpendChart({
  data,
  currency,
  height = 260,
}: {
  data: { date: string; total: number; cumulative: number }[]
  currency: Currency
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f2" />
        <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(8)} tickLine={false} axisLine={false} fontSize={12} />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={12}
          width={64}
          tickFormatter={(v: number) => formatMoney(v, currency, { compact: true })}
        />
        <Tooltip formatter={(v, name) => [formatMoney(Number(v), currency), name]} />
        <Area dataKey="cumulative" name="Spent so far" stroke={EXPENSE} fill={EXPENSE} fillOpacity={0.12} />
        <Bar dataKey="total" name="Daily" fill={EXPENSE} maxBarSize={12} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
