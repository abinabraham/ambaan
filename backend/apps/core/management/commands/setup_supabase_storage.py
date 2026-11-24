import requests
from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create the private Supabase Storage bucket for receipts if it does not exist."

    def handle(self, *args, **options):
        if not (settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY):
            self.stdout.write("Supabase Storage not configured; receipts use local storage.")
            return

        base = settings.SUPABASE_URL.rstrip("/") + "/storage/v1/bucket"
        headers = {
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
            "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        }
        bucket = settings.SUPABASE_STORAGE_BUCKET

        if requests.get(f"{base}/{bucket}", headers=headers, timeout=30).status_code == 200:
            self.stdout.write(f"Bucket '{bucket}' already exists.")
            return

        response = requests.post(
            base,
            headers=headers,
            json={
                "id": bucket,
                "name": bucket,
                "public": False,
                "file_size_limit": settings.RECEIPT_MAX_BYTES,
                "allowed_mime_types": ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"],
            },
            timeout=30,
        )
        response.raise_for_status()
        self.stdout.write(self.style.SUCCESS(f"Created private bucket '{bucket}'."))
