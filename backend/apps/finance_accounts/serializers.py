from rest_framework import serializers

from .models import FinanceAccount


class FinanceAccountSerializer(serializers.ModelSerializer):
    current_balance = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = FinanceAccount
        fields = [
            "id",
            "name",
            "type",
            "currency",
            "opening_balance",
            "current_balance",
            "institution",
            "color",
            "is_active",
            "include_in_net_worth",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_name(self, value):
        user = self.context["request"].user
        qs = FinanceAccount.objects.filter(user=user, name__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("You already have an account with this name.")
        return value

    def validate_currency(self, value):
        if self.instance and value != self.instance.currency:
            from apps.transactions.models import Transaction

            if Transaction.objects.filter(account=self.instance).exists() or Transaction.objects.filter(
                to_account=self.instance
            ).exists():
                raise serializers.ValidationError(
                    "Currency cannot change once the account has transactions."
                )
        return value
