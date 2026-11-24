from django.contrib import admin

from .models import AuditLog, ExchangeRate


@admin.register(ExchangeRate)
class ExchangeRateAdmin(admin.ModelAdmin):
    list_display = ["user", "base_currency", "quote_currency", "rate", "effective_date"]
    list_filter = ["base_currency", "quote_currency"]


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ["timestamp", "user", "action", "model", "object_repr"]
    list_filter = ["action", "model"]
    readonly_fields = [f.name for f in AuditLog._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
