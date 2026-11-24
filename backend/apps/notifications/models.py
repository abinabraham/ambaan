from django.db import models

from apps.core.models import OwnedModel


class Notification(OwnedModel):
    class Kind(models.TextChoices):
        BUDGET_WARNING = "budget_warning", "Budget warning"
        BUDGET_EXCEEDED = "budget_exceeded", "Budget exceeded"
        BILL_REMINDER = "bill_reminder", "Bill reminder"
        INCOME_REMINDER = "income_reminder", "Income reminder"
        GOAL_ACHIEVED = "goal_achieved", "Goal achieved"
        SYSTEM = "system", "System"

    class Level(models.TextChoices):
        INFO = "info", "Info"
        SUCCESS = "success", "Success"
        WARNING = "warning", "Warning"
        ERROR = "error", "Error"

    kind = models.CharField(max_length=20, choices=Kind.choices)
    level = models.CharField(max_length=10, choices=Level.choices, default=Level.INFO)
    title = models.CharField(max_length=150)
    message = models.TextField(blank=True)
    link = models.CharField(max_length=255, blank=True)
    is_read = models.BooleanField(default=False, db_index=True)
    dedupe_key = models.CharField(max_length=150, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "dedupe_key"],
                condition=~models.Q(dedupe_key=""),
                name="uniq_notification_dedupe_key",
            ),
        ]

    def __str__(self):
        return self.title
