import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { App, Button, Card, Col, DatePicker, Form, Input, InputNumber, Popconfirm, Row, Select, Table, Typography } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useState } from 'react'
import { api, errorMessage, fieldErrors } from '../api/client'
import { useApiMutation, useExchangeRates, useResource } from '../api/hooks'
import { CURRENCIES, type Currency, type ExchangeRate, type User } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { PageHeader } from '../components/common'
import { formatDate } from '../utils/format'

function ProfileCard() {
  const { user, setUser } = useAuth()
  const update = useApiMutation(
    async (data: Partial<User>) => (await api.patch<User>('/accounts/profile/', data)).data,
    'Profile saved',
  )
  return (
    <Card title="Profile">
      <Form layout="vertical" initialValues={user!} requiredMark={false}
        onFinish={(values) => update.mutate(values, { onSuccess: setUser })}>
        <Form.Item label="Email"><Input value={user!.email} disabled /></Form.Item>
        <Form.Item name="full_name" label="Full name"><Input /></Form.Item>
        <Form.Item name="base_currency" label="Main currency" extra="Consolidated totals are shown in this currency.">
          <Select options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
        </Form.Item>
        <Form.Item name="timezone" label="Time zone"><Input /></Form.Item>
        <Button type="primary" htmlType="submit" loading={update.isPending}>Save</Button>
      </Form>
    </Card>
  )
}

function PasswordCard() {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const submit = async (values: { current_password: string; new_password: string }) => {
    setLoading(true)
    try {
      await api.post('/accounts/password/', values)
      message.success('Password changed')
      form.resetFields()
    } catch (err) {
      form.setFields(fieldErrors(err))
      message.error(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }
  return (
    <Card title="Change password" style={{ marginTop: 16 }}>
      <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}>
        <Form.Item name="current_password" label="Current password" rules={[{ required: true }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item name="new_password" label="New password" rules={[{ required: true, min: 8 }]}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Button htmlType="submit" loading={loading}>Update password</Button>
      </Form>
    </Card>
  )
}

interface RateValues {
  base_currency: Currency
  quote_currency: Currency
  rate: number
  effective_date: Dayjs
}

function ExchangeRatesCard() {
  const { data } = useExchangeRates()
  const { create, remove } = useResource<ExchangeRate>('/exchange-rates', 'Exchange rate')
  const [form] = Form.useForm<RateValues>()

  const submit = (values: RateValues) =>
    create.mutate(
      { ...values, rate: values.rate.toString(), effective_date: values.effective_date.format('YYYY-MM-DD') },
      { onSuccess: () => form.resetFields(['rate']) },
    )

  return (
    <Card title="Exchange rates">
      <Typography.Paragraph type="secondary">
        Ambaan never guesses exchange rates. Record the rates you want used for consolidated totals; each conversion uses
        the latest rate on or before the transaction date. The inverse direction is derived automatically.
      </Typography.Paragraph>
      <Form form={form} layout="inline" onFinish={submit} style={{ marginBottom: 16, rowGap: 8 }}
        initialValues={{ base_currency: 'AED', quote_currency: 'INR', effective_date: dayjs() }}>
        <Form.Item>1</Form.Item>
        <Form.Item name="base_currency"><Select style={{ width: 90 }} options={CURRENCIES.map((c) => ({ value: c, label: c }))} /></Form.Item>
        <Form.Item>=</Form.Item>
        <Form.Item name="rate" rules={[{ required: true, message: 'Rate' }]}>
          <InputNumber min={0.00000001} step={0.01} style={{ width: 120 }} placeholder="rate" />
        </Form.Item>
        <Form.Item name="quote_currency"><Select style={{ width: 90 }} options={CURRENCIES.map((c) => ({ value: c, label: c }))} /></Form.Item>
        <Form.Item name="effective_date" label="from"><DatePicker /></Form.Item>
        <Form.Item><Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={create.isPending}>Add</Button></Form.Item>
      </Form>
      <Table<ExchangeRate>
        size="small"
        rowKey="id"
        dataSource={data?.results}
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        columns={[
          { title: 'Effective', dataIndex: 'effective_date', render: (d: string) => formatDate(d) },
          { title: 'Rate', render: (_, r) => `1 ${r.base_currency} = ${Number(r.rate)} ${r.quote_currency}` },
          {
            title: '',
            align: 'right',
            render: (_, r) => (
              <Popconfirm title="Delete this rate?" onConfirm={() => remove.mutate(r.id)}>
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            ),
          },
        ]}
      />
    </Card>
  )
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <ProfileCard />
          <PasswordCard />
        </Col>
        <Col xs={24} lg={14}>
          <ExchangeRatesCard />
        </Col>
      </Row>
    </>
  )
}
