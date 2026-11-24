from decimal import Decimal

from django.db import transaction
from django.db.models import DecimalField, Sum, Value
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core import audit
from apps.core.models import AuditLog
from apps.core.viewsets import AuditedModelViewSet
from apps.notifications.services import notify_goal_achieved

from .models import SavingsContribution, SavingsGoal
from .serializers import SavingsContributionSerializer, SavingsGoalSerializer


class SavingsGoalViewSet(AuditedModelViewSet):
    queryset = SavingsGoal.objects.select_related("account")
    serializer_class = SavingsGoalSerializer
    filterset_fields = ["status", "currency"]
    ordering_fields = ["target_date", "name", "created_at"]
    pagination_class = None

    def get_queryset(self):
        return super().get_queryset().annotate(
            saved_amount=Coalesce(
                Sum("contributions__amount"),
                Value(Decimal("0.00")),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            )
        )

    def perform_create(self, serializer):
        super().perform_create(serializer)
        serializer.instance = self.get_queryset().get(pk=serializer.instance.pk)

    def perform_update(self, serializer):
        super().perform_update(serializer)
        serializer.instance = self.get_queryset().get(pk=serializer.instance.pk)

    @extend_schema(
        methods=["post"],
        request=SavingsContributionSerializer,
        responses={201: SavingsContributionSerializer},
    )
    @extend_schema(methods=["get"], responses={200: SavingsContributionSerializer(many=True)})
    @action(detail=True, methods=["get", "post"])
    def contributions(self, request, pk=None):
        goal = self.get_object()
        if request.method == "GET":
            data = SavingsContributionSerializer(goal.contributions.all(), many=True).data
            return Response(data)

        serializer = SavingsContributionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            contribution = serializer.save(goal=goal, user=request.user)
            audit.record(request.user, AuditLog.Action.CREATE, contribution,
                         after=audit.snapshot(contribution))
            goal = self.get_queryset().get(pk=goal.pk)
            if goal.status == SavingsGoal.Status.ACTIVE and goal.saved_amount >= goal.target_amount:
                goal.status = SavingsGoal.Status.ACHIEVED
                goal.save(update_fields=["status", "updated_at"])
                notify_goal_achieved(request.user, goal)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @extend_schema(parameters=[OpenApiParameter("contribution_id", OpenApiTypes.UUID, OpenApiParameter.PATH)])
    @action(detail=True, methods=["delete"], url_path=r"contributions/(?P<contribution_id>[^/.]+)")
    def delete_contribution(self, request, pk=None, contribution_id=None):
        goal = self.get_object()
        contribution = get_object_or_404(goal.contributions, pk=contribution_id)
        with transaction.atomic():
            audit.record(request.user, AuditLog.Action.DELETE, contribution,
                         before=audit.snapshot(contribution))
            contribution.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
