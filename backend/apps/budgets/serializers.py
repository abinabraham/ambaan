from rest_framework import serializers

from apps.categories.models import Category
from apps.transactions.serializers import UserScopedPrimaryKeyField

from .models import Budget
from .services import budget_status


class BudgetSerializer(serializers.ModelSerializer):
    category = UserScopedPrimaryKeyField(
        queryset=Category.objects.all(), required=False, allow_null=True
    )
    category_name = serializers.CharField(source="category.name", read_only=True, default=None)
    category_color = serializers.CharField(source="category.color", read_only=True, default=None)
    spent = serializers.SerializerMethodField()
    remaining = serializers.SerializerMethodField()
    utilization = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = Budget
        fields = [
            "id",
            "month",
            "category",
            "category_name",
            "category_color",
            "amount",
            "currency",
            "alert_threshold",
            "notes",
            "spent",
            "remaining",
            "utilization",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def _status(self, obj):
        cache = self.context.setdefault("_budget_status", {})
        if obj.pk not in cache:
            cache[obj.pk] = budget_status(obj)
        return cache[obj.pk]

    def get_spent(self, obj) -> str:
        return str(self._status(obj)["spent"])

    def get_remaining(self, obj) -> str:
        return str(self._status(obj)["remaining"])

    def get_utilization(self, obj) -> float:
        return float(self._status(obj)["utilization"])

    def get_status(self, obj) -> str:
        return self._status(obj)["status"]

    def validate_month(self, value):
        return value.replace(day=1)

    def validate(self, attrs):
        category = attrs.get("category", getattr(self.instance, "category", None))
        if category is not None and category.kind != Category.Kind.EXPENSE:
            raise serializers.ValidationError({"category": "Budgets apply to expense categories only."})

        user = self.context["request"].user
        month = attrs.get("month", getattr(self.instance, "month", None))
        currency = attrs.get("currency", getattr(self.instance, "currency", None))
        qs = Budget.objects.filter(user=user, month=month, currency=currency, category=category)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A budget for this category, month and currency already exists.")
        return attrs


class CopyBudgetsSerializer(serializers.Serializer):
    from_month = serializers.DateField()
    to_month = serializers.DateField()
