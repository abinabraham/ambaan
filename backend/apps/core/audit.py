import json

from django.core.serializers.json import DjangoJSONEncoder
from django.db import models

from .models import AuditLog


def snapshot(instance: models.Model) -> dict:
    data = {}
    for field in instance._meta.concrete_fields:
        value = getattr(instance, field.attname)
        if isinstance(field, models.FileField):
            value = value.name if value else None
        data[field.attname] = value
    return json.loads(json.dumps(data, cls=DjangoJSONEncoder))


def record(user, action: str, instance: models.Model, before=None, after=None) -> AuditLog:
    return AuditLog.objects.create(
        user=user,
        action=action,
        model=instance._meta.label,
        object_id=str(instance.pk),
        object_repr=str(instance)[:255],
        before=before,
        after=after,
    )
