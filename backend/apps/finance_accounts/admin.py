from django.contrib import admin

from .models import FinanceAccount


@admin.register(FinanceAccount)
class FinanceAccountAdmin(admin.ModelAdmin):
    list_display = ["name", "user", "type", "currency", "opening_balance", "is_active"]
    list_filter = ["type", "currency", "is_active"]
    search_fields = ["name", "user__email"]
