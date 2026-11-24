import { CheckOutlined, DeleteOutlined, EditOutlined, ForwardOutlined, PlusOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  Col,
  DatePicker,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useState } from 'react'
import { api } from '../api/client'
import { useAccounts, useApiMutation, useCategories, useRecurring, useResource, useUpcoming } from '../api/hooks'
import type { CategoryKind, Currency, Frequency, RecurringItem } from '../api/types'
import { Amount, PageHeader } from '../components/common'
import { formatDate, formatMoney, FREQUENCY_LABELS } from '../utils/format'

interface Values {
  name: string
  type: CategoryKind
  account: string
  category: string
  amount: number
  frequency: Frequency
  interval: number
  start_date: Dayjs
  end_date?: Dayjs | null
  next_due_date?: Dayjs
  auto_create: boolean
  remind_days_before: number
  payee?: string
  is_active?: boolean
}

function describeSchedule(item: RecurringItem) {
  const unit = { daily: 'day', weekly: 'week', monthly: 'month', quarterly: 'quarter', yearly: 'year' }[item.frequency]
  return item.interval === 1 ? FREQUENCY_LABELS[item.frequency] : `Every ${item.interval} ${unit}s`
}

export default function RecurringPage() {
  const { data: items = [], isLoading } = useRecurring()
  const { data: upcoming = [] } = useUpcoming(30)
  const { data: accounts = [] } = useAccounts({ is_active: true })
  const { data: categories = [] } = useCategories({ is_archived: false })
  const { create, update, remove } = useResource<RecurringItem>('/recurring', 'Recurring item')
  const postNow = useApiMutation((id: string) => api.post(`/recurring/${id}/post/`), 'Transaction recorded')
  const skip = useApiMutation((id: string) => api.post(`/recurring/${id}/skip/`), 'Occurrence skipped')
  const [form] = Form.useForm<Values>()
  const [editing, setEditing] = useState<RecurringItem | null>(null)
  const [open, setOpen] = useState(false)
  const type = Form.useWatch('type', form) ?? 'expense'

  const openForm = (item: RecurringItem | null) => {
    setEditing(item)
    form.resetFields()
    form.setFieldsValue(
      item
        ? {
            ...item,
            amount: Number(item.amount),
            start_date: dayjs(item.start_date),
            end_date: item.end_date ? dayjs(item.end_date) : null,
            next_due_date: dayjs(item.next_due_date),
          }
        : {
            type: 'expense',
            frequency: 'monthly',
            interval: 1,
            start_date: dayjs(),
            auto_create: true,
            remind_days_before: 3,
            account: accounts[0]?.id,
          },
    )
    setOpen(true)
  }

  const submit = (values: Values) => {
    const data = {
      ...values,
      amount: values.amount.toFixed(2),
      start_date: values.start_date.format('YYYY-MM-DD'),
      end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : null,
      next_due_date: values.next_due_date?.format('YYYY-MM-DD'),
      payee: values.payee ?? '',
    }
    const close = { onSuccess: () => setOpen(false) }
    if (editing) update.mutate({ id: editing.id, data }, close)
    else create.mutate(data, close)
  }

  const monthlyTotals = items
    .filter((i) => i.is_active)
    .reduce<Record<string, { income: number; expense: number }>>((acc, i) => {
      const perMonth = { daily: 30, weekly: 4.33, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 }[i.frequency] / i.interval
      acc[i.currency] ??= { income: 0, expense: 0 }
      acc[i.currency][i.type] += Number(i.amount) * perMonth
      return acc
    }, {})

  return (
    <>
      <PageHeader
        title="Recurring"
        subtitle="Bills, subscriptions, salary and other repeating transactions"
        actions={<Button type="primary" icon={<PlusOutlined />} onClick={() => openForm(null)}>Add recurring</Button>}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card>
            <Table<RecurringItem>
              rowKey="id"
              loading={isLoading}
              dataSource={items}
              pagination={false}
              scroll={{ x: 760 }}
              columns={[
                {
                  title: 'Name',
                  render: (_, i) => (
                    <div style={{ opacity: i.is_active ? 1 : 0.5 }}>
                      <div>{i.name} {!i.is_active && <Tag>Paused</Tag>}</div>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {i.category_name} · {i.account_name}
                      </Typography.Text>
                    </div>
                  ),
                },
                { title: 'Schedule', render: (_, i) => describeSchedule(i) },
                {
                  title: 'Next due',
                  dataIndex: 'next_due_date',
                  render: (d: string, i) => (
                    <span>
                      {formatDate(d)}{' '}
                      {i.is_active && dayjs(d).isBefore(dayjs(), 'day') && <Tag color="red">Overdue</Tag>}
                    </span>
                  ),
                },
                {
                  title: 'Mode',
                  render: (_, i) => (i.auto_create ? <Tag color="blue">Auto</Tag> : <Tag>Reminder</Tag>),
                },
                {
                  title: 'Amount',
                  align: 'right',
                  render: (_, i) => <Amount value={i.amount} currency={i.currency} type={i.type} />,
                },
                {
                  title: '',
                  align: 'right',
                  width: 170,
                  render: (_, i) => (
                    <Flex gap={2} justify="end">
                      <Tooltip title={i.type === 'expense' ? 'Mark paid now' : 'Record received now'}>
                        <Button type="text" icon={<CheckOutlined />} disabled={!i.is_active}
                          onClick={() => postNow.mutate(i.id)} />
                      </Tooltip>
                      <Tooltip title="Skip this occurrence">
                        <Button type="text" icon={<ForwardOutlined />} disabled={!i.is_active}
                          onClick={() => skip.mutate(i.id)} />
                      </Tooltip>
                      <Button type="text" icon={<EditOutlined />} onClick={() => openForm(i)} />
                      <Popconfirm title={`Delete ${i.name}?`} description="Past transactions are kept."
                        onConfirm={() => remove.mutate(i.id)}>
                        <Button type="text" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Flex>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card title="Monthly commitments" size="small" style={{ marginBottom: 16 }}>
            {Object.keys(monthlyTotals).length === 0 && <Typography.Text type="secondary">None yet</Typography.Text>}
            {(Object.entries(monthlyTotals) as [Currency, { income: number; expense: number }][]).map(([currency, t]) => (
              <Flex key={currency} justify="space-between" style={{ marginBottom: 6 }}>
                <b>{currency}</b>
                <span>
                  <span className="amount-income">{formatMoney(t.income, currency)}</span>
                  {' / '}
                  <span className="amount-expense">{formatMoney(t.expense, currency)}</span>
                </span>
              </Flex>
            ))}
          </Card>
          <Card title="Next 30 days" size="small">
            <Table
              size="small"
              rowKey={(r) => `${r.recurring}-${r.due_date}`}
              dataSource={upcoming}
              pagination={false}
              locale={{ emptyText: 'Nothing scheduled' }}
              columns={[
                { title: 'Due', dataIndex: 'due_date', render: (d: string) => formatDate(d, 'D MMM') },
                { title: 'Item', dataIndex: 'name' },
                {
                  title: 'Amount',
                  align: 'right',
                  render: (_, r) => <Amount value={r.amount} currency={r.currency} type={r.type} />,
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title={editing ? 'Edit recurring item' : 'New recurring item'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={create.isPending || update.isPending}
        forceRender
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}>
          <Form.Item name="type">
            <Segmented block options={[{ label: 'Bill / expense', value: 'expense' }, { label: 'Income', value: 'income' }]}
              onChange={() => form.setFieldValue('category', undefined)} />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder={type === 'income' ? 'e.g. Salary' : 'e.g. DEWA, Netflix, Rent'} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="account" label="Account" rules={[{ required: true }]}>
                <Select options={accounts.map((a) => ({ value: a.id, label: `${a.name} · ${a.currency}` }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="Category" rules={[{ required: true }]}>
                <Select showSearch={{ optionFilterProp: 'label' }}
                  options={categories.filter((c) => c.kind === type).map((c) => ({ value: c.id, label: c.name }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="amount" label="Amount" rules={[{ required: true }]}>
                <InputNumber min={0.01} precision={2} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="frequency" label="Repeats">
                <Select options={Object.entries(FREQUENCY_LABELS).map(([value, label]) => ({ value, label }))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="interval" label="Every N periods">
                <InputNumber min={1} max={365} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={editing ? 8 : 12}>
              <Form.Item name="start_date" label="Starts" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={editing ? 8 : 12}>
              <Form.Item name="end_date" label="Ends (optional)">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            {editing && (
              <Col span={8}>
                <Form.Item name="next_due_date" label="Next due">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            )}
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="auto_create" label="Record automatically" valuePropName="checked"
                extra="Off = remind me and I'll mark it paid.">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="remind_days_before" label="Remind days before">
                <InputNumber min={0} max={60} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="payee" label={type === 'income' ? 'Payer' : 'Payee'}>
            <Input />
          </Form.Item>
          {editing && (
            <Form.Item name="is_active" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  )
}
