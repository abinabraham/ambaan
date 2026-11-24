"""Financial calculation engine.

Every figure is computed inside a single currency. Cross-currency totals are only produced by
converting with exchange rates the user stored explicitly; when a rate is missing the result is
flagged as incomplete rather than guessed. Transfers are never counted as income or expense.
"""

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from apps.budgets.models import Budget
from apps.budgets.services import budget_status, month_bounds
from apps.core.currency import RateBook, quantize
from apps.finance_accounts.models import FinanceAccount
from apps.recurring.models import RecurringTransaction
from apps.recurring.services import occurrences
from apps.savings.models import SavingsGoal
from apps.transactions.models import Transaction

ZERO = Decimal("0.00")
INCOME = Transaction.Type.INCOME
EXPENSE = Transaction.Type.EXPENSE
LIQUID_ACCOUNT_TYPES = [
    FinanceAccount.Type.BANK,
    FinanceAccount.Type.CASH,
    FinanceAccount.Type.WALLET,
]


# --------------------------------------------------------------------------- date helpers

def previous_month(month: date) -> date:
    return (month.replace(day=1) - timedelta(days=1)).replace(day=1)


def shift_months(month: date, delta: int) -> date:
    index = month.year * 12 + month.month - 1 + delta
    return date(index // 12, index % 12 + 1, 1)


def pct_change(current: Decimal, previous: Decimal) -> float | None:
    if not previous:
        return None
    return float(((current - previous) / previous * 100).quantize(Decimal("0.1")))


def savings_rate(income: Decimal, expenses: Decimal) -> float | None:
    if income <= 0:
        return None
    return float(((income - expenses) / income * 100).quantize(Decimal("0.1")))


# --------------------------------------------------------------------------- core calculations

def _txns(user, start: date, end: date, currency: str):
    return Transaction.objects.filter(
        user=user, currency=currency, transaction_date__range=(start, end)
    )


def period_summary(user, start: date, end: date, currency: str) -> dict:
    rows = (
        _txns(user, start, end, currency)
        .filter(type__in=[INCOME, EXPENSE])
        .values("type")
        .annotate(total=Sum("amount"), count=Count("id"))
    )
    totals = {row["type"]: row for row in rows}
    income = totals.get(INCOME, {}).get("total") or ZERO
    expenses = totals.get(EXPENSE, {}).get("total") or ZERO
    return {
        "currency": currency,
        "start": start,
        "end": end,
        "income": income,
        "expenses": expenses,
        "net_cash_flow": income - expenses,
        "savings_rate": savings_rate(income, expenses),
        "transaction_count": sum(row["count"] for row in totals.values()),
    }


def category_breakdown(user, start: date, end: date, currency: str, kind: str = EXPENSE) -> list[dict]:
    rows = (
        _txns(user, start, end, currency)
        .filter(type=kind)
        .values("category_id", "category__name", "category__color")
        .annotate(total=Sum("amount"), count=Count("id"))
        .order_by("-total")
    )
    grand_total = sum((row["total"] for row in rows), ZERO)
    return [
        {
            "category_id": row["category_id"],
            "name": row["category__name"] or "Uncategorised",
            "color": row["category__color"] or "#8c8c8c",
            "total": row["total"],
            "count": row["count"],
            "percentage": float((row["total"] / grand_total * 100).quantize(Decimal("0.1")))
            if grand_total
            else 0.0,
        }
        for row in rows
    ]


def monthly_series(user, first_month: date, last_month: date, currency: str) -> list[dict]:
    _, end = month_bounds(last_month)
    rows = (
        _txns(user, first_month.replace(day=1), end, currency)
        .filter(type__in=[INCOME, EXPENSE])
        .annotate(month=TruncMonth("transaction_date"))
        .values("month", "type")
        .annotate(total=Sum("amount"))
    )
    by_month: dict[date, dict] = defaultdict(lambda: {INCOME: ZERO, EXPENSE: ZERO})
    for row in rows:
        month = row["month"]
        if hasattr(month, "date"):
            month = month.date()
        by_month[month][row["type"]] = row["total"]

    series, month = [], first_month.replace(day=1)
    while month <= last_month:
        income, expenses = by_month[month][INCOME], by_month[month][EXPENSE]
        series.append({
            "month": month,
            "label": f"{month:%b %Y}",
            "income": income,
            "expenses": expenses,
            "net_cash_flow": income - expenses,
            "savings_rate": savings_rate(income, expenses),
        })
        month = shift_months(month, 1)
    return series


def daily_spending(user, start: date, end: date, currency: str) -> list[dict]:
    rows = (
        _txns(user, start, end, currency)
        .filter(type=EXPENSE)
        .values("transaction_date")
        .annotate(total=Sum("amount"))
    )
    totals = {row["transaction_date"]: row["total"] for row in rows}
    days, day, cumulative = [], start, ZERO
    while day <= end:
        cumulative += totals.get(day, ZERO)
        days.append({"date": day, "total": totals.get(day, ZERO), "cumulative": cumulative})
        day += timedelta(days=1)
    return days


def category_changes(user, month: date, currency: str) -> list[dict]:
    """Expense change per category versus the previous month, largest increase first."""
    cur_start, cur_end = month_bounds(month)
    prev_start, prev_end = month_bounds(previous_month(month))
    current = {c["category_id"]: c for c in category_breakdown(user, cur_start, cur_end, currency)}
    previous = {c["category_id"]: c for c in category_breakdown(user, prev_start, prev_end, currency)}
    changes = []
    for cid in current.keys() | previous.keys():
        cur = current.get(cid, {}).get("total", ZERO)
        prev = previous.get(cid, {}).get("total", ZERO)
        meta = current.get(cid) or previous.get(cid)
        changes.append({
            "category_id": cid,
            "name": meta["name"],
            "current": cur,
            "previous": prev,
            "change": cur - prev,
            "change_pct": pct_change(cur, prev),
        })
    return sorted(changes, key=lambda c: c["change"], reverse=True)


def budget_utilization(user, month: date, currency: str | None = None) -> list[dict]:
    budgets = Budget.objects.filter(user=user, month=month.replace(day=1)).select_related("category")
    if currency:
        budgets = budgets.filter(currency=currency)
    result = []
    for budget in budgets:
        status = budget_status(budget)
        result.append({
            "budget_id": budget.id,
            "name": budget.category.name if budget.category else "Overall",
            "color": budget.category.color if budget.category else "#1677ff",
            "currency": budget.currency,
            "amount": budget.amount,
            **status,
        })
    return sorted(result, key=lambda b: b["utilization"], reverse=True)


def account_balances(user) -> dict:
    """Balances grouped per currency. Never sums across currencies."""
    accounts = FinanceAccount.objects.filter(user=user, is_active=True).with_balances()
    by_currency: dict[str, dict] = {}
    items = []
    for acc in accounts:
        items.append({
            "id": acc.id,
            "name": acc.name,
            "type": acc.type,
            "currency": acc.currency,
            "balance": acc.current_balance,
            "color": acc.color,
        })
        if not acc.include_in_net_worth:
            continue
        group = by_currency.setdefault(
            acc.currency, {"currency": acc.currency, "assets": ZERO, "liabilities": ZERO, "liquid": ZERO}
        )
        if acc.current_balance >= 0:
            group["assets"] += acc.current_balance
        else:
            group["liabilities"] += -acc.current_balance
        if acc.type in LIQUID_ACCOUNT_TYPES:
            group["liquid"] += acc.current_balance
    for group in by_currency.values():
        group["net_worth"] = group["assets"] - group["liabilities"]
    return {"accounts": items, "by_currency": sorted(by_currency.values(), key=lambda g: g["currency"])}


def convert_totals(user, per_currency: list[dict], fields: list[str], target: str, on_date: date) -> dict:
    """Convert per-currency figures into `target` using stored rates; reports missing rates."""
    rates = RateBook(user)
    converted = {field: ZERO for field in fields}
    missing = []
    for row in per_currency:
        rate = rates.rate(row["currency"], target, on_date)
        if rate is None:
            missing.append(row["currency"])
            continue
        for field in fields:
            converted[field] += quantize(row[field] * rate)
    return {"currency": target, **converted, "missing_rates": missing, "complete": not missing}


def consolidated_summary(user, start: date, end: date, target: str) -> dict:
    """Income and expenses across all currencies, each converted at the rate valid on its date."""
    rows = (
        Transaction.objects.filter(user=user, transaction_date__range=(start, end), type__in=[INCOME, EXPENSE])
        .values("currency", "type", "transaction_date")
        .annotate(total=Sum("amount"))
    )
    rates = RateBook(user)
    totals = {INCOME: ZERO, EXPENSE: ZERO}
    missing = set()
    for row in rows:
        value = rates.convert(row["total"], row["currency"], target, row["transaction_date"])
        if value is None:
            missing.add(row["currency"])
        else:
            totals[row["type"]] += value
    return {
        "currency": target,
        "income": totals[INCOME],
        "expenses": totals[EXPENSE],
        "net_cash_flow": totals[INCOME] - totals[EXPENSE],
        "savings_rate": savings_rate(totals[INCOME], totals[EXPENSE]),
        "missing_rates": sorted(missing),
        "complete": not missing,
    }


def currencies_in_use(user) -> list[str]:
    used = set(FinanceAccount.objects.filter(user=user).values_list("currency", flat=True))
    used |= set(Transaction.objects.filter(user=user).values_list("currency", flat=True).distinct())
    used.add(user.base_currency)
    return sorted(used)


def savings_goals_summary(user) -> list[dict]:
    goals = SavingsGoal.objects.filter(user=user, status=SavingsGoal.Status.ACTIVE).annotate(
        saved=Sum("contributions__amount")
    )
    return [
        {
            "id": goal.id,
            "name": goal.name,
            "currency": goal.currency,
            "target_amount": goal.target_amount,
            "saved_amount": goal.saved or ZERO,
            "target_date": goal.target_date,
            "progress": float(min((goal.saved or ZERO) / goal.target_amount * 100, 100)),
            "color": goal.color,
        }
        for goal in goals
    ]


def upcoming_recurring(user, days: int = 14) -> list[dict]:
    until = timezone.localdate() + timedelta(days=days)
    rows = [
        {
            "recurring": item.id,
            "name": item.name,
            "type": item.type,
            "amount": item.amount,
            "currency": item.currency,
            "due_date": due,
            "auto_create": item.auto_create,
        }
        for item in RecurringTransaction.objects.filter(user=user, is_active=True)
        for due in occurrences(item, until, limit=10)
    ]
    return sorted(rows, key=lambda r: r["due_date"])


# --------------------------------------------------------------------------- reports

def dashboard(user, currency: str, today: date | None = None) -> dict:
    today = today or timezone.localdate()
    month = today.replace(day=1)
    start, end = month_bounds(month)
    prev_start, prev_end = month_bounds(previous_month(month))

    current = period_summary(user, start, end, currency)
    previous = period_summary(user, prev_start, prev_end, currency)
    balances = account_balances(user)
    recent = (
        Transaction.objects.filter(user=user)
        .select_related("account", "category", "to_account")
        .order_by("-transaction_date", "-created_at")[:8]
    )

    return {
        "currency": currency,
        "base_currency": user.base_currency,
        "currencies": currencies_in_use(user),
        "month": month,
        "summary": current,
        "previous_summary": previous,
        "comparison": {
            "income_change_pct": pct_change(current["income"], previous["income"]),
            "expense_change_pct": pct_change(current["expenses"], previous["expenses"]),
            "net_change": current["net_cash_flow"] - previous["net_cash_flow"],
        },
        "consolidated": consolidated_summary(user, start, end, user.base_currency),
        "balances": balances,
        "net_worth_converted": convert_totals(
            user, balances["by_currency"], ["assets", "liabilities", "net_worth"], user.base_currency, today
        ),
        "trend": monthly_series(user, shift_months(month, -5), month, currency),
        "expense_categories": category_breakdown(user, start, end, currency)[:8],
        "budgets": budget_utilization(user, month, currency),
        "savings_goals": savings_goals_summary(user),
        "upcoming": upcoming_recurring(user, days=14),
        "recent_transactions": recent,
    }


def monthly_report(user, year: int, month_number: int, currency: str) -> dict:
    month = date(year, month_number, 1)
    start, end = month_bounds(month)
    prev = previous_month(month)
    prev_start, prev_end = month_bounds(prev)
    current = period_summary(user, start, end, currency)
    previous = period_summary(user, prev_start, prev_end, currency)

    top_expenses = (
        _txns(user, start, end, currency)
        .filter(type=EXPENSE)
        .select_related("category")
        .order_by("-amount")[:5]
    )
    return {
        "currency": currency,
        "month": month,
        "summary": current,
        "previous_month": prev,
        "previous_summary": previous,
        "comparison": {
            "income_change": current["income"] - previous["income"],
            "income_change_pct": pct_change(current["income"], previous["income"]),
            "expense_change": current["expenses"] - previous["expenses"],
            "expense_change_pct": pct_change(current["expenses"], previous["expenses"]),
            "net_change": current["net_cash_flow"] - previous["net_cash_flow"],
        },
        "expense_categories": category_breakdown(user, start, end, currency, EXPENSE),
        "income_categories": category_breakdown(user, start, end, currency, INCOME),
        "category_changes": category_changes(user, month, currency),
        "budgets": budget_utilization(user, month, currency),
        "daily_spending": daily_spending(user, start, min(end, max(timezone.localdate(), start)), currency),
        "top_expenses": [
            {
                "id": t.id,
                "date": t.transaction_date,
                "description": t.description or t.payee or (t.category.name if t.category else ""),
                "category": t.category.name if t.category else None,
                "amount": t.amount,
            }
            for t in top_expenses
        ],
    }


def yearly_report(user, year: int, currency: str) -> dict:
    start, end = date(year, 1, 1), date(year, 12, 31)
    series = monthly_series(user, start, date(year, 12, 1), currency)
    summary = period_summary(user, start, end, currency)
    previous = period_summary(user, date(year - 1, 1, 1), date(year - 1, 12, 31), currency)
    active = [m for m in series if m["income"] or m["expenses"]]
    months_count = len(active) or 1
    return {
        "currency": currency,
        "year": year,
        "summary": summary,
        "previous_summary": previous,
        "comparison": {
            "income_change_pct": pct_change(summary["income"], previous["income"]),
            "expense_change_pct": pct_change(summary["expenses"], previous["expenses"]),
        },
        "monthly": series,
        "average_monthly_income": quantize(summary["income"] / months_count),
        "average_monthly_expenses": quantize(summary["expenses"] / months_count),
        "highest_spending_month": max(active, key=lambda m: m["expenses"])["label"] if active else None,
        "best_savings_month": max(active, key=lambda m: m["net_cash_flow"])["label"] if active else None,
        "expense_categories": category_breakdown(user, start, end, currency, EXPENSE),
        "income_categories": category_breakdown(user, start, end, currency, INCOME),
    }
