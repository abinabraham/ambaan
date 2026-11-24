from django.core.management.base import BaseCommand

from apps.recurring.services import process_due


class Command(BaseCommand):
    help = "Record due recurring transactions and send upcoming-bill reminders for all users."

    def handle(self, *args, **options):
        result = process_due()
        self.stdout.write(
            self.style.SUCCESS(f"Created {result['created']} transactions, {result['reminders']} reminders.")
        )
