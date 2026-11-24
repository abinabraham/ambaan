from rest_framework.test import APITestCase

from apps.categories.models import Category


class ApiTestCase(APITestCase):
    password = "S3cure-pass-123"

    def register(self, email="nesto@example.com", base_currency="AED"):
        response = self.client.post(
            "/api/auth/register/",
            {"email": email, "password": self.password, "full_name": "Test", "base_currency": base_currency},
            format="json",
        )
        assert response.status_code == 201, response.data
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        return response.data

    def create_account(self, name="Bank", currency="AED", opening="0", type_="bank"):
        response = self.client.post(
            "/api/finance-accounts/",
            {"name": name, "currency": currency, "opening_balance": opening, "type": type_},
            format="json",
        )
        assert response.status_code == 201, response.data
        return response.data

    def category(self, name, kind="expense"):
        return str(Category.objects.get(name=name, kind=kind, user__email=self.email).id)

    def txn(self, **data):
        response = self.client.post("/api/transactions/", data, format="json")
        assert response.status_code == 201, response.data
        return response.data
