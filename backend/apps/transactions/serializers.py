from decimal import Decimal

from django.conf import settings
from rest_framework import serializers

from apps.categories.models import Category
from apps.core.currency import quantize
from apps.finance_accounts.models import FinanceAccount

from .models import Transaction

ALLOWED_RECEIPT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"}


class UserScopedPrimaryKeyField(serializers.PrimaryKeyRelatedField):
    def get_queryset(self):
        return super().get_queryset().filter(user=self.context["request"].user)


class TransactionSerializer(serializers.ModelSerializer):
    account = UserScopedPrimaryKeyField(queryset=FinanceAccount.objects.all())
    to_account = UserScopedPrimaryKeyField(
        queryset=FinanceAccount.objects.all(), required=False, allow_null=True
    )
    category = UserScopedPrimaryKeyField(
        queryset=Category.objects.all(), required=False, allow_null=True
    )
    account_name = serializers.CharField(source="account.name", read_only=True)
    to_account_name = serializers.CharField(source="to_account.name", read_only=True, default=None)
    category_name = serializers.CharField(source="category.name", read_only=True, default=None)
    category_color = serializers.CharField(source="category.color", read_only=True, default=None)
    has_receipt = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = [
            "id",
            "type",
            "account",
            "account_name",
            "category",
            "category_name",
            "category_color",
            "amount",
            "currency",
            "to_account",
            "to_account_name",
            "to_amount",
            "exchange_rate",
            "transaction_date",
            "description",
            "payee",
            "notes",
            "has_receipt",
            "recurring",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "currency", "recurring", "created_at", "updated_at"]

    def get_has_receipt(self, obj) -> bool:
        return bool(obj.receipt)

    def validate(self, attrs):
        def current(name):
            return attrs.get(name, getattr(self.instance, name, None))

        txn_type = current("type")
        account = current("account")
        category = current("category")
        to_account = current("to_account")
        amount = current("amount")

        if not account.is_active and (not self.instance or "account" in attrs):
            raise serializers.ValidationError({"account": "This account is archived."})

        if txn_type == Transaction.Type.TRANSFER:
            if to_account is None:
                raise serializers.ValidationError({"to_account": "Transfers need a destination account."})
            if to_account.pk == account.pk:
                raise serializers.ValidationError({"to_account": "Choose a different destination account."})
            attrs["category"] = None
            attrs.update(self._resolve_transfer_amounts(attrs, account, to_account, amount))
        else:
            if category is None:
                raise serializers.ValidationError({"category": "A category is required."})
            if category.kind != txn_type:
                raise serializers.ValidationError(
                    {"category": f"Choose an {txn_type} category for this transaction."}
                )
            attrs["to_account"] = None
            attrs["to_amount"] = None
            attrs["exchange_rate"] = None

        attrs["currency"] = account.currency
        return attrs

    def _resolve_transfer_amounts(self, attrs, account, to_account, amount):
        if account.currency == to_account.currency:
            return {"to_amount": amount, "exchange_rate": Decimal(1)}

        to_amount = attrs.get("to_amount")
        rate = attrs.get("exchange_rate")
        if to_amount:
            return {"to_amount": to_amount, "exchange_rate": (to_amount / amount).quantize(Decimal("1e-8"))}
        if rate:
            return {"to_amount": quantize(amount * rate), "exchange_rate": rate}
        raise serializers.ValidationError(
            {
                "to_amount": (
                    f"Cross-currency transfer ({account.currency} to {to_account.currency}): "
                    "enter the amount received or the exchange rate."
                )
            }
        )


class ReceiptUploadSerializer(serializers.Serializer):
    file = serializers.FileField()

    def validate_file(self, value):
        if value.size > settings.RECEIPT_MAX_BYTES:
            raise serializers.ValidationError(
                f"Receipts must be smaller than {settings.RECEIPT_MAX_BYTES // (1024 * 1024)} MB."
            )
        if getattr(value, "content_type", None) not in ALLOWED_RECEIPT_TYPES:
            raise serializers.ValidationError("Upload a JPEG, PNG, WEBP, HEIC image or a PDF.")
        return value
