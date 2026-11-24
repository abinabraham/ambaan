import { InboxOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, App, DatePicker, Form, Input, InputNumber, Modal, Segmented, Select, Upload } from 'antd'
import type { UploadFile } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useMemo, useState } from 'react'
import { api, errorMessage, fieldErrors } from '../api/client'
import { useAccounts, useCategories } from '../api/hooks'
import type { Transaction, TransactionType } from '../api/types'

interface Props {
  open: boolean
  onClose: () => void
  transaction?: Transaction | null
}

interface FormValues {
  type: TransactionType
  account: string
  to_account?: string
  category?: string
  amount: number
  to_amount?: number
  transaction_date: Dayjs
  payee?: string
  description?: string
  notes?: string
}

const FORM_ID = 'transaction-form'

export default function TransactionModal({ open, onClose, transaction }: Props) {
  const [saving, setSaving] = useState(false)
  return (
    <Modal
      title={transaction ? 'Edit transaction' : 'New transaction'}
      open={open}
      onCancel={onClose}
      okText={transaction ? 'Save' : 'Add'}
      okButtonProps={{ htmlType: 'submit', form: FORM_ID }}
      confirmLoading={saving}
      destroyOnHidden
      width={560}
    >
      <TransactionForm transaction={transaction} onDone={onClose} onSavingChange={setSaving} />
    </Modal>
  )
}

/** Mounted fresh on every open, so its form store always starts from `initialValues`. */
function TransactionForm({
  transaction,
  onDone,
  onSavingChange,
}: {
  transaction?: Transaction | null
  onDone: () => void
  onSavingChange: (saving: boolean) => void
}) {
  const [form] = Form.useForm<FormValues>()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [receipt, setReceipt] = useState<UploadFile[]>([])
  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useCategories({ is_archived: false })

  const type = Form.useWatch('type', form) ?? 'expense'
  const accountId = Form.useWatch('account', form)
  const toAccountId = Form.useWatch('to_account', form)

  const activeAccounts = accounts.filter((a) => a.is_active || a.id === transaction?.account)
  const account = accounts.find((a) => a.id === accountId)
  const toAccount = accounts.find((a) => a.id === toAccountId)
  const crossCurrency = type === 'transfer' && account && toAccount && account.currency !== toAccount.currency

  const categoryOptions = useMemo(() => {
    if (type === 'transfer') return []
    const kindCategories = categories.filter((c) => c.kind === type)
    const parents = kindCategories.filter((c) => !c.parent)
    return parents.map((p) => ({
      label: p.name,
      title: p.name,
      options: [p, ...kindCategories.filter((c) => c.parent === p.id)].map((c) => ({
        value: c.id,
        label: (
          <span>
            <span className="color-dot" style={{ background: c.color }} />
            {c.parent ? `${p.name} › ${c.name}` : c.name}
          </span>
        ),
        search: c.name,
      })),
    }))
  }, [categories, type])

  const initialValues: Partial<FormValues> = transaction
    ? {
        type: transaction.type,
        account: transaction.account,
        to_account: transaction.to_account ?? undefined,
        category: transaction.category ?? undefined,
        amount: Number(transaction.amount),
        to_amount: transaction.to_amount ? Number(transaction.to_amount) : undefined,
        transaction_date: dayjs(transaction.transaction_date),
        payee: transaction.payee,
        description: transaction.description,
        notes: transaction.notes,
      }
    : { type: 'expense', transaction_date: dayjs(), account: activeAccounts[0]?.id }

  const submit = async (values: FormValues) => {
    onSavingChange(true)
    const payload = {
      type: values.type,
      account: values.account,
      category: values.type === 'transfer' ? null : values.category,
      to_account: values.type === 'transfer' ? values.to_account : null,
      to_amount: crossCurrency && values.to_amount ? values.to_amount.toFixed(2) : null,
      amount: values.amount.toFixed(2),
      transaction_date: values.transaction_date.format('YYYY-MM-DD'),
      payee: values.payee ?? '',
      description: values.description ?? '',
      notes: values.notes ?? '',
    }
    try {
      const { data } = transaction
        ? await api.patch<Transaction>(`/transactions/${transaction.id}/`, payload)
        : await api.post<Transaction>('/transactions/', payload)
      const file = receipt[0]?.originFileObj
      if (file) {
        const body = new FormData()
        body.append('file', file)
        await api.post(`/transactions/${data.id}/receipt/`, body).catch((err) => {
          message.warning(`Transaction saved, but the receipt upload failed: ${errorMessage(err)}`)
        })
      }
      message.success(transaction ? 'Transaction updated' : 'Transaction added')
      queryClient.invalidateQueries()
      onDone()
    } catch (err) {
      form.setFields(fieldErrors<FormValues>(err))
      message.error(errorMessage(err))
    } finally {
      onSavingChange(false)
    }
  }

  return (
    <>
      {activeAccounts.length === 0 && (
        <Alert type="info" showIcon style={{ marginBottom: 16 }}
          title="Create a finance account (bank, cash, wallet or card) first from the Accounts page." />
      )}
      <Form form={form} name={FORM_ID} layout="vertical" onFinish={submit} requiredMark={false}
        initialValues={initialValues}>
        <Form.Item name="type">
          <Segmented
            block
            options={[
              { label: 'Expense', value: 'expense' },
              { label: 'Income', value: 'income' },
              { label: 'Transfer', value: 'transfer' },
            ]}
            onChange={() => form.setFieldValue('category', undefined)}
          />
        </Form.Item>

        <Form.Item
          name="account"
          label={type === 'transfer' ? 'From account' : 'Account'}
          rules={[{ required: true, message: 'Choose an account' }]}
        >
          <Select
            placeholder="Select account"
            options={activeAccounts.map((a) => ({ value: a.id, label: `${a.name} · ${a.currency}` }))}
          />
        </Form.Item>

        {type === 'transfer' ? (
          <Form.Item name="to_account" label="To account" rules={[{ required: true, message: 'Choose a destination' }]}>
            <Select
              placeholder="Select destination"
              options={activeAccounts
                .filter((a) => a.id !== accountId)
                .map((a) => ({ value: a.id, label: `${a.name} · ${a.currency}` }))}
            />
          </Form.Item>
        ) : (
          <Form.Item name="category" label="Category" rules={[{ required: true, message: 'Choose a category' }]}>
            <Select
              showSearch={{ optionFilterProp: 'search' }}
              placeholder="Select category"
              options={categoryOptions}
            />
          </Form.Item>
        )}

        <Form.Item
          name="amount"
          label={`Amount${account ? ` (${account.currency})` : ''}`}
          rules={[{ required: true, message: 'Enter an amount' }]}
        >
          <InputNumber min={0.01} precision={2} style={{ width: '100%' }} placeholder="0.00" />
        </Form.Item>

        {crossCurrency && (
          <Form.Item
            name="to_amount"
            label={`Amount received (${toAccount!.currency})`}
            extra="The exchange rate is stored from these two amounts."
            rules={[{ required: true, message: 'Enter the amount received' }]}
          >
            <InputNumber min={0.01} precision={2} style={{ width: '100%' }} />
          </Form.Item>
        )}

        <Form.Item name="transaction_date" label="Date" rules={[{ required: true }]}>
          <DatePicker style={{ width: '100%' }} format="D MMM YYYY" />
        </Form.Item>

        {type !== 'transfer' && (
          <Form.Item name="payee" label={type === 'income' ? 'Payer' : 'Payee'}>
            <Input placeholder={type === 'income' ? 'e.g. Employer' : 'e.g. Carrefour'} />
          </Form.Item>
        )}
        <Form.Item name="description" label="Description">
          <Input />
        </Form.Item>
        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item
          label="Receipt"
          extra={transaction?.has_receipt ? 'A receipt is attached. Uploading a new one replaces it.' : undefined}
        >
          <Upload.Dragger
            maxCount={1}
            accept="image/*,application/pdf"
            fileList={receipt}
            beforeUpload={() => false}
            onChange={({ fileList }) => setReceipt(fileList)}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-hint">Drop a receipt image or PDF (max 5 MB)</p>
          </Upload.Dragger>
        </Form.Item>
      </Form>
    </>
  )
}
