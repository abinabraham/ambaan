from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.models import Currency
from apps.transactions.serializers import TransactionSerializer

from . import advice, services

CURRENCY_PARAM = OpenApiParameter("currency", str, enum=Currency.values,
                                  description="Defaults to the user's base currency")


class PeriodParams(serializers.Serializer):
    currency = serializers.ChoiceField(choices=Currency.choices, required=False)
    year = serializers.IntegerField(min_value=2000, max_value=2100, required=False)
    month = serializers.IntegerField(min_value=1, max_value=12, required=False)


def _params(request):
    params = PeriodParams(data=request.query_params)
    params.is_valid(raise_exception=True)
    today = timezone.localdate()
    data = params.validated_data
    return (
        data.get("currency") or request.user.base_currency,
        data.get("year") or today.year,
        data.get("month") or today.month,
    )


class DashboardView(APIView):
    @extend_schema(parameters=[CURRENCY_PARAM], responses={200: dict})
    def get(self, request):
        currency, _, _ = _params(request)
        data = services.dashboard(request.user, currency)
        data["recent_transactions"] = TransactionSerializer(
            data["recent_transactions"], many=True, context={"request": request}
        ).data
        return Response(data)


class MonthlyAnalyticsView(APIView):
    @extend_schema(
        parameters=[CURRENCY_PARAM, OpenApiParameter("year", int), OpenApiParameter("month", int)],
        responses={200: dict},
    )
    def get(self, request):
        currency, year, month = _params(request)
        return Response(services.monthly_report(request.user, year, month, currency))


class YearlyAnalyticsView(APIView):
    @extend_schema(parameters=[CURRENCY_PARAM, OpenApiParameter("year", int)], responses={200: dict})
    def get(self, request):
        currency, year, _ = _params(request)
        return Response(services.yearly_report(request.user, year, currency))


class AIAdviceView(APIView):
    @extend_schema(parameters=[CURRENCY_PARAM], responses={200: dict})
    def get(self, request):
        currency, _, _ = _params(request)
        return Response(advice.generate_advice(request.user, currency))
