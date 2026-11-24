from datetime import date
from decimal import Decimal

from apps.core.testing import ApiTestCase
from apps.notifications.models import Notification
from apps.recurring.models import RecurringTransaction
from apps.recurring.services import process_due


class AnalyticsTests(ApiTestCase):
    email = "nesto@example.com"

    def setUp(self):
        self.register(self.email)
        self.bank = self.create_account("Bank", "AED", "0")
        self.inr = self.create_account("India bank", "INR", "0")
        salary, rent, food = (self.category("Salary", "income"), self.category("Rent & Housing"),
                              self.category("Groceries"))
        self.food = food
        for month, food_amount in [(9, "800"), (10, "1000")]:
            self.txn(type="income", account=self.bank["id"], category=salary, amount="10000",
                     transaction_date=f"2026-{month:02d}-01")
            self.txn(type="expense", account=self.bank["id"], category=rent, amount="4000",
                     transaction_date=f"2026-{month:02d}-02")
            self.txn(type="expense", account=self.bank["id"], category=food, amount=food_amount,
                     transaction_date=f"2026-{month:02d}-10")
        self.txn(type="expense", account=self.inr["id"], category=food, amount="5000",
                 transaction_date="2026-10-15")

    def test_monthly_report(self):
        data = self.client.get("/api/analytics/monthly/?year=2026&month=10&currency=AED").data
        summary = data["summary"]
        self.assertEqual(summary["income"], Decimal("10000"))
        self.assertEqual(summary["expenses"], Decimal("5000"))  # INR expense is excluded
        self.assertEqual(summary["net_cash_flow"], Decimal("5000"))
        self.assertEqual(summary["savings_rate"], 50.0)
        self.assertEqual(data["comparison"]["expense_change"], Decimal("200"))
        self.assertEqual(data["expense_categories"][0]["name"], "Rent & Housing")
        self.assertEqual(data["expense_categories"][0]["percentage"], 80.0)

    def test_yearly_report(self):
        data = self.client.get("/api/analytics/yearly/?year=2026&currency=AED").data
        self.assertEqual(len(data["monthly"]), 12)
        self.assertEqual(data["summary"]["income"], Decimal("20000"))
        self.assertEqual(data["highest_spending_month"], "Oct 2026")

    def test_consolidation_uses_only_stored_rates(self):
        from apps.analytics.services import consolidated_summary
        from apps.accounts.models import User

        user = User.objects.get(email=self.email)
        result = consolidated_summary(user, date(2026, 10, 1), date(2026, 10, 31), "AED")
        self.assertFalse(result["complete"])
        self.assertEqual(result["missing_rates"], ["INR"])
        self.assertEqual(result["expenses"], Decimal("5000"))

        self.client.post("/api/exchange-rates/", {"base_currency": "AED", "quote_currency": "INR",
                                                  "rate": "25", "effective_date": "2026-10-01"}, format="json")
        result = consolidated_summary(user, date(2026, 10, 1), date(2026, 10, 31), "AED")
        self.assertTrue(result["complete"])
        self.assertEqual(result["expenses"], Decimal("5200.00"))  # 5000 INR / 25 = 200 AED

    def test_budget_alerts_and_utilization(self):
        self.client.post("/api/budgets/", {"month": "2026-11-15", "category": self.food,
                                           "amount": "500", "currency": "AED"}, format="json")
        self.txn(type="expense", account=self.bank["id"], category=self.food, amount="420",
                 transaction_date="2026-11-05")
        budget = self.client.get("/api/budgets/?month=2026-11-01").data[0]
        self.assertEqual(budget["status"], "warning")
        self.assertEqual(budget["utilization"], 84.0)
        self.txn(type="expense", account=self.bank["id"], category=self.food, amount="100",
                 transaction_date="2026-11-06")
        kinds = set(Notification.objects.values_list("kind", flat=True))
        self.assertEqual(kinds, {"budget_warning", "budget_exceeded"})

    def test_dashboard_and_advice(self):
        dashboard = self.client.get("/api/dashboard/?currency=AED")
        self.assertEqual(dashboard.status_code, 200)
        self.assertEqual(len(dashboard.data["trend"]), 6)
        self.assertIn("INR", dashboard.data["currencies"])
        advice = self.client.get("/api/analytics/ai-advice/?currency=AED")
        self.assertEqual(advice.status_code, 200)
        self.assertTrue(advice.data["insights"])


class RecurringTests(ApiTestCase):
    email = "nesto@example.com"

    def test_monthly_recurring_catches_up_and_clamps_month_end(self):
        self.register(self.email)
        bank = self.create_account("Bank", "AED", "0")
        response = self.client.post("/api/recurring/", {
            "name": "Rent", "type": "expense", "account": bank["id"],
            "category": self.category("Rent & Housing"), "amount": "4000",
            "frequency": "monthly", "start_date": "2026-01-31",
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)

        result = process_due(today=date(2026, 4, 1))
        self.assertEqual(result["created"], 3)
        item = RecurringTransaction.objects.get()
        self.assertEqual(item.next_due_date, date(2026, 4, 30))
        dates = sorted(item.generated_transactions.values_list("transaction_date", flat=True))
        self.assertEqual(dates, [date(2026, 1, 31), date(2026, 2, 28), date(2026, 3, 31)])
