export type Currency = 'AED' | 'INR' | 'USD'
export const CURRENCIES: Currency[] = ['AED', 'INR', 'USD']

export type Money = string | number

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface User {
  id: string
  email: string
  full_name: string
  base_currency: Currency
  timezone: string
  date_joined: string
}

export interface AuthResponse {
  user: User
  access: string
  refresh: string
}

export type AccountType = 'bank' | 'cash' | 'wallet' | 'credit_card'

export interface FinanceAccount {
  id: string
  name: string
  type: AccountType
  currency: Currency
  opening_balance: string
  current_balance: string
  institution: string
  color: string
  is_active: boolean
  include_in_net_worth: boolean
}

export type CategoryKind = 'income' | 'expense'

export interface Category {
  id: string
  name: string
  kind: CategoryKind
  parent: string | null
  icon: string
  color: string
  is_archived: boolean
}

export type TransactionType = 'income' | 'expense' | 'transfer'

export interface Transaction {
  id: string
  type: TransactionType
  account: string
  account_name: string
  category: string | null
  category_name: string | null
  category_color: string | null
  amount: string
  currency: Currency
  to_account: string | null
  to_account_name: string | null
  to_amount: string | null
  exchange_rate: string | null
  transaction_date: string
  description: string
  payee: string
  notes: string
  has_receipt: boolean
  recurring: string | null
  created_at: string
}

export type BudgetStatus = 'ok' | 'warning' | 'exceeded'

export interface Budget {
  id: string
  month: string
  category: string | null
  category_name: string | null
  category_color: string | null
  amount: string
  currency: Currency
  alert_threshold: number
  notes: string
  spent: string
  remaining: string
  utilization: number
  status: BudgetStatus
}

export interface SavingsGoal {
  id: string
  name: string
  target_amount: string
  currency: Currency
  target_date: string | null
  account: string | null
  account_name: string | null
  status: 'active' | 'achieved' | 'archived'
  color: string
  notes: string
  saved_amount: string
  remaining_amount: string
  progress: number
  monthly_required: string | null
}

export interface SavingsContribution {
  id: string
  goal: string
  amount: string
  contribution_date: string
  note: string
}

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export interface RecurringItem {
  id: string
  name: string
  type: CategoryKind
  account: string
  account_name: string
  category: string
  category_name: string
  amount: string
  currency: Currency
  frequency: Frequency
  interval: number
  start_date: string
  end_date: string | null
  next_due_date: string
  auto_create: boolean
  remind_days_before: number
  payee: string
  description: string
  is_active: boolean
}

export interface UpcomingItem {
  recurring: string
  name: string
  type: CategoryKind
  amount: string
  currency: Currency
  due_date: string
  auto_create: boolean
}

export interface Notification {
  id: string
  kind: string
  level: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  link: string
  is_read: boolean
  created_at: string
}

export interface ExchangeRate {
  id: string
  base_currency: Currency
  quote_currency: Currency
  rate: string
  effective_date: string
}

export interface PeriodSummary {
  currency: Currency
  start: string
  end: string
  income: number
  expenses: number
  net_cash_flow: number
  savings_rate: number | null
  transaction_count: number
}

export interface CategoryTotal {
  category_id: string | null
  name: string
  color: string
  total: number
  count: number
  percentage: number
}

export interface MonthPoint {
  month: string
  label: string
  income: number
  expenses: number
  net_cash_flow: number
  savings_rate: number | null
}

export interface BudgetUtilization {
  budget_id: string
  name: string
  color: string
  currency: Currency
  amount: number
  spent: number
  remaining: number
  utilization: number
  status: BudgetStatus
}

export interface CurrencyBalance {
  currency: Currency
  assets: number
  liabilities: number
  liquid: number
  net_worth: number
}

export interface Dashboard {
  currency: Currency
  base_currency: Currency
  currencies: Currency[]
  month: string
  summary: PeriodSummary
  previous_summary: PeriodSummary
  comparison: { income_change_pct: number | null; expense_change_pct: number | null; net_change: number }
  consolidated: {
    currency: Currency
    income: number
    expenses: number
    net_cash_flow: number
    savings_rate: number | null
    missing_rates: Currency[]
    complete: boolean
  }
  balances: {
    accounts: { id: string; name: string; type: AccountType; currency: Currency; balance: number; color: string }[]
    by_currency: CurrencyBalance[]
  }
  net_worth_converted: {
    currency: Currency
    assets: number
    liabilities: number
    net_worth: number
    missing_rates: Currency[]
    complete: boolean
  }
  trend: MonthPoint[]
  expense_categories: CategoryTotal[]
  budgets: BudgetUtilization[]
  savings_goals: {
    id: string
    name: string
    currency: Currency
    target_amount: number
    saved_amount: number
    target_date: string | null
    progress: number
    color: string
  }[]
  upcoming: UpcomingItem[]
  recent_transactions: Transaction[]
}

export interface CategoryChange {
  category_id: string | null
  name: string
  current: number
  previous: number
  change: number
  change_pct: number | null
}

export interface MonthlyReport {
  currency: Currency
  month: string
  summary: PeriodSummary
  previous_month: string
  previous_summary: PeriodSummary
  comparison: {
    income_change: number
    income_change_pct: number | null
    expense_change: number
    expense_change_pct: number | null
    net_change: number
  }
  expense_categories: CategoryTotal[]
  income_categories: CategoryTotal[]
  category_changes: CategoryChange[]
  budgets: BudgetUtilization[]
  daily_spending: { date: string; total: number; cumulative: number }[]
  top_expenses: { id: string; date: string; description: string; category: string | null; amount: number }[]
}

export interface YearlyReport {
  currency: Currency
  year: number
  summary: PeriodSummary
  previous_summary: PeriodSummary
  comparison: { income_change_pct: number | null; expense_change_pct: number | null }
  monthly: MonthPoint[]
  average_monthly_income: number
  average_monthly_expenses: number
  highest_spending_month: string | null
  best_savings_month: string | null
  expense_categories: CategoryTotal[]
  income_categories: CategoryTotal[]
}

export interface Insight {
  level: 'error' | 'warning' | 'info' | 'success'
  title: string
  detail: string
  category: string
}

export interface AdviceResponse {
  currency: Currency
  generated_at: string
  source: string
  metrics: { average_monthly_expenses: number; average_monthly_net: number; current_month: PeriodSummary }
  insights: Insight[]
}
