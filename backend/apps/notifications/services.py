from django.db.models import Q

from .models import Notification


def notify(user, kind, title, message="", level=Notification.Level.INFO, link="", dedupe_key=""):
    """Create a notification; returns None if one with the same dedupe key already exists."""
    if dedupe_key and Notification.objects.filter(user=user, dedupe_key=dedupe_key).exists():
        return None
    return Notification.objects.create(
        user=user, kind=kind, title=title, message=message, level=level, link=link,
        dedupe_key=dedupe_key,
    )


def check_budget_alerts(user, txn):
    from apps.budgets.models import Budget
    from apps.budgets.services import budget_status
    from apps.transactions.models import Transaction

    if txn.type != Transaction.Type.EXPENSE:
        return

    month = txn.transaction_date.replace(day=1)
    category_filter = Q(category__isnull=True)
    if txn.category_id:
        category_filter |= Q(category_id=txn.category_id)
        if txn.category.parent_id:
            category_filter |= Q(category_id=txn.category.parent_id)

    budgets = Budget.objects.filter(
        category_filter, user=user, month=month, currency=txn.currency
    ).select_related("category")

    for budget in budgets:
        status = budget_status(budget)
        label = budget.category.name if budget.category else "Overall"
        period = f"{budget.month:%B %Y}"
        if status["status"] == "exceeded":
            notify(
                user,
                Notification.Kind.BUDGET_EXCEEDED,
                f"{label} budget exceeded",
                f"You have spent {status['spent']} of {budget.amount} {budget.currency} "
                f"({status['utilization']}%) for {period}.",
                level=Notification.Level.ERROR,
                link="/budgets",
                dedupe_key=f"budget:{budget.pk}:exceeded",
            )
        elif status["status"] == "warning":
            notify(
                user,
                Notification.Kind.BUDGET_WARNING,
                f"{label} budget at {status['utilization']}%",
                f"{status['remaining']} {budget.currency} left of your {period} budget.",
                level=Notification.Level.WARNING,
                link="/budgets",
                dedupe_key=f"budget:{budget.pk}:warning",
            )


def notify_upcoming_recurring(user, item):
    is_income = item.type == "income"
    verb = "expected" if is_income else "due"
    return notify(
        user,
        Notification.Kind.INCOME_REMINDER if is_income else Notification.Kind.BILL_REMINDER,
        f"{item.name} {verb} on {item.next_due_date:%d %b}",
        f"{item.amount} {item.currency} from {item.account.name}."
        + ("" if item.auto_create else " Mark it as paid once settled."),
        level=Notification.Level.INFO,
        link="/recurring",
        dedupe_key=f"recurring:{item.pk}:{item.next_due_date.isoformat()}",
    )


def notify_goal_achieved(user, goal):
    return notify(
        user,
        Notification.Kind.GOAL_ACHIEVED,
        f"Goal reached: {goal.name}",
        f"You saved {goal.target_amount} {goal.currency}. Well done!",
        level=Notification.Level.SUCCESS,
        link="/savings",
        dedupe_key=f"goal:{goal.pk}:achieved",
    )
