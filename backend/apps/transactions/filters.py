import django_filters
from django.db.models import Q

from .models import Transaction


class TransactionFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="transaction_date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="transaction_date", lookup_expr="lte")
    min_amount = django_filters.NumberFilter(field_name="amount", lookup_expr="gte")
    max_amount = django_filters.NumberFilter(field_name="amount", lookup_expr="lte")
    account = django_filters.UUIDFilter(method="filter_account")

    class Meta:
        model = Transaction
        fields = ["type", "category", "currency", "recurring"]

    def filter_account(self, queryset, name, value):
        return queryset.filter(Q(account_id=value) | Q(to_account_id=value))
