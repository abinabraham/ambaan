"""Rule-based financial advice built on the calculation engine.

Each rule inspects computed metrics (never raw guesses) and returns zero or more insights. This
layer is deliberately deterministic so an LLM can later be added on top of the same metrics.
"""

from datetime import date
from decimal import Decimal

from django.utils import timezone

from apps.budgets.services import month_bounds
from apps.core.currency import quantize
from apps.finance_accounts.models import FinanceAccount
from apps.recurring.models import RecurringTransaction

from . import services

ZERO = Decimal("0.00")


def _insight(level, title, detail, category):
    return {"level": level, "title": title, "detail": detail, "category": category}


def _fmt(amount, currency):
    return f"{currency} {quantize(amount):,}"


def generate_advice(user, currency: str, today: date | None = None) -> dict:
    today = today or timezone.localdate()
    month = today.replace(day=1)
    last_full_month = services.previous_month(month)
    insights = []

    # Use the last three complete months as the baseline so a partial month doesn't skew it.
    history = services.monthly_series(user, services.shift_months(last_full_month, -2), last_full_month, currency)
    active_history = [m for m in history if m["income"] or m["expenses"]]
    avg_expenses = (
        sum((m["expenses"] for m in active_history), ZERO) / len(active_history) if active_history else ZERO
    )
    avg_net = sum((m["net_cash_flow"] for m in active_history), ZERO) / len(active_history) if active_history else ZERO

    start, end = month_bounds(month)
    current = services.period_summary(user, start, end, currency)
    previous = services.period_summary(user, *month_bounds(last_full_month), currency)

    # 1. Savings rate
    reference = previous if previous["income"] else current
    rate = reference["savings_rate"]
    label = f"{reference['start']:%B}"
    if rate is None:
        if reference["expenses"]:
            insights.append(_insight(
                "warning", "No income recorded",
                f"{label} has {_fmt(reference['expenses'], currency)} of expenses but no income in "
                f"{currency}. Record your income to get an accurate savings rate.", "income"))
    elif rate < 0:
        insights.append(_insight(
            "error", f"You spent more than you earned in {label}",
            f"Expenses exceeded income by {_fmt(-reference['net_cash_flow'], currency)} "
            f"(savings rate {rate}%). Review the largest categories below and pause non-essential spending.",
            "savings"))
    elif rate < 10:
        insights.append(_insight(
            "warning", f"Low savings rate: {rate}%",
            "Aim to save at least 10-20% of income. Automating a transfer to savings on payday helps.",
            "savings"))
    elif rate < 20:
        insights.append(_insight(
            "info", f"Savings rate of {rate}%",
            "You're saving steadily. Pushing toward 20% would accelerate your goals.", "savings"))
    else:
        insights.append(_insight(
            "success", f"Strong savings rate: {rate}%",
            "You're saving over 20% of income. Consider directing the surplus to goals or investments.",
            "savings"))

    # 2. Month-over-month spending growth, with the categories driving it
    if previous["expenses"] and avg_expenses:
        days_elapsed = (today - start).days + 1
        days_in_month = (end - start).days + 1
        projected = current["expenses"] / days_elapsed * days_in_month
        change = services.pct_change(projected, avg_expenses)
        if change is not None and change > 15 and days_elapsed >= 7:
            drivers = [
                c for c in services.category_changes(user, month, currency) if c["change"] > 0
            ][:3]
            driver_text = ", ".join(f"{c['name']} (+{_fmt(c['change'], currency)})" for c in drivers)
            insights.append(_insight(
                "warning", f"Spending is on track to be {change}% above your average",
                f"Projected {_fmt(projected, currency)} this month vs a 3-month average of "
                f"{_fmt(avg_expenses, currency)}." + (f" Biggest increases: {driver_text}." if driver_text else ""),
                "spending"))

    # 3. Budgets
    for budget in services.budget_utilization(user, month, currency):
        if budget["status"] == "exceeded":
            insights.append(_insight(
                "error", f"{budget['name']} budget exceeded",
                f"Spent {_fmt(budget['spent'], currency)} of {_fmt(budget['amount'], currency)} "
                f"({budget['utilization']}%).", "budgets"))
        elif budget["status"] == "warning":
            insights.append(_insight(
                "warning", f"{budget['name']} budget at {budget['utilization']}%",
                f"{_fmt(budget['remaining'], currency)} left for the rest of the month.", "budgets"))

    # 4. Concentration in one category
    reference_start, reference_end = (
        (start, end) if current["expenses"] else month_bounds(last_full_month)
    )
    categories = services.category_breakdown(user, reference_start, reference_end, currency)
    if categories and categories[0]["percentage"] >= 35 and len(categories) > 1:
        top = categories[0]
        insights.append(_insight(
            "info", f"{top['name']} is {top['percentage']}% of your spending",
            "A single category dominating spending is the best place to look for savings.", "spending"))

    # 5. Emergency fund coverage
    balances = next(
        (g for g in services.account_balances(user)["by_currency"] if g["currency"] == currency), None
    )
    if balances and avg_expenses > 0:
        months_covered = (balances["liquid"] / avg_expenses).quantize(Decimal("0.1"))
        if months_covered < 3:
            insights.append(_insight(
                "warning", f"Emergency fund covers {months_covered} months",
                f"Liquid balances of {_fmt(balances['liquid'], currency)} cover under 3 months of average "
                f"expenses. Target 3-6 months ({_fmt(avg_expenses * 3, currency)} - "
                f"{_fmt(avg_expenses * 6, currency)}).", "emergency_fund"))
        elif months_covered >= 6:
            insights.append(_insight(
                "success", f"Emergency fund covers {months_covered} months",
                "You have a healthy cushion. Extra cash could work harder in savings goals or investments.",
                "emergency_fund"))

    # 6. Credit card debt
    for acc in FinanceAccount.objects.filter(
        user=user, type=FinanceAccount.Type.CREDIT_CARD, currency=currency, is_active=True
    ).with_balances():
        if acc.current_balance < 0:
            insights.append(_insight(
                "warning", f"{acc.name} has {_fmt(-acc.current_balance, currency)} outstanding",
                "Pay credit cards in full each month to avoid interest, which usually outweighs savings returns.",
                "debt"))

    # 7. Savings goals behind schedule
    for goal in services.savings_goals_summary(user):
        if goal["currency"] != currency or not goal["target_date"]:
            continue
        remaining = goal["target_amount"] - goal["saved_amount"]
        months_left = max((goal["target_date"].year - today.year) * 12 + goal["target_date"].month - today.month, 1)
        needed = remaining / months_left
        if remaining > 0 and needed > max(avg_net, ZERO):
            insights.append(_insight(
                "warning", f"'{goal['name']}' needs {_fmt(needed, currency)}/month",
                f"Your average monthly surplus is {_fmt(max(avg_net, ZERO), currency)}. Extend the target date "
                f"or increase contributions to stay on track.", "goals"))

    # 8. Subscription / recurring load
    monthly_factor = {
        RecurringTransaction.Frequency.DAILY: Decimal(30),
        RecurringTransaction.Frequency.WEEKLY: Decimal("4.33"),
        RecurringTransaction.Frequency.MONTHLY: Decimal(1),
        RecurringTransaction.Frequency.QUARTERLY: Decimal(1) / 3,
        RecurringTransaction.Frequency.YEARLY: Decimal(1) / 12,
    }
    fixed = sum(
        (item.amount * monthly_factor[item.frequency] / item.interval
         for item in RecurringTransaction.objects.filter(
             user=user, is_active=True, type=RecurringTransaction.Type.EXPENSE, currency=currency)),
        ZERO,
    )
    monthly_income = previous["income"] or current["income"]
    if fixed and monthly_income:
        share = (fixed / monthly_income * 100).quantize(Decimal("0.1"))
        if share > 50:
            insights.append(_insight(
                "warning", f"Fixed commitments use {share}% of income",
                f"Recurring bills total about {_fmt(fixed, currency)}/month. Review subscriptions and "
                "contracts you no longer need.", "recurring"))

    if not insights:
        insights.append(_insight(
            "info", "Not enough data yet",
            "Add a few weeks of income and expenses to receive personalised advice.", "general"))

    order = {"error": 0, "warning": 1, "info": 2, "success": 3}
    insights.sort(key=lambda i: order[i["level"]])
    return {
        "currency": currency,
        "generated_at": timezone.now(),
        "source": "rules",
        "metrics": {
            "average_monthly_expenses": quantize(avg_expenses),
            "average_monthly_net": quantize(avg_net),
            "current_month": current,
        },
        "insights": insights,
    }
