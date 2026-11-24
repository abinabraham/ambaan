from decimal import Decimal

from apps.core.models import AuditLog
from apps.core.testing import ApiTestCase


class AuthTests(ApiTestCase):
    def test_register_login_profile_logout(self):
        data = self.register()
        self.assertEqual(data["user"]["base_currency"], "AED")

        self.client.credentials()
        login = self.client.post(
            "/api/auth/login/", {"email": "NESTO@example.com", "password": self.password}, format="json"
        )
        self.assertEqual(login.status_code, 200)
        self.assertIn("user", login.data)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        profile = self.client.patch("/api/accounts/profile/", {"base_currency": "INR"}, format="json")
        self.assertEqual(profile.data["base_currency"], "INR")

        logout = self.client.post("/api/auth/logout/", {"refresh": login.data["refresh"]}, format="json")
        self.assertEqual(logout.status_code, 205)
        refresh = self.client.post("/api/auth/refresh/", {"refresh": login.data["refresh"]}, format="json")
        self.assertEqual(refresh.status_code, 401)

    def test_default_categories_created(self):
        self.register()
        response = self.client.get("/api/categories/?kind=income")
        self.assertTrue(any(c["name"] == "Salary" for c in response.data))


class TransactionTests(ApiTestCase):
    email = "nesto@example.com"

    def setUp(self):
        self.register(self.email)
        self.bank = self.create_account("Bank", "AED", "1000.00")
        self.inr = self.create_account("India bank", "INR", "0")

    def test_balance_and_validation(self):
        self.txn(type="income", account=self.bank["id"], category=self.category("Salary", "income"),
                 amount="5000.00", transaction_date="2026-11-01")
        self.txn(type="expense", account=self.bank["id"], category=self.category("Groceries"),
                 amount="250.50", transaction_date="2026-11-02")

        bad = self.client.post("/api/transactions/", {
            "type": "expense", "account": self.bank["id"], "category": self.category("Salary", "income"),
            "amount": "10", "transaction_date": "2026-11-02"}, format="json")
        self.assertEqual(bad.status_code, 400)

        acc = self.client.get(f"/api/finance-accounts/{self.bank['id']}/").data
        self.assertEqual(Decimal(acc["current_balance"]), Decimal("5749.50"))

    def test_cross_currency_transfer_requires_explicit_rate(self):
        payload = {"type": "transfer", "account": self.bank["id"], "to_account": self.inr["id"],
                   "amount": "100.00", "transaction_date": "2026-11-03"}
        self.assertEqual(self.client.post("/api/transactions/", payload, format="json").status_code, 400)

        txn = self.txn(**payload, exchange_rate="22.75")
        self.assertEqual(Decimal(txn["to_amount"]), Decimal("2275.00"))

        balances = {a["name"]: Decimal(a["current_balance"]) for a in self.client.get("/api/finance-accounts/").data}
        self.assertEqual(balances["Bank"], Decimal("900.00"))
        self.assertEqual(balances["India bank"], Decimal("2275.00"))

        # Transfers never count as income or expense.
        report = self.client.get("/api/analytics/monthly/?year=2026&month=11&currency=AED").data
        self.assertEqual(report["summary"]["expenses"], 0)

    def test_users_cannot_see_or_use_each_others_records(self):
        self.client.credentials()
        self.register("other@example.com")
        self.assertEqual(self.client.get("/api/finance-accounts/").data, [])
        self.assertEqual(self.client.get(f"/api/finance-accounts/{self.bank['id']}/").status_code, 404)
        other_cat = self.client.get("/api/categories/?kind=expense").data[0]["id"]
        response = self.client.post("/api/transactions/", {
            "type": "expense", "account": self.bank["id"], "category": other_cat,
            "amount": "5", "transaction_date": "2026-11-02"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_audit_trail_on_update_and_delete(self):
        txn = self.txn(type="expense", account=self.bank["id"], category=self.category("Transport"),
                       amount="40.00", transaction_date="2026-11-04")
        self.client.patch(f"/api/transactions/{txn['id']}/", {"amount": "45.00"}, format="json")
        self.client.delete(f"/api/transactions/{txn['id']}/")
        actions = list(AuditLog.objects.filter(object_id=txn["id"]).values_list("action", flat=True))
        self.assertCountEqual(actions, ["create", "update", "delete"])
        update = AuditLog.objects.get(object_id=txn["id"], action="update")
        self.assertEqual(update.before["amount"], "40.00")
        self.assertEqual(update.after["amount"], "45.00")

    def test_account_with_transactions_cannot_be_deleted(self):
        self.txn(type="expense", account=self.bank["id"], category=self.category("Transport"),
                 amount="40.00", transaction_date="2026-11-04")
        self.assertEqual(self.client.delete(f"/api/finance-accounts/{self.bank['id']}/").status_code, 409)
