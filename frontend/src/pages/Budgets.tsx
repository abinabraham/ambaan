import { CopyOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Flex,
  Form,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Select,
  Slider,
  Tag,
  Typography,
} from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useState } from 'react'
import { api } from '../api/client'
import { useApiMutation, useBudgets, useCategories, useResource } from '../api/hooks'
import { CURRENCIES, type Budget, type Currency } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { ColorDot, PageHeader } from '../components/common'
import { formatMoney } from '../utils/format'

const STATUS = {
  ok: { color: '#16a34a', tag: 'green', label: 'On track' },
  warning: { color: '#f59e0b', tag: 'orange', label: 'Near limit' },
  exceeded: { color: '#ef4444', tag: 'red', label: 'Over budget' },
} as const

interface Values {
  category?: string | null
  amount: number
  currency: Currency
  alert_threshold: number
}

export default function BudgetsPage() {
  const { user } = useAuth()
  const [month, setMonth] = useState<Dayjs>(dayjs().startOf('month'))
  const monthParam = month.format('YYYY-MM-01')
  const { data: budgets = [], isLoading } = useBudgets({ month: monthParam })
  const { data: categories = [] } = useCategories({ kind: 'expense', is_archived: false })
  const { create, update, remove } = useResource<Budget>('/budgets', 'Budget')
  const copy = useApiMutation(
    () => api.post('/budgets/copy/', { from_month: month.subtract(1, 'month').format('YYYY-MM-01'), to_month: monthParam }),
    'Budgets copied from last month',
  )
  const [form] = Form.useForm<Values>()
  const [editing, setEditing] = useState<Budget | null>(null)
  const [open, setOpen] = useState(false)

  const openForm = (budget: Budget | null) => {
    setEditing(budget)
    form.resetFields()
    form.setFieldsValue(
      budget
        ? { ...budget, amount: Number(budget.amount) }
        : { currency: user!.base_currency, alert_threshold: 80, category: null },
    )
    setOpen(true)
  }

  const submit = (values: Values) => {
    const data = { ...values, category: values.category ?? null, amount: values.amount.toFixed(2), month: monthParam }
    const close = { onSuccess: () => setOpen(false) }
    if (editing) update.mutate({ id: editing.id, data }, close)
    else create.mutate(data, close)
  }

  const totals = CURRENCIES.map((currency) => {
    const list = budgets.filter((b) => b.currency === currency)
    const overall = list.find((b) => !b.category)
    const categoryBudgets = list.filter((b) => b.category)
    return {
      currency,
      count: list.length,
      allocated: overall ? Number(overall.amount) : categoryBudgets.reduce((s, b) => s + Number(b.amount), 0),
      spent: overall ? Number(overall.spent) : categoryBudgets.reduce((s, b) => s + Number(b.spent), 0),
    }
  }).filter((t) => t.count)

  return (
    <>
      <PageHeader
        title="Budgets"
        subtitle="Monthly spending limits, overall or per category"
        actions={
          <>
            <DatePicker picker="month" value={month} allowClear={false} format="MMMM YYYY"
              onChange={(m) => m && setMonth(m.startOf('month'))} />
            <Button icon={<CopyOutlined />} loading={copy.isPending} onClick={() => copy.mutate(undefined)}>
              Copy last month
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm(null)}>Add budget</Button>
          </>
        }
      />

      {totals.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          {totals.map((t) => (
            <Col key={t.currency} xs={24} md={8}>
              <Card size="small">
                <Typography.Text type="secondary">{t.currency} budget utilisation</Typography.Text>
                <div className="stat-value">
                  {formatMoney(t.spent, t.currency)}{' '}
                  <Typography.Text type="secondary" style={{ fontSize: 14 }}>of {formatMoney(t.allocated, t.currency)}</Typography.Text>
                </div>
                <Progress percent={t.allocated ? Math.round((t.spent / t.allocated) * 100) : 0} showInfo />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {!isLoading && budgets.length === 0 ? (
        <Card>
          <Empty description={`No budgets for ${month.format('MMMM YYYY')}`}>
            <Button type="primary" onClick={() => openForm(null)}>Create a budget</Button>
          </Empty>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {budgets.map((b) => {
            const status = STATUS[b.status]
            return (
              <Col key={b.id} xs={24} md={12} xl={8}>
                <Card loading={isLoading}>
                  <Flex justify="space-between" align="start">
                    <div>
                      <Typography.Title level={5} style={{ margin: 0 }}>
                        <ColorDot color={b.category_color ?? '#0f766e'} />
                        {b.category_name ?? 'Overall spending'}
                      </Typography.Title>
                      <Tag color={status.tag} style={{ marginTop: 6 }}>{status.label}</Tag>
                    </div>
                    <Flex>
                      <Button type="text" icon={<EditOutlined />} onClick={() => openForm(b)} />
                      <Popconfirm title="Delete this budget?" onConfirm={() => remove.mutate(b.id)}>
                        <Button type="text" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Flex>
                  </Flex>
                  <Progress
                    percent={Math.min(b.utilization, 100)}
                    strokeColor={status.color}
                    status={b.status === 'exceeded' ? 'exception' : 'normal'}
                    format={() => `${b.utilization}%`}
                    style={{ marginTop: 12 }}
                  />
                  <Flex justify="space-between">
                    <Typography.Text>
                      Spent <b>{formatMoney(b.spent, b.currency)}</b>
                    </Typography.Text>
                    <Typography.Text type="secondary">of {formatMoney(b.amount, b.currency)}</Typography.Text>
                  </Flex>
                  <Typography.Text type={Number(b.remaining) < 0 ? 'danger' : 'secondary'}>
                    {Number(b.remaining) < 0
                      ? `${formatMoney(-Number(b.remaining), b.currency)} over budget`
                      : `${formatMoney(b.remaining, b.currency)} left`}
                  </Typography.Text>
                </Card>
              </Col>
            )
          })}
        </Row>
      )}

      <Modal
        title={`${editing ? 'Edit' : 'New'} budget · ${month.format('MMMM YYYY')}`}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={create.isPending || update.isPending}
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}>
          <Form.Item name="category" label="Category" extra="Leave empty for an overall monthly budget.">
            <Select
              allowClear
              showSearch={{ optionFilterProp: 'label' }}
              placeholder="Overall spending"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={16}>
              <Form.Item name="amount" label="Limit" rules={[{ required: true }]}>
                <InputNumber min={0.01} precision={2} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="currency" label="Currency">
                <Select options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="alert_threshold" label="Alert me at (% of limit)">
            <Slider min={50} max={100} marks={{ 50: '50%', 80: '80%', 100: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
