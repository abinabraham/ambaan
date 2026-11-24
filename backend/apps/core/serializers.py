from rest_framework import serializers

from .models import AuditLog, ExchangeRate


class ExchangeRateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExchangeRate
        fields = ["id", "base_currency", "quote_currency", "rate", "effective_date", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        base = attrs.get("base_currency", getattr(self.instance, "base_currency", None))
        quote = attrs.get("quote_currency", getattr(self.instance, "quote_currency", None))
        if base == quote:
            raise serializers.ValidationError("Base and quote currencies must differ.")
        return attrs


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = ["id", "action", "model", "object_id", "object_repr", "before", "after", "timestamp"]
