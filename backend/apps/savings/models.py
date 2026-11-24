from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from apps.core.models import MONEY_FIELD_KWARGS, Currency, OwnedModel


class SavingsGoal(OwnedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        ACHIEVED = "achieved", "Achieved"
        ARCHIVED = "archived", "Archived"

    name = models.CharField(max_length=100)
    target_amount = models.DecimalField(
        **MONEY_FIELD_KWARGS, validators=[MinValueValidator(Decimal("0.01"))]
    )
    currency = models.CharField(max_length=3, choices=Currency.choices)
    target_date = models.DateField(null=True, blank=True)
    account = models.ForeignKey(
        "finance_accounts.FinanceAccount",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="savings_goals",
        help_text="Optional account where the savings are kept.",
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    color = models.CharField(max_length=20, blank=True, default="#52c41a")
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["status", "target_date", "name"]

    def __str__(self):
        return f"{self.name} ({self.target_amount} {self.currency})"


class SavingsContribution(OwnedModel):
    """Money set aside for (positive) or withdrawn from (negative) a goal, in the goal's currency."""

    goal = models.ForeignKey(SavingsGoal, on_delete=models.CASCADE, related_name="contributions")
    amount = models.DecimalField(**MONEY_FIELD_KWARGS)
    contribution_date = models.DateField()
    note = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-contribution_date", "-created_at"]
        constraints = [
            models.CheckConstraint(condition=~models.Q(amount=0), name="contribution_nonzero"),
        ]

    def __str__(self):
        return f"{self.amount} to {self.goal.name}"
