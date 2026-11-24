from rest_framework import viewsets

from .models import AuditLog, ExchangeRate
from .serializers import AuditLogSerializer, ExchangeRateSerializer
from .viewsets import AuditedModelViewSet


class ExchangeRateViewSet(AuditedModelViewSet):
    queryset = ExchangeRate.objects.all()
    serializer_class = ExchangeRateSerializer
    filterset_fields = ["base_currency", "quote_currency"]
    ordering_fields = ["effective_date"]


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    filterset_fields = ["action", "model", "object_id"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return AuditLog.objects.none()
        return super().get_queryset().filter(user=self.request.user)
