"""Django storage backend for Supabase Storage (private bucket, signed URLs)."""

from urllib.parse import quote

import requests
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible


@deconstructible
class SupabaseStorage(Storage):
    timeout = 30

    def __init__(self, bucket=None):
        self.base_url = settings.SUPABASE_URL.rstrip("/") + "/storage/v1"
        self.bucket = bucket or settings.SUPABASE_STORAGE_BUCKET
        self.headers = {
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
            "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        }

    def _object_url(self, name):
        return f"{self.base_url}/object/{self.bucket}/{quote(name)}"

    def _save(self, name, content):
        content.seek(0)
        content_type = getattr(content, "content_type", None) or "application/octet-stream"
        response = requests.post(
            self._object_url(name),
            data=content.read(),
            headers={**self.headers, "Content-Type": content_type, "x-upsert": "false"},
            timeout=self.timeout,
        )
        response.raise_for_status()
        return name

    def _open(self, name, mode="rb"):
        response = requests.get(
            f"{self.base_url}/object/authenticated/{self.bucket}/{quote(name)}",
            headers=self.headers,
            timeout=self.timeout,
        )
        response.raise_for_status()
        return ContentFile(response.content, name=name)

    def delete(self, name):
        requests.delete(
            f"{self.base_url}/object/{self.bucket}",
            json={"prefixes": [name]},
            headers=self.headers,
            timeout=self.timeout,
        ).raise_for_status()

    def exists(self, name):
        response = requests.head(
            f"{self.base_url}/object/authenticated/{self.bucket}/{quote(name)}",
            headers=self.headers,
            timeout=self.timeout,
        )
        return response.status_code == 200

    def url(self, name):
        response = requests.post(
            f"{self.base_url}/object/sign/{self.bucket}/{quote(name)}",
            json={"expiresIn": settings.SUPABASE_SIGNED_URL_TTL},
            headers=self.headers,
            timeout=self.timeout,
        )
        response.raise_for_status()
        return settings.SUPABASE_URL.rstrip("/") + "/storage/v1" + response.json()["signedURL"]

    def size(self, name):
        raise NotImplementedError("Supabase storage does not expose size lookups here.")
