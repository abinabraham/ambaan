import { DeleteOutlined, DownloadOutlined, EditOutlined, PaperClipOutlined, PlusOutlined } from '@ant-design/icons'
import { App, Button, Card, DatePicker, Flex, Input, Popconfirm, Select, Table, Tag, Tooltip, Typography } from 'antd'
import type { Dayjs } from 'dayjs'
import { useState } from 'react'
import { api, errorMessage } from '../api/client'
import { useAccounts, useCategories, useResource, useTransactions } from '../api/hooks'
import { CURRENCIES, type Transaction } from '../api/types'
import { Amount, ColorDot, PageHeader } from '../components/common'
import TransactionModal from '../components/TransactionModal'
import { formatDate } from '../utils/format'

const TYPE_COLORS = { income: 'green', expense: 'red', transfer: 'default' } as const

export default function TransactionsPage() {
  const { message } = App.useApp()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [type, setType] = useState<string>()
  const [account, setAccount] = useState<string>()
  const [category, setCategory] = useState<string>()
  const [currency, setCurrency] = useState<string>()
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useCategories()
  const { remove } = useResource<Transaction>('/transactions', 'Transaction')

  const filters = {
    search: search || undefined,
    type,
    account,
    category,
    currency,
    date_from: range?.[0]?.format('YYYY-MM-DD'),
    date_to: range?.[1]?.format('YYYY-MM-DD'),
  }
  const { data, isFetching } = useTransactions({ ...filters, page, page_size: pageSize })

  const resetPage = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value)
    setPage(1)
  }

  const openReceipt = async (id: string) => {
    try {
      const { data: receipt } = await api.get<{ url: string }>(`/transactions/${id}/receipt/`)
      window.open(receipt.url, '_blank', 'noopener')
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const exportCsv = async () => {
    try {
      const response = await api.get('/transactions/export/', { params: filters, responseType: 'blob' })
      const url = URL.createObjectURL(response.data as Blob)
      const link = Object.assign(document.createElement('a'), { href: url, download: 'ambaan-transactions.csv' })
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle={data ? `${data.count} records` : undefined}
        actions={
          <>
            <Button icon={<DownloadOutlined />} onClick={exportCsv}>Export CSV</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setModalOpen(true) }}>
              Add transaction
            </Button>
          </>
        }
      />
      <Card>
        <Flex wrap gap={8} style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder="Search description, payee, notes"
            allowClear
            style={{ width: 260 }}
            onSearch={resetPage(setSearch)}
          />
          <Select allowClear placeholder="Type" style={{ width: 120 }} value={type} onChange={resetPage(setType)}
            options={[
              { value: 'income', label: 'Income' },
              { value: 'expense', label: 'Expense' },
              { value: 'transfer', label: 'Transfer' },
            ]} />
          <Select allowClear placeholder="Account" style={{ width: 170 }} value={account} onChange={resetPage(setAccount)}
            options={accounts.map((a) => ({ value: a.id, label: a.name }))} />
          <Select allowClear showSearch={{ optionFilterProp: 'label' }} placeholder="Category" style={{ width: 180 }}
            value={category} onChange={resetPage(setCategory)}
            options={categories.map((c) => ({ value: c.id, label: `${c.name} (${c.kind})` }))} />
          <Select allowClear placeholder="Currency" style={{ width: 110 }} value={currency} onChange={resetPage(setCurrency)}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
          <DatePicker.RangePicker value={range} onChange={resetPage(setRange)} format="D MMM YYYY" />
        </Flex>

        <Table<Transaction>
          rowKey="id"
          loading={isFetching}
          dataSource={data?.results}
          scroll={{ x: 900 }}
          pagination={{
            current: page,
            pageSize,
            total: data?.count,
            showSizeChanger: true,
            onChange: (p, size) => { setPage(p); setPageSize(size) },
          }}
          columns={[
            {
              title: 'Date',
              dataIndex: 'transaction_date',
              width: 120,
              render: (d: string) => formatDate(d),
            },
            {
              title: 'Type',
              dataIndex: 'type',
              width: 100,
              render: (t: Transaction['type']) => <Tag color={TYPE_COLORS[t]}>{t}</Tag>,
            },
            {
              title: 'Description',
              render: (_, t) => (
                <div>
                  <div>
                    {t.description || t.payee || t.category_name || 'Transfer'}{' '}
                    {t.recurring && <Tag style={{ marginLeft: 4 }}>recurring</Tag>}
                  </div>
                  {t.payee && t.description && (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t.payee}</Typography.Text>
                  )}
                </div>
              ),
            },
            {
              title: 'Category',
              render: (_, t) => t.category_name ? <span><ColorDot color={t.category_color} />{t.category_name}</span> : '—',
            },
            {
              title: 'Account',
              render: (_, t) => (t.type === 'transfer' ? `${t.account_name} → ${t.to_account_name}` : t.account_name),
            },
            {
              title: 'Amount',
              align: 'right',
              render: (_, t) => (
                <div>
                  <Amount value={t.amount} currency={t.currency} type={t.type} />
                  {t.type === 'transfer' && t.to_amount && t.to_amount !== t.amount && (
                    <div className="muted" style={{ fontSize: 12 }}>
                      received {Number(t.to_amount).toLocaleString()} @ {Number(t.exchange_rate).toFixed(4)}
                    </div>
                  )}
                </div>
              ),
            },
            {
              title: '',
              width: 130,
              align: 'right',
              fixed: 'right',
              render: (_, t) => (
                <Flex gap={4} justify="end">
                  {t.has_receipt && (
                    <Tooltip title="View receipt">
                      <Button type="text" icon={<PaperClipOutlined />} onClick={() => openReceipt(t.id)} />
                    </Tooltip>
                  )}
                  <Button type="text" icon={<EditOutlined />} onClick={() => { setEditing(t); setModalOpen(true) }} />
                  <Popconfirm title="Delete this transaction?" description="It stays in the audit log."
                    onConfirm={() => remove.mutate(t.id)}>
                    <Button type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Flex>
              ),
            },
          ]}
        />
      </Card>
      <TransactionModal open={modalOpen} transaction={editing} onClose={() => setModalOpen(false)} />
    </>
  )
}
