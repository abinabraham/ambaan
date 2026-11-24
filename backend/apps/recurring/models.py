from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.core.models import MONEY_FIELD_KWARGS, Currency, OwnedModel


class RecurringTransaction(OwnedModel):
    class Type(models.TextChoices):
        INCOME = "income", "Income"
        EXPENSE = "expense", "Expense"

    class Frequency(models.TextChoices):
        DAILY = "daily", "Daily"
        WEEKLY = "weekly", "Weekly"
        MONTHLY = "monthly", "Monthly"
        QUARTERLY = "quarterly", "Quarterly"
        YEARLY = "yearly", "Yearly"

    name = models.CharField(max_length=100)
    type = models.CharField(max_length=10, choices=Type.choices)
    account = models.ForeignKey(
        "finance_accounts.FinanceAccount", on_delete=models.PROTECT, related_name="recurring_items"
    )
    category = models.ForeignKey(
        "categories.Category", on_delete=models.PROTECT, related_name="recurring_items"
    )
    amount = models.DecimalField(**MONEY_FIELD_KWARGS, validators=[MinValueValidator(Decimal("0.01"))])
    currency = models.CharField(max_length=3, choices=Currency.choices)
    frequency = models.CharField(max_length=10, choices=Frequency.choices, default=Frequency.MONTHLY)
    interval = models.PositiveSmallIntegerField(
        default=1, validators=[MinValueValidator(1), MaxValueValidator(365)],
        help_text="Repeat every N periods, e.g. 2 with weekly = fortnightly.",
    )
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    next_due_date = models.DateField(db_index=True)
    auto_create = models.BooleanField(
        default=True, help_text="Automatically record the transaction on its due date."
    )
    remind_days_before = models.PositiveSmallIntegerField(default=3, validators=[MaxValueValidator(60)])
    payee = models.CharField(max_length=150, blank=True)
    description = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["next_due_date", "name"]

    def __str__(self):
        return f"{self.name} ({self.frequency})"
