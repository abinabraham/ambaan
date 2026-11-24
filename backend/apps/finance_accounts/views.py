from apps.core.viewsets import AuditedModelViewSet

from .models import FinanceAccount
from .serializers import FinanceAccountSerializer


class FinanceAccountViewSet(AuditedModelViewSet):
    queryset = FinanceAccount.objects.all()
    serializer_class = FinanceAccountSerializer
    filterset_fields = ["type", "currency", "is_active"]
    search_fields = ["name", "institution"]
    ordering_fields = ["name", "created_at"]
    pagination_class = None

    def get_queryset(self):
        return super().get_queryset().with_balances()

    def perform_create(self, serializer):
        super().perform_create(serializer)
        serializer.instance = self.get_queryset().get(pk=serializer.instance.pk)

    def perform_update(self, serializer):
        super().perform_update(serializer)
        serializer.instance = self.get_queryset().get(pk=serializer.instance.pk)
