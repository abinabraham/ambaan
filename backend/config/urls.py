from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from apps.accounts.urls import account_urlpatterns, auth_urlpatterns
from apps.analytics import views as analytics
from apps.budgets.views import BudgetViewSet
from apps.categories.views import CategoryViewSet
from apps.core.views import AuditLogViewSet, ExchangeRateViewSet
from apps.finance_accounts.views import FinanceAccountViewSet
from apps.notifications.views import NotificationViewSet
from apps.recurring.views import RecurringTransactionViewSet
from apps.savings.views import SavingsGoalViewSet
from apps.transactions.views import TransactionViewSet

router = DefaultRouter()
router.register("finance-accounts", FinanceAccountViewSet, basename="finance-account")
router.register("categories", CategoryViewSet, basename="category")
router.register("transactions", TransactionViewSet, basename="transaction")
router.register("budgets", BudgetViewSet, basename="budget")
router.register("savings", SavingsGoalViewSet, basename="savings-goal")
router.register("recurring", RecurringTransactionViewSet, basename="recurring")
router.register("notifications", NotificationViewSet, basename="notification")
router.register("exchange-rates", ExchangeRateViewSet, basename="exchange-rate")
router.register("audit-log", AuditLogViewSet, basename="audit-log")

api_urlpatterns = [
    path("auth/", include(auth_urlpatterns)),
    path("accounts/", include(account_urlpatterns)),
    path("dashboard/", analytics.DashboardView.as_view(), name="dashboard"),
    path("analytics/monthly/", analytics.MonthlyAnalyticsView.as_view(), name="analytics-monthly"),
    path("analytics/yearly/", analytics.YearlyAnalyticsView.as_view(), name="analytics-yearly"),
    path("analytics/ai-advice/", analytics.AIAdviceView.as_view(), name="analytics-ai-advice"),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    path("", include(router.urls)),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(api_urlpatterns)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
