from decimal import Decimal

from django.apps import apps
from django.db import models
from django.db.models import DecimalField, OuterRef, Subquery, Sum, Value
from django.db.models.functions import Coalesce

from apps.core.models import MONEY_FIELD_KWARGS, Currency, OwnedModel

ZERO = Value(Decimal("0.00"), output_field=DecimalField(**MONEY_FIELD_KWARGS))


def _sum_subquery(queryset, field):
    total = (
        queryset.order_by()
        .values("user")
        .annotate(total=Sum(field))
        .values("total")
    )
    return Coalesce(Subquery(total, output_field=DecimalField(**MONEY_FIELD_KWARGS)), ZERO)


class FinanceAccountQuerySet(models.QuerySet):
    def with_balances(self):
        Transaction = apps.get_model("transactions", "Transaction")
        own = Transaction.objects.filter(account=OuterRef("pk"))
        income = _sum_subquery(own.filter(type=Transaction.Type.INCOME), "amount")
        expense = _sum_subquery(own.filter(type=Transaction.Type.EXPENSE), "amount")
        transfer_out = _sum_subquery(own.filter(type=Transaction.Type.TRANSFER), "amount")
        transfer_in = _sum_subquery(
            Transaction.objects.filter(to_account=OuterRef("pk"), type=Transaction.Type.TRANSFER),
            "to_amount",
        )
        return self.annotate(
            total_income=income,
            total_expense=expense,
            transfers_out=transfer_out,
            transfers_in=transfer_in,
        ).annotate(
            current_balance=models.F("opening_balance")
            + models.F("total_income")
            - models.F("total_expense")
            - models.F("transfers_out")
            + models.F("transfers_in")
        )


class FinanceAccount(OwnedModel):
    class Type(models.TextChoices):
        BANK = "bank", "Bank account"
        CASH = "cash", "Cash"
        WALLET = "wallet", "Digital wallet"
        CREDIT_CARD = "credit_card", "Credit card"

    name = models.CharField(max_length=100)
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.BANK)
    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.AED)
    opening_balance = models.DecimalField(**MONEY_FIELD_KWARGS, default=Decimal("0.00"))
    institution = models.CharField(max_length=100, blank=True)
    color = models.CharField(max_length=20, blank=True, default="#1677ff")
    is_active = models.BooleanField(default=True)
    include_in_net_worth = models.BooleanField(default=True)

    objects = FinanceAccountQuerySet.as_manager()

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["user", "name"], name="uniq_user_account_name"),
        ]

    def __str__(self):
        return f"{self.name} ({self.currency})"
