import { Alert, Button, Card, Form, Input, Select, Typography } from 'antd'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { errorMessage, fieldErrors } from '../api/client'
import { CURRENCIES, type Currency } from '../api/types'
import { useAuth } from '../auth/AuthContext'

interface Values {
  full_name: string
  email: string
  password: string
  base_currency: Currency
}

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form] = Form.useForm<Values>()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (values: Values) => {
    setLoading(true)
    setError(null)
    try {
      await register(values)
      navigate('/accounts', { replace: true })
    } catch (err) {
      form.setFields(fieldErrors<Values>(err))
      setError(errorMessage(err, 'Unable to create your account'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <Card className="auth-card">
        <img src="/logo-192.png" alt="Ambaan" className="auth-logo" />
        <Typography.Title level={2} style={{ marginBottom: 4 }}>Create your account</Typography.Title>
        <Typography.Paragraph type="secondary">
          Track income, expenses, budgets and savings across AED, INR and USD.
        </Typography.Paragraph>
        {error && <Alert type="error" title={error} showIcon style={{ marginBottom: 16 }} />}
        <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}
          initialValues={{ base_currency: 'AED' }}>
          <Form.Item name="full_name" label="Full name" rules={[{ required: true }]}>
            <Input autoComplete="name" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input autoComplete="email" />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, min: 8 }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="base_currency"
            label="Main currency"
            extra="Used for consolidated totals. You can still keep accounts in other currencies."
          >
            <Select options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={loading}>
            Create account
          </Button>
        </Form>
        <Typography.Paragraph style={{ marginTop: 16, marginBottom: 0, textAlign: 'center' }}>
          Already registered? <Link to="/login">Sign in</Link>
        </Typography.Paragraph>
      </Card>
    </div>
  )
}
