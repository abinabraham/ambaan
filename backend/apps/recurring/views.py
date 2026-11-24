from datetime import timedelta

from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.viewsets import AuditedModelViewSet
from apps.transactions.serializers import TransactionSerializer

from . import services
from .models import RecurringTransaction
from .serializers import RecurringTransactionSerializer, UpcomingSerializer


class RecurringTransactionViewSet(AuditedModelViewSet):
    queryset = RecurringTransaction.objects.select_related("account", "category")
    serializer_class = RecurringTransactionSerializer
    filterset_fields = ["type", "frequency", "is_active", "account", "category"]
    search_fields = ["name", "payee", "description"]
    ordering_fields = ["next_due_date", "name", "amount"]
    pagination_class = None

    @extend_schema(request=None, responses={201: TransactionSerializer})
    @action(detail=True, methods=["post"], url_path="post")
    def post_now(self, request, pk=None):
        """Record the currently due occurrence (e.g. mark a bill as paid)."""
        item = self.get_object()
        if not item.is_active:
            return Response({"detail": "This recurring item is inactive."}, status=status.HTTP_400_BAD_REQUEST)
        txn = services.post_occurrence(item)
        return Response(TransactionSerializer(txn, context=self.get_serializer_context()).data,
                        status=status.HTTP_201_CREATED)

    @extend_schema(request=None, responses={200: RecurringTransactionSerializer})
    @action(detail=True, methods=["post"])
    def skip(self, request, pk=None):
        """Skip the current occurrence without recording a transaction."""
        item = self.get_object()
        services.skip_occurrence(item)
        return Response(self.get_serializer(item).data)

    @extend_schema(
        parameters=[OpenApiParameter("days", int, description="Look-ahead window (default 30)")],
        responses={200: UpcomingSerializer(many=True)},
    )
    @action(detail=False, methods=["get"])
    def upcoming(self, request):
        try:
            days = max(1, min(int(request.query_params.get("days", 30)), 366))
        except ValueError:
            days = 30
        until = timezone.localdate() + timedelta(days=days)
        rows = [
            {
                "recurring": item.id,
                "name": item.name,
                "type": item.type,
                "amount": item.amount,
                "currency": item.currency,
                "due_date": due,
                "auto_create": item.auto_create,
            }
            for item in self.get_queryset().filter(is_active=True)
            for due in services.occurrences(item, until)
        ]
        rows.sort(key=lambda r: r["due_date"])
        return Response(UpcomingSerializer(rows, many=True).data)

    @extend_schema(request=None, responses={200: dict})
    @action(detail=False, methods=["post"])
    def process(self, request):
        """Create any due auto-recorded transactions for the current user and queue reminders."""
        return Response(services.process_due(user=request.user))
