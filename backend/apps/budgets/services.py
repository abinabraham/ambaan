import calendar
from datetime import date
from decimal import Decimal

from django.db.models import Q, Sum

from apps.transactions.models import Transaction


def month_bounds(month: date) -> tuple[date, date]:
    first = month.replace(day=1)
    last = first.replace(day=calendar.monthrange(first.year, first.month)[1])
    return first, last


def spent_for_budget(budget) -> Decimal:
    """Expenses in the budget's month and currency; category budgets include sub-categories."""
    first, last = month_bounds(budget.month)
    qs = Transaction.objects.filter(
        user_id=budget.user_id,
        type=Transaction.Type.EXPENSE,
        currency=budget.currency,
        transaction_date__range=(first, last),
    )
    if budget.category_id:
        qs = qs.filter(Q(category_id=budget.category_id) | Q(category__parent_id=budget.category_id))
    return qs.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")


def budget_status(budget) -> dict:
    spent = spent_for_budget(budget)
    utilization = (spent / budget.amount * 100).quantize(Decimal("0.1")) if budget.amount else Decimal(0)
    if utilization >= 100:
        state = "exceeded"
    elif utilization >= budget.alert_threshold:
        state = "warning"
    else:
        state = "ok"
    return {
        "spent": spent,
        "remaining": budget.amount - spent,
        "utilization": utilization,
        "status": state,
    }
