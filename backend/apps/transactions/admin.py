from django.contrib import admin

from .models import Transaction


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ["transaction_date", "user", "type", "amount", "currency", "account", "category"]
    list_filter = ["type", "currency"]
    search_fields = ["description", "payee", "user__email"]
    date_hierarchy = "transaction_date"
    raw_id_fields = ["account", "to_account", "category", "recurring"]
