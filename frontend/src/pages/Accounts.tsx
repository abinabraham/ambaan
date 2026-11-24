import {
  BankOutlined,
  CreditCardOutlined,
  DeleteOutlined,
  EditOutlined,
  InboxOutlined,
  PlusOutlined,
  WalletOutlined,
  DollarOutlined,
} from '@ant-design/icons'
import { App, Button, Card, Col, ColorPicker, Dropdown, Empty, Form, Input, InputNumber, Modal, Row, Select, Switch, Tag, Typography } from 'antd'
import { useState, type ReactNode } from 'react'
import { useAccounts, useResource } from '../api/hooks'
import { CURRENCIES, type AccountType, type Currency, type FinanceAccount } from '../api/types'
import { PageHeader } from '../components/common'
import { ACCOUNT_TYPE_LABELS, formatMoney, PRESET_COLORS } from '../utils/format'

const ICONS: Record<AccountType, ReactNode> = {
  bank: <BankOutlined />,
  cash: <DollarOutlined />,
  wallet: <WalletOutlined />,
  credit_card: <CreditCardOutlined />,
}

interface Values {
  name: string
  type: AccountType
  currency: Currency
  opening_balance: number
  institution?: string
  color: string | { toHexString: () => string }
  include_in_net_worth: boolean
}

export default function AccountsPage() {
  const { modal } = App.useApp()
  const { data: accounts = [], isLoading } = useAccounts()
  const { create, update, remove } = useResource<FinanceAccount>('/finance-accounts', 'Account')
  const [form] = Form.useForm<Values>()
  const [editing, setEditing] = useState<FinanceAccount | null>(null)
  const [open, setOpen] = useState(false)

  const totals = CURRENCIES.map((currency) => {
    const list = accounts.filter((a) => a.currency === currency && a.is_active && a.include_in_net_worth)
    return { currency, count: list.length, total: list.reduce((sum, a) => sum + Number(a.current_balance), 0) }
  }).filter((t) => t.count > 0)

  const openForm = (account: FinanceAccount | null) => {
    setEditing(account)
    form.resetFields()
    form.setFieldsValue(
      account
        ? { ...account, opening_balance: Number(account.opening_balance) }
        : { type: 'bank', currency: 'AED', opening_balance: 0, color: PRESET_COLORS[0], include_in_net_worth: true },
    )
    setOpen(true)
  }

  const submit = (values: Values) => {
    const data = {
      ...values,
      opening_balance: (values.opening_balance ?? 0).toFixed(2),
      color: typeof values.color === 'string' ? values.color : values.color.toHexString(),
    }
    const close = { onSuccess: () => setOpen(false) }
    if (editing) update.mutate({ id: editing.id, data }, close)
    else create.mutate(data, close)
  }

  return (
    <>
      <PageHeader
        title="Accounts"
        subtitle="Bank accounts, cash, wallets and credit cards"
        actions={<Button type="primary" icon={<PlusOutlined />} onClick={() => openForm(null)}>Add account</Button>}
      />

      {totals.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          {totals.map((t) => (
            <Col key={t.currency} xs={24} sm={8}>
              <Card size="small">
                <Typography.Text type="secondary">Net balance · {t.currency}</Typography.Text>
                <div className="stat-value" style={{ color: t.total < 0 ? '#dc2626' : undefined }}>
                  {formatMoney(t.total, t.currency)}
                </div>
                <Typography.Text type="secondary">{t.count} account{t.count === 1 ? '' : 's'}</Typography.Text>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {!isLoading && accounts.length === 0 ? (
        <Card><Empty description="No accounts yet. Add your first bank, cash or card account." /></Card>
      ) : (
        <Row gutter={[16, 16]}>
          {accounts.map((a) => (
            <Col key={a.id} xs={24} sm={12} xl={8}>
              <Card
                loading={isLoading}
                style={{ borderTop: `4px solid ${a.color}`, opacity: a.is_active ? 1 : 0.6 }}
                actions={[
                  <EditOutlined key="edit" onClick={() => openForm(a)} />,
                  <Dropdown
                    key="more"
                    menu={{
                      items: [
                        {
                          key: 'archive',
                          icon: <InboxOutlined />,
                          label: a.is_active ? 'Archive' : 'Restore',
                          onClick: () => update.mutate({ id: a.id, data: { is_active: !a.is_active } }),
                        },
                        {
                          key: 'delete',
                          icon: <DeleteOutlined />,
                          danger: true,
                          label: 'Delete',
                          onClick: () =>
                            modal.confirm({
                              title: `Delete ${a.name}?`,
                              content: 'Accounts with transactions cannot be deleted; archive them instead.',
                              okButtonProps: { danger: true },
                              onOk: () => remove.mutateAsync(a.id).catch(() => undefined),
                            }),
                        },
                      ],
                    }}
                  >
                    <span>More</span>
                  </Dropdown>,
                ]}
              >
                <Card.Meta
                  avatar={<span style={{ fontSize: 22, color: a.color }}>{ICONS[a.type]}</span>}
                  title={
                    <span>
                      {a.name} {!a.is_active && <Tag>Archived</Tag>}
                    </span>
                  }
                  description={`${ACCOUNT_TYPE_LABELS[a.type]}${a.institution ? ` · ${a.institution}` : ''}`}
                />
                <div className="stat-value" style={{ marginTop: 16, color: Number(a.current_balance) < 0 ? '#dc2626' : undefined }}>
                  {formatMoney(a.current_balance, a.currency)}
                </div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Opening balance {formatMoney(a.opening_balance, a.currency)}
                </Typography.Text>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        title={editing ? 'Edit account' : 'New account'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={create.isPending || update.isPending}
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Emirates NBD Current" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item name="type" label="Type">
                <Select options={Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="currency" label="Currency" extra={editing ? 'Locked once transactions exist' : undefined}>
                <Select options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="opening_balance"
            label="Opening balance"
            extra="For credit cards, enter any outstanding amount as a negative number."
          >
            <InputNumber precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="institution" label="Bank / provider">
            <Input />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="color" label="Colour">
                <ColorPicker presets={[{ label: 'Presets', colors: PRESET_COLORS }]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="include_in_net_worth" label="Include in net worth" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  )
}
