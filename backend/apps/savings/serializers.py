from datetime import date
from decimal import Decimal

from rest_framework import serializers

from apps.core.currency import quantize
from apps.finance_accounts.models import FinanceAccount
from apps.transactions.serializers import UserScopedPrimaryKeyField

from .models import SavingsContribution, SavingsGoal


class SavingsContributionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavingsContribution
        fields = ["id", "goal", "amount", "contribution_date", "note", "created_at"]
        read_only_fields = ["id", "goal", "created_at"]

    def validate_amount(self, value):
        if value == 0:
            raise serializers.ValidationError("Amount cannot be zero.")
        return value


class SavingsGoalSerializer(serializers.ModelSerializer):
    account = UserScopedPrimaryKeyField(
        queryset=FinanceAccount.objects.all(), required=False, allow_null=True
    )
    account_name = serializers.CharField(source="account.name", read_only=True, default=None)
    saved_amount = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    remaining_amount = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()
    monthly_required = serializers.SerializerMethodField()

    class Meta:
        model = SavingsGoal
        fields = [
            "id",
            "name",
            "target_amount",
            "currency",
            "target_date",
            "account",
            "account_name",
            "status",
            "color",
            "notes",
            "saved_amount",
            "remaining_amount",
            "progress",
            "monthly_required",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def _saved(self, obj) -> Decimal:
        return getattr(obj, "saved_amount", None) or Decimal("0.00")

    def get_remaining_amount(self, obj) -> str:
        return str(max(obj.target_amount - self._saved(obj), Decimal("0.00")))

    def get_progress(self, obj) -> float:
        return float(min(self._saved(obj) / obj.target_amount * 100, Decimal(100)).quantize(Decimal("0.1")))

    def get_monthly_required(self, obj) -> str | None:
        """Amount to save each month from now to reach the target on time."""
        remaining = obj.target_amount - self._saved(obj)
        if not obj.target_date or remaining <= 0:
            return None
        today = date.today()
        months = (obj.target_date.year - today.year) * 12 + obj.target_date.month - today.month
        return str(quantize(remaining / max(months, 1)))

    def validate(self, attrs):
        account = attrs.get("account", getattr(self.instance, "account", None))
        currency = attrs.get("currency", getattr(self.instance, "currency", None))
        if account and account.currency != currency:
            raise serializers.ValidationError(
                {"account": f"Linked account must be in {currency} to match the goal."}
            )
        if self.instance and "currency" in attrs and attrs["currency"] != self.instance.currency:
            if self.instance.contributions.exists():
                raise serializers.ValidationError(
                    {"currency": "Currency cannot change once contributions exist."}
                )
        return attrs
