import { Flex, Spin } from 'antd'
import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import AppLayout from './components/AppLayout'
import LoginPage from './pages/Login'
import RegisterPage from './pages/Register'

const DashboardPage = lazy(() => import('./pages/Dashboard'))
const TransactionsPage = lazy(() => import('./pages/Transactions'))
const AccountsPage = lazy(() => import('./pages/Accounts'))
const CategoriesPage = lazy(() => import('./pages/Categories'))
const BudgetsPage = lazy(() => import('./pages/Budgets'))
const SavingsPage = lazy(() => import('./pages/Savings'))
const RecurringPage = lazy(() => import('./pages/Recurring'))
const AnalyticsPage = lazy(() => import('./pages/Analytics'))
const SettingsPage = lazy(() => import('./pages/Settings'))

function FullPageSpinner() {
  return (
    <Flex align="center" justify="center" style={{ minHeight: '60vh' }}>
      <Spin size="large" />
    </Flex>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (!loading && user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<DashboardPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="budgets" element={<BudgetsPage />} />
          <Route path="savings" element={<SavingsPage />} />
          <Route path="recurring" element={<RecurringPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
