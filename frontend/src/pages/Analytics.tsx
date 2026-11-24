import { BulbOutlined } from '@ant-design/icons'
import { Alert, Card, Col, DatePicker, Empty, Flex, Progress, Row, Skeleton, Table, Tabs, Tag, Typography } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useState } from 'react'
import { useAdvice, useMonthlyReport, useYearlyReport } from '../api/hooks'
import { CURRENCIES, type CategoryChange, type CategoryTotal, type Currency } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { CashFlowChart, CategoryPie, CumulativeSpendChart } from '../components/charts'
import { ColorDot, CurrencySelect, PageHeader, StatCard } from '../components/common'
import { formatDate, formatMoney, formatPct } from '../utils/format'

function CategoryTable({ data, currency }: { data: CategoryTotal[]; currency: Currency }) {
  return (
    <Table<CategoryTotal>
      size="small"
      rowKey={(r) => r.category_id ?? r.name}
      dataSource={data}
      pagination={false}
      columns={[
        { title: 'Category', render: (_, r) => <span><ColorDot color={r.color} />{r.name}</span> },
        { title: 'Txns', dataIndex: 'count', align: 'right', width: 60 },
        { title: 'Share', dataIndex: 'percentage', align: 'right', width: 80, render: (p: number) => `${p}%` },
        { title: 'Total', dataIndex: 'total', align: 'right', render: (v: number) => formatMoney(v, currency) },
      ]}
    />
  )
}

function MonthlyTab({ currency }: { currency: Currency }) {
  const [month, setMonth] = useState<Dayjs>(dayjs())
  const { data, isLoading } = useMonthlyReport({ currency, year: month.year(), month: month.month() + 1 })

  return (
    <>
      <Flex justify="end" style={{ marginBottom: 16 }}>
        <DatePicker picker="month" value={month} allowClear={false} format="MMMM YYYY"
          onChange={(m) => m && setMonth(m)} disabledDate={(d) => d.isAfter(dayjs(), 'month')} />
      </Flex>
      {isLoading || !data ? <Skeleton active /> : (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={12} lg={6}>
              <StatCard title="Income" value={data.summary.income} currency={currency}
                change={data.comparison.income_change_pct} color="#16a34a" />
            </Col>
            <Col xs={12} lg={6}>
              <StatCard title="Expenses" value={data.summary.expenses} currency={currency}
                change={data.comparison.expense_change_pct} invertChange color="#dc2626" />
            </Col>
            <Col xs={12} lg={6}>
              <StatCard title="Net cash flow" value={data.summary.net_cash_flow} currency={currency}
                extra={<Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  {data.comparison.net_change >= 0 ? '+' : ''}{formatMoney(data.comparison.net_change, currency)} vs {formatDate(data.previous_month, 'MMM')}
                </Typography.Text>} />
            </Col>
            <Col xs={12} lg={6}>
              <StatCard title="Savings rate"
                value={data.summary.savings_rate === null ? '—' : `${data.summary.savings_rate}%`}
                extra={<Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  Last month: {data.previous_summary.savings_rate === null ? '—' : `${data.previous_summary.savings_rate}%`}
                </Typography.Text>} />
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} xl={14}>
              <Card title="Spending through the month">
                <CumulativeSpendChart data={data.daily_spending} currency={currency} />
              </Card>
            </Col>
            <Col xs={24} xl={10}>
              <Card title="Expenses by category">
                <CategoryPie data={data.expense_categories} currency={currency} height={260} />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} xl={12}>
              <Card title={`Change vs ${formatDate(data.previous_month, 'MMMM')}`}>
                <Table<CategoryChange>
                  size="small"
                  rowKey={(r) => r.category_id ?? r.name}
                  dataSource={data.category_changes}
                  pagination={{ pageSize: 8, hideOnSinglePage: true }}
                  columns={[
                    { title: 'Category', dataIndex: 'name' },
                    { title: 'This month', dataIndex: 'current', align: 'right', render: (v: number) => formatMoney(v, currency) },
                    { title: 'Last month', dataIndex: 'previous', align: 'right', render: (v: number) => formatMoney(v, currency) },
                    {
                      title: 'Change',
                      align: 'right',
                      render: (_, r) => (
                        <span style={{ color: r.change > 0 ? '#dc2626' : r.change < 0 ? '#16a34a' : undefined }}>
                          {r.change > 0 ? '+' : ''}{formatMoney(r.change, currency)}
                          {r.change_pct !== null && <div className="muted" style={{ fontSize: 12 }}>{formatPct(r.change_pct)}</div>}
                        </span>
                      ),
                    },
                  ]}
                />
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card title="Budget utilisation" style={{ marginBottom: 16 }}>
                {data.budgets.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No budgets this month" /> :
                  data.budgets.map((b) => (
                    <div key={b.budget_id} style={{ marginBottom: 10 }}>
                      <Flex justify="space-between">
                        <span>{b.name}</span>
                        <Typography.Text type="secondary">{formatMoney(b.spent, currency)} / {formatMoney(b.amount, currency)}</Typography.Text>
                      </Flex>
                      <Progress percent={Math.min(b.utilization, 100)} format={() => `${b.utilization}%`}
                        status={b.status === 'exceeded' ? 'exception' : 'normal'} />
                    </div>
                  ))}
              </Card>
              <Card title="Largest expenses">
                <Table
                  size="small"
                  rowKey="id"
                  dataSource={data.top_expenses}
                  pagination={false}
                  locale={{ emptyText: 'No expenses' }}
                  columns={[
                    { title: 'Date', dataIndex: 'date', render: (d: string) => formatDate(d, 'D MMM') },
                    { title: 'Description', dataIndex: 'description' },
                    { title: 'Amount', dataIndex: 'amount', align: 'right', render: (v: number) => formatMoney(v, currency) },
                  ]}
                />
              </Card>
            </Col>
          </Row>

          <Card title="Income sources" style={{ marginTop: 16 }}>
            <CategoryTable data={data.income_categories} currency={currency} />
          </Card>
        </>
      )}
    </>
  )
}

function YearlyTab({ currency }: { currency: Currency }) {
  const [year, setYear] = useState<Dayjs>(dayjs())
  const { data, isLoading } = useYearlyReport({ currency, year: year.year() })

  return (
    <>
      <Flex justify="end" style={{ marginBottom: 16 }}>
        <DatePicker picker="year" value={year} allowClear={false} onChange={(y) => y && setYear(y)}
          disabledDate={(d) => d.isAfter(dayjs(), 'year')} />
      </Flex>
      {isLoading || !data ? <Skeleton active /> : (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={12} lg={6}>
              <StatCard title={`Income ${data.year}`} value={data.summary.income} currency={currency} color="#16a34a"
                extra={<Typography.Text type="secondary" style={{ fontSize: 13 }}>{formatPct(data.comparison.income_change_pct)} vs {data.year - 1}</Typography.Text>} />
            </Col>
            <Col xs={12} lg={6}>
              <StatCard title={`Expenses ${data.year}`} value={data.summary.expenses} currency={currency} color="#dc2626"
                extra={<Typography.Text type="secondary" style={{ fontSize: 13 }}>{formatPct(data.comparison.expense_change_pct)} vs {data.year - 1}</Typography.Text>} />
            </Col>
            <Col xs={12} lg={6}>
              <StatCard title="Net savings" value={data.summary.net_cash_flow} currency={currency}
                extra={<Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  Savings rate {data.summary.savings_rate === null ? '—' : `${data.summary.savings_rate}%`}
                </Typography.Text>} />
            </Col>
            <Col xs={12} lg={6}>
              <StatCard title="Avg monthly spend" value={data.average_monthly_expenses} currency={currency}
                extra={<Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  Avg income {formatMoney(data.average_monthly_income, currency)}
                </Typography.Text>} />
            </Col>
          </Row>
          <Card title="Month by month" style={{ marginTop: 16 }}
            extra={
              <Flex gap={8} wrap>
                {data.highest_spending_month && <Tag color="red">Highest spend: {data.highest_spending_month}</Tag>}
                {data.best_savings_month && <Tag color="green">Best savings: {data.best_savings_month}</Tag>}
              </Flex>
            }>
            <CashFlowChart data={data.monthly} currency={currency} height={340} />
          </Card>
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} xl={12}>
              <Card title="Expenses by category"><CategoryTable data={data.expense_categories} currency={currency} /></Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card title="Income by category"><CategoryTable data={data.income_categories} currency={currency} /></Card>
            </Col>
          </Row>
        </>
      )}
    </>
  )
}

const LEVEL_TYPE = { error: 'error', warning: 'warning', info: 'info', success: 'success' } as const

function AdviceTab({ currency }: { currency: Currency }) {
  const { data, isLoading } = useAdvice(currency)
  if (isLoading || !data) return <Skeleton active />
  return (
    <>
      <Typography.Paragraph type="secondary">
        <BulbOutlined /> Insights generated from your {currency} transactions, budgets, balances and goals.
        Averages use your last three complete months: spending {formatMoney(data.metrics.average_monthly_expenses, currency)}/month,
        surplus {formatMoney(data.metrics.average_monthly_net, currency)}/month.
      </Typography.Paragraph>
      <Flex vertical gap={12}>
        {data.insights.map((insight, i) => (
          <Alert key={i} type={LEVEL_TYPE[insight.level]} showIcon title={<b>{insight.title}</b>} description={insight.detail} />
        ))}
      </Flex>
    </>
  )
}

export default function AnalyticsPage() {
  const { user } = useAuth()
  const [currency, setCurrency] = useState<Currency>(user!.base_currency)
  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Reports are calculated per currency; no amounts are mixed without an exchange rate."
        actions={<CurrencySelect value={currency} onChange={setCurrency} options={CURRENCIES} />}
      />
      <Card>
        <Tabs
          items={[
            { key: 'monthly', label: 'Monthly', children: <MonthlyTab currency={currency} /> },
            { key: 'yearly', label: 'Yearly', children: <YearlyTab currency={currency} /> },
            { key: 'advice', label: 'AI advice', children: <AdviceTab currency={currency} /> },
          ]}
        />
      </Card>
    </>
  )
}
