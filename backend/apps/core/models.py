import uuid
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class Currency(models.TextChoices):
    AED = "AED", "UAE Dirham"
    INR = "INR", "Indian Rupee"
    USD = "USD", "US Dollar"


MONEY_FIELD_KWARGS = {"max_digits": 14, "decimal_places": 2}


class UUIDModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class OwnedModel(UUIDModel):
    """Base for every financial record: UUID key, timestamps, and an owning user."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+", db_index=True
    )

    class Meta:
        abstract = True


class ExchangeRate(OwnedModel):
    """User-recorded rate: 1 unit of `base_currency` = `rate` units of `quote_currency`."""

    base_currency = models.CharField(max_length=3, choices=Currency.choices)
    quote_currency = models.CharField(max_length=3, choices=Currency.choices)
    rate = models.DecimalField(
        max_digits=18, decimal_places=8, validators=[MinValueValidator(Decimal("0.00000001"))]
    )
    effective_date = models.DateField()

    class Meta:
        ordering = ["-effective_date", "base_currency", "quote_currency"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "base_currency", "quote_currency", "effective_date"],
                name="uniq_user_rate_per_day",
            ),
            models.CheckConstraint(
                condition=~models.Q(base_currency=models.F("quote_currency")),
                name="rate_currencies_differ",
            ),
        ]

    def __str__(self):
        return f"1 {self.base_currency} = {self.rate} {self.quote_currency} ({self.effective_date})"


class AuditLog(models.Model):
    class Action(models.TextChoices):
        CREATE = "create", "Create"
        UPDATE = "update", "Update"
        DELETE = "delete", "Delete"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="audit_logs"
    )
    action = models.CharField(max_length=10, choices=Action.choices)
    model = models.CharField(max_length=100)
    object_id = models.CharField(max_length=64, db_index=True)
    object_repr = models.CharField(max_length=255, blank=True)
    before = models.JSONField(null=True, blank=True)
    after = models.JSONField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.action} {self.model}:{self.object_id}"
