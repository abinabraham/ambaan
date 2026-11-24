import os
import uuid
from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from apps.core.models import MONEY_FIELD_KWARGS, Currency, OwnedModel


def receipt_upload_path(instance, filename):
    ext = os.path.splitext(filename)[1].lower()[:10]
    return f"receipts/{instance.user_id}/{instance.id}/{uuid.uuid4().hex}{ext}"


class Transaction(OwnedModel):
    class Type(models.TextChoices):
        INCOME = "income", "Income"
        EXPENSE = "expense", "Expense"
        TRANSFER = "transfer", "Transfer"

    type = models.CharField(max_length=10, choices=Type.choices, db_index=True)
    account = models.ForeignKey(
        "finance_accounts.FinanceAccount", on_delete=models.PROTECT, related_name="transactions"
    )
    category = models.ForeignKey(
        "categories.Category",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="transactions",
    )
    amount = models.DecimalField(
        **MONEY_FIELD_KWARGS, validators=[MinValueValidator(Decimal("0.01"))]
    )
    currency = models.CharField(max_length=3, choices=Currency.choices)

    # Transfers: destination account plus the amount credited in its own currency.
    to_account = models.ForeignKey(
        "finance_accounts.FinanceAccount",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="incoming_transfers",
    )
    to_amount = models.DecimalField(**MONEY_FIELD_KWARGS, null=True, blank=True)
    exchange_rate = models.DecimalField(max_digits=18, decimal_places=8, null=True, blank=True)

    transaction_date = models.DateField(db_index=True)
    description = models.CharField(max_length=255, blank=True)
    payee = models.CharField(max_length=150, blank=True)
    notes = models.TextField(blank=True)
    receipt = models.FileField(upload_to=receipt_upload_path, blank=True, max_length=500)
    recurring = models.ForeignKey(
        "recurring.RecurringTransaction",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generated_transactions",
    )

    class Meta:
        ordering = ["-transaction_date", "-created_at"]
        indexes = [
            models.Index(fields=["user", "transaction_date"]),
            models.Index(fields=["user", "type", "currency", "transaction_date"]),
        ]
        constraints = [
            models.CheckConstraint(condition=models.Q(amount__gt=0), name="txn_amount_positive"),
            models.CheckConstraint(
                condition=(
                    models.Q(type="transfer", to_account__isnull=False, to_amount__isnull=False)
                    | (~models.Q(type="transfer") & models.Q(to_account__isnull=True))
                ),
                name="txn_transfer_fields_consistent",
            ),
        ]

    def __str__(self):
        return f"{self.type} {self.amount} {self.currency} on {self.transaction_date}"
