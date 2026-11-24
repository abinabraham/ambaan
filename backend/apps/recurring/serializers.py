from rest_framework import serializers

from apps.categories.models import Category
from apps.finance_accounts.models import FinanceAccount
from apps.transactions.serializers import UserScopedPrimaryKeyField

from .models import RecurringTransaction


class RecurringTransactionSerializer(serializers.ModelSerializer):
    account = UserScopedPrimaryKeyField(queryset=FinanceAccount.objects.all())
    category = UserScopedPrimaryKeyField(queryset=Category.objects.all())
    account_name = serializers.CharField(source="account.name", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    next_due_date = serializers.DateField(required=False)

    class Meta:
        model = RecurringTransaction
        fields = [
            "id",
            "name",
            "type",
            "account",
            "account_name",
            "category",
            "category_name",
            "amount",
            "currency",
            "frequency",
            "interval",
            "start_date",
            "end_date",
            "next_due_date",
            "auto_create",
            "remind_days_before",
            "payee",
            "description",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "currency", "created_at", "updated_at"]

    def validate(self, attrs):
        def current(name):
            return attrs.get(name, getattr(self.instance, name, None))

        if current("category").kind != current("type"):
            raise serializers.ValidationError({"category": "Category kind must match the type."})
        end_date, start_date = current("end_date"), current("start_date")
        if end_date and end_date < start_date:
            raise serializers.ValidationError({"end_date": "End date must be after the start date."})
        if not self.instance and "next_due_date" not in attrs:
            attrs["next_due_date"] = start_date
        attrs["currency"] = current("account").currency
        return attrs


class UpcomingSerializer(serializers.Serializer):
    recurring = serializers.UUIDField()
    name = serializers.CharField()
    type = serializers.CharField()
    amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    currency = serializers.CharField()
    due_date = serializers.DateField()
    auto_create = serializers.BooleanField()
