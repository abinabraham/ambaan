import {
  AimOutlined,
  AppstoreOutlined,
  BankOutlined,
  BarChartOutlined,
  DashboardOutlined,
  LogoutOutlined,
  MenuOutlined,
  PieChartOutlined,
  PlusOutlined,
  RetweetOutlined,
  SettingOutlined,
  SwapOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Button, Dropdown, Flex, Grid, Layout, Menu, Skeleton, Typography } from 'antd'
import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import NotificationBell from './NotificationBell'
import TransactionModal from './TransactionModal'

const { Sider, Header, Content } = Layout

const NAV = [
  { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/transactions', icon: <SwapOutlined />, label: 'Transactions' },
  { key: '/accounts', icon: <BankOutlined />, label: 'Accounts' },
  { key: '/budgets', icon: <PieChartOutlined />, label: 'Budgets' },
  { key: '/savings', icon: <AimOutlined />, label: 'Savings goals' },
  { key: '/recurring', icon: <RetweetOutlined />, label: 'Recurring' },
  { key: '/analytics', icon: <BarChartOutlined />, label: 'Analytics' },
  { key: '/categories', icon: <AppstoreOutlined />, label: 'Categories' },
  { key: '/settings', icon: <SettingOutlined />, label: 'Settings' },
]

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const screens = Grid.useBreakpoint()
  const [collapsed, setCollapsed] = useState(true)
  const [quickAdd, setQuickAdd] = useState(false)
  const isMobile = !screens.lg

  useEffect(() => {
    // Records any recurring items that fell due since the last visit.
    api.post('/recurring/process/').catch(() => undefined)
  }, [])

  const selected = NAV.find((item) => item.key !== '/' && location.pathname.startsWith(item.key))?.key ?? '/'

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        theme="light"
        breakpoint="lg"
        collapsedWidth={isMobile ? 0 : 80}
        collapsed={isMobile ? collapsed : false}
        onBreakpoint={(broken) => setCollapsed(broken)}
        trigger={null}
        width={232}
        style={{ borderRight: '1px solid #eef0f2', position: isMobile ? 'fixed' : 'sticky', top: 0, height: '100vh', zIndex: 20 }}
      >
        <Flex align="center" gap={10} style={{ height: 64, padding: '0 24px' }}>
          <img src="/logo-192.png" alt="" width={36} height={36} style={{ borderRadius: 8 }} />
          <Typography.Title level={4} style={{ margin: 0 }}>Ambaan</Typography.Title>
        </Flex>
        <Menu
          mode="inline"
          selectedKeys={[selected]}
          items={NAV}
          style={{ borderInlineEnd: 'none' }}
          onClick={({ key }) => {
            navigate(key)
            if (isMobile) setCollapsed(true)
          }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff', padding: '0 20px', borderBottom: '1px solid #eef0f2',
            position: 'sticky', top: 0, zIndex: 10,
          }}
        >
          <Flex align="center" justify="space-between" style={{ height: '100%' }}>
            {isMobile ? (
              <Button type="text" icon={<MenuOutlined />} aria-label="Toggle menu" onClick={() => setCollapsed((c) => !c)} />
            ) : (
              <div />
            )}
            <Flex align="center" gap={12}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setQuickAdd(true)}>
                {isMobile ? null : 'Add transaction'}
              </Button>
              <NotificationBell />
              <Dropdown
                menu={{
                  items: [
                    { key: 'email', label: user?.email, disabled: true },
                    { type: 'divider' },
                    { key: 'settings', icon: <SettingOutlined />, label: 'Settings', onClick: () => navigate('/settings') },
                    { key: 'logout', icon: <LogoutOutlined />, label: 'Sign out', onClick: () => logout() },
                  ],
                }}
              >
                <Avatar style={{ background: '#0f766e', cursor: 'pointer' }} icon={<UserOutlined />}>
                  {user?.full_name?.[0]?.toUpperCase()}
                </Avatar>
              </Dropdown>
            </Flex>
          </Flex>
        </Header>
        <Content style={{ padding: isMobile ? 16 : 28, maxWidth: 1400, width: '100%', margin: '0 auto' }}>
          <Suspense fallback={<Skeleton active paragraph={{ rows: 10 }} />}>
            <Outlet />
          </Suspense>
        </Content>
      </Layout>
      <TransactionModal open={quickAdd} onClose={() => setQuickAdd(false)} />
    </Layout>
  )
}
