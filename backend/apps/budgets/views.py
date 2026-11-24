from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core import audit
from apps.core.models import AuditLog
from apps.core.viewsets import AuditedModelViewSet

from .models import Budget
from .serializers import BudgetSerializer, CopyBudgetsSerializer


class BudgetViewSet(AuditedModelViewSet):
    queryset = Budget.objects.select_related("category")
    serializer_class = BudgetSerializer
    filterset_fields = ["month", "category", "currency"]
    ordering_fields = ["month", "amount"]
    pagination_class = None

    @extend_schema(request=CopyBudgetsSerializer, responses={201: BudgetSerializer(many=True)})
    @action(detail=False, methods=["post"])
    def copy(self, request):
        """Copy every budget from one month to another, skipping ones that already exist."""
        params = CopyBudgetsSerializer(data=request.data)
        params.is_valid(raise_exception=True)
        source = params.validated_data["from_month"].replace(day=1)
        target = params.validated_data["to_month"].replace(day=1)

        created = []
        with transaction.atomic():
            for budget in self.get_queryset().filter(month=source):
                exists = Budget.objects.filter(
                    user=request.user, month=target, category=budget.category, currency=budget.currency
                ).exists()
                if exists:
                    continue
                new = Budget.objects.create(
                    user=request.user,
                    month=target,
                    category=budget.category,
                    amount=budget.amount,
                    currency=budget.currency,
                    alert_threshold=budget.alert_threshold,
                    notes=budget.notes,
                )
                audit.record(request.user, AuditLog.Action.CREATE, new, after=audit.snapshot(new))
                created.append(new)
        return Response(self.get_serializer(created, many=True).data, status=status.HTTP_201_CREATED)
