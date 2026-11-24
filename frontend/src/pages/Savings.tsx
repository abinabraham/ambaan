import { DeleteOutlined, EditOutlined, PlusOutlined, TrophyOutlined } from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Col,
  ColorPicker,
  DatePicker,
  Drawer,
  Dropdown,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Segmented,
  Select,
  Tag,
  Typography,
} from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useState } from 'react'
import { api } from '../api/client'
import { useAccounts, useApiMutation, useApiQuery, useResource, useSavingsGoals } from '../api/hooks'
import { CURRENCIES, type Currency, type SavingsContribution, type SavingsGoal } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { PageHeader } from '../components/common'
import { formatDate, formatMoney, PRESET_COLORS } from '../utils/format'

interface GoalValues {
  name: string
  target_amount: number
  currency: Currency
  target_date?: Dayjs | null
  account?: string | null
  color: string | { toHexString: () => string }
  notes?: string
}

interface ContributionValues {
  direction: 'add' | 'withdraw'
  amount: number
  contribution_date: Dayjs
  note?: string
}

function ContributionsDrawer({ goal, onClose }: { goal: SavingsGoal | null; onClose: () => void }) {
  const [form] = Form.useForm<ContributionValues>()
  const { data: contributions = [] } = useApiQuery<SavingsContribution[]>(
    `/savings/${goal?.id}/contributions/`, undefined, { enabled: Boolean(goal) },
  )
  const add = useApiMutation(
    (data: object) => api.post(`/savings/${goal!.id}/contributions/`, data),
    'Contribution recorded',
  )
  const remove = useApiMutation(
    (id: string) => api.delete(`/savings/${goal!.id}/contributions/${id}/`),
    'Contribution removed',
  )

  const submit = (values: ContributionValues) => {
    const amount = values.direction === 'withdraw' ? -values.amount : values.amount
    add.mutate(
      { amount: amount.toFixed(2), contribution_date: values.contribution_date.format('YYYY-MM-DD'), note: values.note ?? '' },
      { onSuccess: () => form.resetFields(['amount', 'note']) },
    )
  }

  return (
    <Drawer open={Boolean(goal)} onClose={onClose} title={goal?.name} size="large">
      {goal && (
        <>
          <Progress percent={goal.progress} strokeColor={goal.color} />
          <Typography.Paragraph>
            {formatMoney(goal.saved_amount, goal.currency)} saved of {formatMoney(goal.target_amount, goal.currency)}
          </Typography.Paragraph>
          <Card size="small" title="Record a contribution" style={{ marginBottom: 16 }}>
            <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}
              initialValues={{ direction: 'add', contribution_date: dayjs() }}>
              <Form.Item name="direction">
                <Segmented options={[{ label: 'Add money', value: 'add' }, { label: 'Withdraw', value: 'withdraw' }]} />
              </Form.Item>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="amount" label={`Amount (${goal.currency})`} rules={[{ required: true }]}>
                    <InputNumber min={0.01} precision={2} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="contribution_date" label="Date" rules={[{ required: true }]}>
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="note" label="Note">
                <Input />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={add.isPending}>Save</Button>
            </Form>
          </Card>
          <List
            header={<b>History</b>}
            dataSource={contributions}
            locale={{ emptyText: 'No contributions yet' }}
            renderItem={(c) => (
              <List.Item
                actions={[
                  <Popconfirm key="del" title="Remove this contribution?" onConfirm={() => remove.mutate(c.id)}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta title={formatDate(c.contribution_date)} description={c.note} />
                <span className={Number(c.amount) >= 0 ? 'amount-income' : 'amount-expense'}>
                  {formatMoney(c.amount, goal.currency)}
                </span>
              </List.Item>
            )}
          />
        </>
      )}
    </Drawer>
  )
}

export default function SavingsPage() {
  const { user } = useAuth()
  const { modal } = App.useApp()
  const [status, setStatus] = useState<string>('active')
  const { data: goals = [], isLoading } = useSavingsGoals({ status })
  const { data: accounts = [] } = useAccounts({ is_active: true })
  const { create, update, remove } = useResource<SavingsGoal>('/savings', 'Savings goal')
  const [form] = Form.useForm<GoalValues>()
  const [editing, setEditing] = useState<SavingsGoal | null>(null)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<SavingsGoal | null>(null)
  const formCurrency = Form.useWatch('currency', form)

  const openForm = (goal: SavingsGoal | null) => {
    setEditing(goal)
    form.resetFields()
    form.setFieldsValue(
      goal
        ? { ...goal, target_amount: Number(goal.target_amount), target_date: goal.target_date ? dayjs(goal.target_date) : null }
        : { currency: user!.base_currency, color: PRESET_COLORS[1] },
    )
    setOpen(true)
  }

  const submit = (values: GoalValues) => {
    const data = {
      ...values,
      target_amount: values.target_amount.toFixed(2),
      target_date: values.target_date ? values.target_date.format('YYYY-MM-DD') : null,
      account: values.account ?? null,
      color: typeof values.color === 'string' ? values.color : values.color.toHexString(),
    }
    const close = { onSuccess: () => setOpen(false) }
    if (editing) update.mutate({ id: editing.id, data }, close)
    else create.mutate(data, close)
  }

  const current = selected ? goals.find((g) => g.id === selected.id) ?? selected : null

  return (
    <>
      <PageHeader
        title="Savings goals"
        subtitle="Set targets and track progress toward them"
        actions={
          <>
            <Segmented value={status} onChange={(v) => setStatus(v as string)}
              options={[{ label: 'Active', value: 'active' }, { label: 'Achieved', value: 'achieved' }, { label: 'Archived', value: 'archived' }]} />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm(null)}>New goal</Button>
          </>
        }
      />

      {!isLoading && goals.length === 0 ? (
        <Card><Empty description="No goals here yet" /></Card>
      ) : (
        <Row gutter={[16, 16]}>
          {goals.map((g) => (
            <Col key={g.id} xs={24} md={12} xl={8}>
              <Card
                hoverable
                loading={isLoading}
                onClick={() => setSelected(g)}
                style={{ borderTop: `4px solid ${g.color}` }}
              >
                <Flex justify="space-between" align="start">
                  <Typography.Title level={5} style={{ margin: 0 }}>
                    {g.status === 'achieved' && <TrophyOutlined style={{ color: '#faad14', marginRight: 6 }} />}
                    {g.name}
                  </Typography.Title>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Dropdown
                      menu={{
                        items: [
                          { key: 'edit', icon: <EditOutlined />, label: 'Edit', onClick: () => openForm(g) },
                          {
                            key: 'archive',
                            label: g.status === 'archived' ? 'Restore' : 'Archive',
                            onClick: () => update.mutate({ id: g.id, data: { status: g.status === 'archived' ? 'active' : 'archived' } }),
                          },
                          {
                            key: 'delete',
                            icon: <DeleteOutlined />,
                            danger: true,
                            label: 'Delete',
                            onClick: () => modal.confirm({
                              title: `Delete ${g.name}?`,
                              content: 'All contributions to this goal will be removed.',
                              okButtonProps: { danger: true },
                              onOk: () => remove.mutateAsync(g.id).catch(() => undefined),
                            }),
                          },
                        ],
                      }}
                    >
                      <Button type="text" size="small">•••</Button>
                    </Dropdown>
                  </div>
                </Flex>
                <Progress percent={g.progress} strokeColor={g.color} style={{ marginTop: 12 }} />
                <Typography.Paragraph style={{ marginBottom: 4 }}>
                  <b>{formatMoney(g.saved_amount, g.currency)}</b>{' '}
                  <Typography.Text type="secondary">of {formatMoney(g.target_amount, g.currency)}</Typography.Text>
                </Typography.Paragraph>
                <Flex wrap gap={6}>
                  {g.target_date && <Tag>By {formatDate(g.target_date, 'MMM YYYY')}</Tag>}
                  {g.monthly_required && <Tag color="blue">{formatMoney(g.monthly_required, g.currency)}/month needed</Tag>}
                  {g.account_name && <Tag>{g.account_name}</Tag>}
                </Flex>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <ContributionsDrawer goal={current} onClose={() => setSelected(null)} />

      <Modal
        title={editing ? 'Edit goal' : 'New savings goal'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={create.isPending || update.isPending}
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}>
          <Form.Item name="name" label="Goal name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Emergency fund, Trip to Kerala" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={16}>
              <Form.Item name="target_amount" label="Target amount" rules={[{ required: true }]}>
                <InputNumber min={0.01} precision={2} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="currency" label="Currency">
                <Select options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                  onChange={() => form.setFieldValue('account', null)} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="target_date" label="Target date">
            <DatePicker style={{ width: '100%' }} disabledDate={(d) => d.isBefore(dayjs(), 'day')} />
          </Form.Item>
          <Form.Item name="account" label="Kept in account (optional)">
            <Select
              allowClear
              options={accounts
                .filter((a) => a.currency === formCurrency)
                .map((a) => ({ value: a.id, label: a.name }))}
            />
          </Form.Item>
          <Form.Item name="color" label="Colour">
            <ColorPicker presets={[{ label: 'Presets', colors: PRESET_COLORS }]} />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
