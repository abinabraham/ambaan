from django.contrib import admin

from .models import SavingsContribution, SavingsGoal


class ContributionInline(admin.TabularInline):
    model = SavingsContribution
    extra = 0
    fields = ["amount", "contribution_date", "note"]
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(SavingsGoal)
class SavingsGoalAdmin(admin.ModelAdmin):
    list_display = ["name", "user", "target_amount", "currency", "target_date", "status"]
    list_filter = ["status", "currency"]
    inlines = [ContributionInline]
