"""Application-layer AES-256-GCM encryption for sensitive free-text fields.

Encryption is done at the application layer so a raw database dump cannot
reveal plaintext. Each record gets its own random 96-bit nonce. The
associated_data argument binds the ciphertext to a specific user record,
making cross-user ciphertext copying detectable.

Key format: base64-encoded 32-byte value, set via ENCRYPTION_KEY env var.
Generate with: openssl rand -base64 32
"""

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.settings import settings

_NONCE_BYTES = 12


def _load_key() -> bytes:
    raw = getattr(settings, "encryption_key", "")
    if not raw:
        raise RuntimeError(
            "ENCRYPTION_KEY is not set. Generate with: openssl rand -base64 32"
        )
    key = base64.b64decode(raw, validate=True)
    if len(key) != 32:
        raise ValueError(
            f"ENCRYPTION_KEY must decode to exactly 32 bytes, got {len(key)}"
        )
    return key


def validate_encryption_key() -> None:
    """Raise if ENCRYPTION_KEY is missing or malformed. Call at startup."""
    _load_key()


def encrypt(plaintext: str, associated_data: bytes | None = None) -> str:
    """Encrypt plaintext with AES-256-GCM.

    Returns a base64-encoded blob: nonce (12 B) || ciphertext+tag.
    associated_data is authenticated but not encrypted. Pass the record
    owner's user_id bytes to bind the ciphertext to that user.
    """
    key = _load_key()
    nonce = os.urandom(_NONCE_BYTES)
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), associated_data)
    return base64.b64encode(nonce + ciphertext).decode("ascii")


def decrypt(token: str, associated_data: bytes | None = None) -> str:
    """Decrypt a value produced by encrypt().

    Raises cryptography.exceptions.InvalidTag if the ciphertext has been
    tampered with or the associated_data does not match.
    """
    key = _load_key()
    raw = base64.b64decode(token, validate=True)
    nonce = raw[:_NONCE_BYTES]
    ciphertext = raw[_NONCE_BYTES:]
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ciphertext, associated_data).decode("utf-8")
