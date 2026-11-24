from django.db import transaction
from django.db.models import ProtectedError
from rest_framework import status, viewsets
from rest_framework.response import Response

from . import audit
from .models import AuditLog


class OwnedModelViewSet(viewsets.ModelViewSet):
    """Scopes every query to the requesting user and assigns ownership on create."""

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return super().get_queryset().none()
        return super().get_queryset().filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class AuditedModelViewSet(OwnedModelViewSet):
    """Owned viewset that writes an AuditLog entry for every create, update and delete."""

    def perform_create(self, serializer):
        with transaction.atomic():
            super().perform_create(serializer)
            audit.record(
                self.request.user,
                AuditLog.Action.CREATE,
                serializer.instance,
                after=audit.snapshot(serializer.instance),
            )

    def perform_update(self, serializer):
        with transaction.atomic():
            before = audit.snapshot(serializer.instance)
            serializer.save()
            audit.record(
                self.request.user,
                AuditLog.Action.UPDATE,
                serializer.instance,
                before=before,
                after=audit.snapshot(serializer.instance),
            )

    def perform_destroy(self, instance):
        with transaction.atomic():
            audit.record(
                self.request.user, AuditLog.Action.DELETE, instance, before=audit.snapshot(instance)
            )
            instance.delete()

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "This record is used by existing transactions. Archive it instead."},
                status=status.HTTP_409_CONFLICT,
            )
