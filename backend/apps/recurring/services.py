import calendar
from datetime import date, timedelta

from django.db import transaction
from django.utils import timezone

from apps.core import audit
from apps.core.models import AuditLog
from apps.notifications.services import check_budget_alerts, notify_upcoming_recurring
from apps.transactions.models import Transaction

from .models import RecurringTransaction

MAX_CATCH_UP = 366


def add_months(d: date, months: int, anchor_day: int) -> date:
    month_index = d.month - 1 + months
    year = d.year + month_index // 12
    month = month_index % 12 + 1
    return date(year, month, min(anchor_day, calendar.monthrange(year, month)[1]))


def next_occurrence(item: RecurringTransaction, current: date) -> date:
    step = item.interval
    match item.frequency:
        case RecurringTransaction.Frequency.DAILY:
            return current + timedelta(days=step)
        case RecurringTransaction.Frequency.WEEKLY:
            return current + timedelta(weeks=step)
        case RecurringTransaction.Frequency.MONTHLY:
            return add_months(current, step, item.start_date.day)
        case RecurringTransaction.Frequency.QUARTERLY:
            return add_months(current, 3 * step, item.start_date.day)
        case RecurringTransaction.Frequency.YEARLY:
            return add_months(current, 12 * step, item.start_date.day)
    raise ValueError(f"Unknown frequency {item.frequency}")


def occurrences(item: RecurringTransaction, until: date, limit: int = 100) -> list[date]:
    dates, current = [], item.next_due_date
    while current <= until and len(dates) < limit:
        if item.end_date and current > item.end_date:
            break
        dates.append(current)
        current = next_occurrence(item, current)
    return dates


def _advance(item: RecurringTransaction):
    item.next_due_date = next_occurrence(item, item.next_due_date)
    if item.end_date and item.next_due_date > item.end_date:
        item.is_active = False
    item.save(update_fields=["next_due_date", "is_active", "updated_at"])


@transaction.atomic
def post_occurrence(item: RecurringTransaction, on_date: date | None = None) -> Transaction:
    """Record the currently due occurrence as a real transaction and move to the next one."""
    txn = Transaction.objects.create(
        user_id=item.user_id,
        type=item.type,
        account=item.account,
        category=item.category,
        amount=item.amount,
        currency=item.account.currency,
        transaction_date=on_date or item.next_due_date,
        description=item.description or item.name,
        payee=item.payee,
        recurring=item,
    )
    audit.record(item.user, AuditLog.Action.CREATE, txn, after=audit.snapshot(txn))
    _advance(item)
    check_budget_alerts(item.user, txn)
    return txn


@transaction.atomic
def skip_occurrence(item: RecurringTransaction):
    _advance(item)


def process_due(user=None, today: date | None = None) -> dict:
    """Create due auto-recorded transactions and send reminders for upcoming items."""
    today = today or timezone.localdate()
    items = RecurringTransaction.objects.filter(is_active=True).select_related(
        "account", "category", "user"
    )
    if user is not None:
        items = items.filter(user=user)

    created = reminded = 0
    for item in items:
        if item.auto_create:
            for _ in range(MAX_CATCH_UP):
                if not item.is_active or item.next_due_date > today:
                    break
                post_occurrence(item)
                created += 1
        if item.is_active and item.next_due_date - timedelta(days=item.remind_days_before) <= today:
            if notify_upcoming_recurring(item.user, item):
                reminded += 1
    return {"created": created, "reminders": reminded}
