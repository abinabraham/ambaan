from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.core.models import MONEY_FIELD_KWARGS, Currency, OwnedModel


class Budget(OwnedModel):
    """Spending limit for one month, either overall (no category) or for one expense category."""

    month = models.DateField(help_text="First day of the budgeted month.")
    category = models.ForeignKey(
        "categories.Category",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="budgets",
    )
    amount = models.DecimalField(**MONEY_FIELD_KWARGS, validators=[MinValueValidator(Decimal("0.01"))])
    currency = models.CharField(max_length=3, choices=Currency.choices)
    alert_threshold = models.PositiveSmallIntegerField(
        default=80, validators=[MinValueValidator(1), MaxValueValidator(100)],
        help_text="Percentage of the budget at which to send an alert.",
    )
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-month", "category__name"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "month", "category", "currency"],
                name="uniq_budget_per_category_month",
            ),
            models.UniqueConstraint(
                fields=["user", "month", "currency"],
                condition=models.Q(category__isnull=True),
                name="uniq_overall_budget_per_month",
            ),
        ]

    def __str__(self):
        label = self.category.name if self.category else "Overall"
        return f"{label} {self.month:%Y-%m}: {self.amount} {self.currency}"
