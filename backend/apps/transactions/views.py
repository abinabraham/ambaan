import csv

from django.db import transaction as db_transaction
from django.http import HttpResponse
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.core import audit
from apps.core.models import AuditLog
from apps.core.viewsets import AuditedModelViewSet
from apps.notifications.services import check_budget_alerts

from .filters import TransactionFilter
from .models import Transaction
from .serializers import ReceiptUploadSerializer, TransactionSerializer


class TransactionViewSet(AuditedModelViewSet):
    queryset = Transaction.objects.select_related("account", "to_account", "category")
    serializer_class = TransactionSerializer
    filterset_class = TransactionFilter
    search_fields = ["description", "payee", "notes", "category__name"]
    ordering_fields = ["transaction_date", "amount", "created_at"]

    def perform_create(self, serializer):
        super().perform_create(serializer)
        check_budget_alerts(self.request.user, serializer.instance)

    def perform_update(self, serializer):
        super().perform_update(serializer)
        check_budget_alerts(self.request.user, serializer.instance)

    @extend_schema(request=None, responses={200: dict})
    @action(detail=False, methods=["get"])
    def export(self, request):
        """Download the (filtered) transaction list as CSV."""
        queryset = self.filter_queryset(self.get_queryset())
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="ambaan-transactions.csv"'
        writer = csv.writer(response)
        writer.writerow(
            ["Date", "Type", "Account", "Category", "Amount", "Currency", "To account",
             "To amount", "Payee", "Description", "Notes"]
        )
        for txn in queryset.iterator():
            writer.writerow([
                txn.transaction_date,
                txn.type,
                txn.account.name,
                txn.category.name if txn.category else "",
                txn.amount,
                txn.currency,
                txn.to_account.name if txn.to_account else "",
                txn.to_amount or "",
                txn.payee,
                txn.description,
                txn.notes,
            ])
        return response

    @extend_schema(request=ReceiptUploadSerializer, responses={200: dict})
    @action(
        detail=True,
        methods=["get", "post", "delete"],
        parser_classes=[MultiPartParser, FormParser],
    )
    def receipt(self, request, pk=None):
        """GET a temporary receipt URL, POST (multipart `file`) to upload, DELETE to remove."""
        txn = self.get_object()

        if request.method == "GET":
            if not txn.receipt:
                return Response({"detail": "No receipt attached."}, status=status.HTTP_404_NOT_FOUND)
            url = txn.receipt.url
            if url.startswith("/"):
                url = request.build_absolute_uri(url)
            return Response({"url": url})

        before = audit.snapshot(txn)
        with db_transaction.atomic():
            if request.method == "POST":
                serializer = ReceiptUploadSerializer(data=request.data)
                serializer.is_valid(raise_exception=True)
                old = txn.receipt.name if txn.receipt else None
                txn.receipt.save(serializer.validated_data["file"].name,
                                 serializer.validated_data["file"], save=True)
                if old:
                    txn.receipt.storage.delete(old)
            else:
                if txn.receipt:
                    txn.receipt.delete(save=True)
            audit.record(request.user, AuditLog.Action.UPDATE, txn,
                         before=before, after=audit.snapshot(txn))

        return Response(self.get_serializer(txn).data)
