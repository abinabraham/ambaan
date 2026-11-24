import { Alert, Button, Card, Col, Empty, Flex, List, Progress, Row, Skeleton, Table, Tag, Typography } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDashboard } from '../api/hooks'
import type { Currency, Transaction } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { CashFlowChart, CategoryPie } from '../components/charts'
import { Amount, ColorDot, CurrencySelect, PageHeader, StatCard } from '../components/common'
import { ACCOUNT_TYPE_LABELS, formatDate, formatMoney } from '../utils/format'

const BUDGET_COLORS = { ok: '#16a34a', warning: '#f59e0b', exceeded: '#ef4444' }

export default function DashboardPage() {
  const { user } = useAuth()
  const [currency, setCurrency] = useState<Currency>(user!.base_currency)
  const { data, isLoading } = useDashboard(currency)

  if (isLoading || !data) return <Skeleton active paragraph={{ rows: 12 }} />

  const { summary, comparison, consolidated, balances, net_worth_converted: netWorth } = data
  const multiCurrency = data.currencies.length > 1
  const missingRates = [...new Set([...consolidated.missing_rates, ...netWorth.missing_rates])]
  const balanceForCurrency = balances.by_currency.find((b) => b.currency === currency)

  return (
    <>
      <PageHeader
        title={`Hello${user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}`}
        subtitle={`Your finances for ${formatDate(data.month, 'MMMM YYYY')}`}
        actions={<CurrencySelect value={currency} onChange={setCurrency} options={data.currencies} />}
      />

      {balances.accounts.length === 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 20 }}
          title="Start by adding your bank, cash, wallet or credit card accounts."
          action={<Link to="/accounts"><Button type="primary" size="small">Add account</Button></Link>}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={12} lg={6}>
          <StatCard title="Income this month" value={summary.income} currency={currency}
            change={comparison.income_change_pct} color="#16a34a" />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard title="Expenses this month" value={summary.expenses} currency={currency}
            change={comparison.expense_change_pct} invertChange color="#dc2626" />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard title="Net cash flow" value={summary.net_cash_flow} currency={currency}
            color={summary.net_cash_flow >= 0 ? '#0f766e' : '#dc2626'} />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard
            title="Savings rate"
            value={summary.savings_rate === null ? '—' : `${summary.savings_rate}%`}
            extra={<Typography.Text type="secondary" style={{ fontSize: 13 }}>Net savings ÷ income</Typography.Text>}
          />
        </Col>
      </Row>

      {multiCurrency && (
        <Card size="small" style={{ marginTop: 16 }}>
          <Flex wrap gap={24} align="center">
            <Typography.Text strong>All currencies in {consolidated.currency}</Typography.Text>
            <span>Income <b className="amount-income">{formatMoney(consolidated.income, consolidated.currency)}</b></span>
            <span>Expenses <b className="amount-expense">{formatMoney(consolidated.expenses, consolidated.currency)}</b></span>
            <span>Net worth <b>{formatMoney(netWorth.net_worth, netWorth.currency)}</b></span>
            {missingRates.length > 0 && (
              <Tag color="warning">
                Excludes {missingRates.join(', ')} — <Link to="/settings">add exchange rates</Link>
              </Tag>
            )}
          </Flex>
        </Card>
      )}

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={15}>
          <Card title="Cash flow — last 6 months">
            <CashFlowChart data={data.trend} currency={currency} />
          </Card>
        </Col>
        <Col xs={24} xl={9}>
          <Card title="Spending by category" extra={<Link to="/analytics">Details</Link>}>
            <CategoryPie data={data.expense_categories} currency={currency} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card
            title="Accounts"
            extra={balanceForCurrency && (
              <Typography.Text type="secondary">
                Net worth ({currency}): <b>{formatMoney(balanceForCurrency.net_worth, currency)}</b>
              </Typography.Text>
            )}
            style={{ height: '100%' }}
          >
            {balances.accounts.length === 0 ? (
              <Empty description="No accounts yet" />
            ) : (
              <List
                dataSource={balances.accounts}
                renderItem={(a) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<ColorDot color={a.color} />}
                      title={a.name}
                      description={ACCOUNT_TYPE_LABELS[a.type]}
                    />
                    <Typography.Text strong style={{ color: a.balance < 0 ? '#dc2626' : undefined }}>
                      {formatMoney(a.balance, a.currency)}
                    </Typography.Text>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Budgets this month" extra={<Link to="/budgets">Manage</Link>} style={{ height: '100%' }}>
            {data.budgets.length === 0 ? (
              <Empty description={`No ${currency} budgets for this month`} />
            ) : (
              data.budgets.map((b) => (
                <div key={b.budget_id} style={{ marginBottom: 14 }}>
                  <Flex justify="space-between">
                    <span><ColorDot color={b.color} />{b.name}</span>
                    <Typography.Text type="secondary">
                      {formatMoney(b.spent, b.currency)} / {formatMoney(b.amount, b.currency)}
                    </Typography.Text>
                  </Flex>
                  <Progress percent={Math.min(b.utilization, 100)} strokeColor={BUDGET_COLORS[b.status]}
                    status={b.status === 'exceeded' ? 'exception' : 'normal'}
                    format={() => `${b.utilization}%`} />
                </div>
              ))
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={15}>
          <Card title="Recent transactions" extra={<Link to="/transactions">View all</Link>}>
            <Table<Transaction>
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={data.recent_transactions}
              scroll={{ x: 520 }}
              columns={[
                { title: 'Date', dataIndex: 'transaction_date', render: (d: string) => formatDate(d, 'D MMM') },
                {
                  title: 'Details',
                  render: (_, t) => (
                    <div>
                      <div>{t.description || t.payee || t.category_name || 'Transfer'}</div>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {t.type === 'transfer' ? `${t.account_name} → ${t.to_account_name}` : `${t.category_name} · ${t.account_name}`}
                      </Typography.Text>
                    </div>
                  ),
                },
                {
                  title: 'Amount',
                  align: 'right',
                  render: (_, t) => <Amount value={t.amount} currency={t.currency} type={t.type} />,
                },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} xl={9}>
          <Card title="Upcoming (14 days)" extra={<Link to="/recurring">Recurring</Link>}>
            {data.upcoming.length === 0 ? (
              <Empty description="Nothing due soon" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                size="small"
                dataSource={data.upcoming.slice(0, 6)}
                renderItem={(u) => (
                  <List.Item>
                    <List.Item.Meta title={u.name} description={formatDate(u.due_date, 'ddd, D MMM')} />
                    <Amount value={u.amount} currency={u.currency} type={u.type} />
                  </List.Item>
                )}
              />
            )}
          </Card>
          <Card title="Savings goals" extra={<Link to="/savings">All goals</Link>} style={{ marginTop: 16 }}>
            {data.savings_goals.length === 0 ? (
              <Empty description="No active goals" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              data.savings_goals.map((g) => (
                <div key={g.id} style={{ marginBottom: 12 }}>
                  <Flex justify="space-between">
                    <span>{g.name}</span>
                    <Typography.Text type="secondary">
                      {formatMoney(g.saved_amount, g.currency)} / {formatMoney(g.target_amount, g.currency)}
                    </Typography.Text>
                  </Flex>
                  <Progress percent={Math.round(g.progress)} strokeColor={g.color} />
                </div>
              ))
            )}
          </Card>
        </Col>
      </Row>
    </>
  )
}
