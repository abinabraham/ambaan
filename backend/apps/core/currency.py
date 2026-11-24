from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from .models import ExchangeRate

CENT = Decimal("0.01")


def quantize(amount: Decimal) -> Decimal:
    return Decimal(amount).quantize(CENT, rounding=ROUND_HALF_UP)


class RateBook:
    """Resolves explicitly stored exchange rates for a user. Never guesses a rate."""

    def __init__(self, user):
        self.user = user
        self._cache: dict[tuple[str, str, date], Decimal | None] = {}

    def rate(self, from_currency: str, to_currency: str, on_date: date) -> Decimal | None:
        if from_currency == to_currency:
            return Decimal(1)
        key = (from_currency, to_currency, on_date)
        if key not in self._cache:
            self._cache[key] = self._lookup(from_currency, to_currency, on_date)
        return self._cache[key]

    def _lookup(self, from_currency, to_currency, on_date):
        rates = ExchangeRate.objects.filter(user=self.user, effective_date__lte=on_date)
        direct = (
            rates.filter(base_currency=from_currency, quote_currency=to_currency)
            .order_by("-effective_date")
            .first()
        )
        inverse = (
            rates.filter(base_currency=to_currency, quote_currency=from_currency)
            .order_by("-effective_date")
            .first()
        )
        if direct and (not inverse or direct.effective_date >= inverse.effective_date):
            return direct.rate
        if inverse:
            return Decimal(1) / inverse.rate
        return None

    def convert(self, amount, from_currency, to_currency, on_date) -> Decimal | None:
        rate = self.rate(from_currency, to_currency, on_date)
        return None if rate is None else quantize(Decimal(amount) * rate)
