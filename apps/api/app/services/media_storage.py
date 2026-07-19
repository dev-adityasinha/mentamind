"""Media storage backends for uploaded audio.

Two backends are supported, selected by ``settings.storage_backend``:

* ``"local"`` – write to the local filesystem under ``settings.media_dir`` and
  serve via the app's ``/media`` mount. Simple, but the file lives on the
  container's disk, which is ephemeral on hosts like Render (wiped on every
  deploy). Fine for local development only.

* ``"r2"`` – upload to a Cloudflare R2 bucket (S3-compatible) and return a
  public HTTPS URL. Files persist across deploys and are served over HTTPS with
  zero egress cost, which is what production should use.

The public function is ``store_audio(data, filename, content_type)`` which
returns the public URL to store as a track's ``audio_url``.

R2 setup (once, in the Cloudflare dashboard):
  1. Create an R2 bucket.
  2. Enable public access for the bucket (R2.dev subdomain) OR attach a custom
     domain. Copy that public base URL.
  3. Create an R2 API token (Account > R2 > Manage API Tokens) with
     Object Read & Write. Copy the Access Key ID and Secret Access Key.
  4. Set these env vars on the API service:
       STORAGE_BACKEND=r2
       R2_ACCOUNT_ID=<your account id>
       R2_ACCESS_KEY_ID=<access key id>
       R2_SECRET_ACCESS_KEY=<secret access key>
       R2_BUCKET=<bucket name>
       R2_PUBLIC_BASE_URL=https://<your-public-r2-domain>
"""

from __future__ import annotations

import os

from app.settings import settings


class MediaStorageError(Exception):
    """Raised when an upload to the configured storage backend fails."""


def _store_local(data: bytes, filename: str) -> str:
    """Write bytes to the local media dir and return the /media URL."""
    media_dir = settings.media_dir
    os.makedirs(media_dir, exist_ok=True)
    dest_path = os.path.join(media_dir, filename)
    with open(dest_path, "wb") as out:
        out.write(data)
    return f"{settings.media_base_url.rstrip('/')}/{filename}"


def _store_r2(data: bytes, filename: str, content_type: str) -> str:
    """Upload bytes to a Cloudflare R2 bucket and return the public HTTPS URL.

    boto3 is imported lazily so the (fairly heavy) AWS SDK is only loaded when an
    upload actually happens, keeping startup memory low on small instances.
    """
    account_id = settings.r2_account_id
    access_key = settings.r2_access_key_id
    secret_key = settings.r2_secret_access_key
    bucket = settings.r2_bucket
    public_base = settings.r2_public_base_url.rstrip("/")

    if not all([account_id, access_key, secret_key, bucket, public_base]):
        raise MediaStorageError(
            "R2 storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, "
            "R2_SECRET_ACCESS_KEY, R2_BUCKET, and R2_PUBLIC_BASE_URL."
        )

    try:
        import boto3
        from botocore.config import Config
        from botocore.exceptions import BotoCoreError, ClientError
    except ImportError as exc:  # pragma: no cover
        raise MediaStorageError(
            "boto3 is required for the R2 storage backend but is not installed."
        ) from exc

    endpoint = f"https://{account_id}.r2.cloudflarestorage.com"
    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        # R2 requires the 'auto' region and SigV4.
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )

    try:
        client.put_object(
            Bucket=bucket,
            Key=filename,
            Body=data,
            ContentType=content_type,
        )
    except (BotoCoreError, ClientError) as exc:
        raise MediaStorageError(f"Upload to R2 failed: {exc}") from exc

    return f"{public_base}/{filename}"


async def store_audio(data: bytes, filename: str, content_type: str) -> str:
    """Store audio bytes with the configured backend and return the public URL."""
    if settings.storage_backend == "r2":
        return _store_r2(data, filename, content_type)
    return _store_local(data, filename)
