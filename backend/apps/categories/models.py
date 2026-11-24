from django.db import models

from apps.core.models import OwnedModel


class Category(OwnedModel):
    class Kind(models.TextChoices):
        INCOME = "income", "Income"
        EXPENSE = "expense", "Expense"

    name = models.CharField(max_length=100)
    kind = models.CharField(max_length=10, choices=Kind.choices)
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.CASCADE, related_name="children"
    )
    icon = models.CharField(max_length=50, blank=True)
    color = models.CharField(max_length=20, blank=True, default="#8c8c8c")
    is_archived = models.BooleanField(default=False)

    class Meta:
        ordering = ["kind", "name"]
        verbose_name_plural = "categories"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "kind", "name"], name="uniq_user_category_kind_name"
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.kind})"
