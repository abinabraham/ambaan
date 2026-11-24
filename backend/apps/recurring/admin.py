from django.contrib import admin

from .models import RecurringTransaction


@admin.register(RecurringTransaction)
class RecurringTransactionAdmin(admin.ModelAdmin):
    list_display = ["name", "user", "type", "amount", "currency", "frequency", "next_due_date", "is_active"]
    list_filter = ["type", "frequency", "is_active"]
    search_fields = ["name", "user__email"]
