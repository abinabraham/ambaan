from django.contrib import admin

from .models import Budget


@admin.register(Budget)
class BudgetAdmin(admin.ModelAdmin):
    list_display = ["month", "user", "category", "amount", "currency", "alert_threshold"]
    list_filter = ["currency", "month"]
