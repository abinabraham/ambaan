import random
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.analytics.services import shift_months
from apps.budgets.models import Budget
from apps.categories.defaults import create_default_categories
from apps.categories.models import Category
from apps.core.models import ExchangeRate
from apps.finance_accounts.models import FinanceAccount
from apps.recurring.models import RecurringTransaction
from apps.savings.models import SavingsContribution, SavingsGoal
from apps.transactions.models import Transaction

EMAIL = "demo@ambaan.app"
PASSWORD = "Demo-pass-2026"


class Command(BaseCommand):
    help = f"Create (or recreate) a demo user {EMAIL} with a few months of sample data."

    @transaction.atomic
    def handle(self, *args, **options):
        User.objects.filter(email=EMAIL).delete()
        user = User.objects.create_user(EMAIL, PASSWORD, full_name="Demo User", base_currency="AED")
        create_default_categories(user)
        rng = random.Random(42)
        cat = {c.name: c for c in Category.objects.filter(user=user)}

        bank = FinanceAccount.objects.create(user=user, name="Emirates NBD", type="bank", currency="AED",
                                             opening_balance=Decimal("18000"), institution="Emirates NBD",
                                             color="#0f766e")
        cash = FinanceAccount.objects.create(user=user, name="Cash wallet", type="cash", currency="AED",
                                             opening_balance=Decimal("600"), color="#fa8c16")
        card = FinanceAccount.objects.create(user=user, name="Visa card", type="credit_card", currency="AED",
                                             opening_balance=Decimal("0"), color="#722ed1")
        india = FinanceAccount.objects.create(user=user, name="HDFC Savings", type="bank", currency="INR",
                                              opening_balance=Decimal("150000"), institution="HDFC",
                                              color="#2f54eb")

        today = timezone.localdate()
        this_month = today.replace(day=1)
        for offset in range(-4, 1):
            month = shift_months(this_month, offset)

            def add(type_, account, category, amount, day, **extra):
                d = month.replace(day=min(day, 28))
                if d > today:
                    return
                Transaction.objects.create(user=user, type=type_, account=account, category=category,
                                           amount=Decimal(amount).quantize(Decimal("0.01")),
                                           currency=account.currency, transaction_date=d, **extra)

            add("income", bank, cat["Salary"], 22000, 1, payee="Employer LLC", description="Monthly salary")
            add("expense", bank, cat["Rent & Housing"], 7500, 2, payee="Landlord", description="Apartment rent")
            add("expense", bank, cat["Utilities"], rng.randint(450, 700), 8, payee="DEWA", description="Electricity & water")
            add("expense", card, cat["Subscriptions"], 55, 10, payee="Netflix")
            add("expense", bank, cat["Insurance"], 420, 12, payee="AXA")
            for day in (4, 11, 18, 25):
                add("expense", card, cat["Groceries"], rng.randint(280, 520), day, payee="Carrefour")
            for day in (6, 14, 21):
                add("expense", card, cat["Dining out"], rng.randint(90, 260), day, payee="Restaurant")
            for day in (3, 9, 16, 23):
                add("expense", cash, cat["Transport"], rng.randint(40, 120), day, payee="Careem")
            add("expense", card, cat["Shopping"], rng.randint(300, 1400), 19, payee="Dubai Mall")
            add("expense", card, cat["Entertainment"], rng.randint(100, 400), 26)
            if offset in (-3, -1):
                add("income", bank, cat["Freelance"], rng.randint(2500, 4500), 15, payee="Upwork client")
            add("expense", india, cat["Family support"], 25000, 5, description="Monthly support to parents")
            add("income", india, cat["Investments"], rng.randint(1500, 3000), 20, description="FD interest")

            d = month.replace(day=27)
            if d <= today:
                Transaction.objects.create(user=user, type="transfer", account=bank, to_account=card,
                                           amount=Decimal("2500"), to_amount=Decimal("2500"),
                                           exchange_rate=Decimal(1), currency="AED", transaction_date=d,
                                           description="Card payment")
            if month.replace(day=3) <= today:
                Transaction.objects.create(user=user, type="transfer", account=bank, to_account=india,
                                           amount=Decimal("1000"), to_amount=Decimal("22750"),
                                           exchange_rate=Decimal("22.75"), currency="AED",
                                           transaction_date=month.replace(day=3), description="Remittance home")

        ExchangeRate.objects.create(user=user, base_currency="AED", quote_currency="INR",
                                    rate=Decimal("22.75"), effective_date=shift_months(this_month, -6))
        ExchangeRate.objects.create(user=user, base_currency="USD", quote_currency="AED",
                                    rate=Decimal("3.6725"), effective_date=shift_months(this_month, -6))

        for name, amount in [("Groceries", 1800), ("Dining out", 600), ("Shopping", 800), ("Transport", 400)]:
            for month in (shift_months(this_month, -1), this_month):
                Budget.objects.create(user=user, month=month, category=cat[name], amount=Decimal(amount),
                                      currency="AED")
        Budget.objects.create(user=user, month=this_month, amount=Decimal("13000"), currency="AED")

        emergency = SavingsGoal.objects.create(user=user, name="Emergency fund", target_amount=Decimal("60000"),
                                               currency="AED", target_date=today + timedelta(days=365),
                                               account=bank, color="#52c41a")
        trip = SavingsGoal.objects.create(user=user, name="Kerala trip", target_amount=Decimal("120000"),
                                          currency="INR", target_date=today + timedelta(days=200),
                                          account=india, color="#13c2c2")
        for offset in range(-4, 1):
            d = shift_months(this_month, offset).replace(day=2)
            if d <= today:
                SavingsContribution.objects.create(user=user, goal=emergency, amount=Decimal("3000"),
                                                   contribution_date=d)
                SavingsContribution.objects.create(user=user, goal=trip, amount=Decimal("10000"),
                                                   contribution_date=d)

        next_month = shift_months(this_month, 1)
        for name, type_, account, category, amount, auto in [
            ("Salary", "income", bank, "Salary", 22000, True),
            ("Rent", "expense", bank, "Rent & Housing", 7500, True),
            ("DEWA", "expense", bank, "Utilities", 600, False),
            ("Netflix", "expense", card, "Subscriptions", 55, True),
        ]:
            day = {"Salary": 1, "Rent": 2, "DEWA": 8, "Netflix": 10}[name]
            start = this_month.replace(day=day)
            RecurringTransaction.objects.create(
                user=user, name=name, type=type_, account=account, category=cat[category],
                amount=Decimal(amount), currency=account.currency, frequency="monthly",
                start_date=start, next_due_date=next_month.replace(day=day) if start <= today else start,
                auto_create=auto,
            )

        self.stdout.write(self.style.SUCCESS(f"Demo data ready. Sign in with {EMAIL} / {PASSWORD}"))
