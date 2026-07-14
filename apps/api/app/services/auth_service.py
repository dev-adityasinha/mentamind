import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from jose import JWTError, jwt

from app.settings import settings

_ph = PasswordHasher()


def hash_email(email: str) -> str:
    return hashlib.sha256(email.strip().lower().encode()).hexdigest()


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        _ph.verify(hashed, plain)
        return True
    except VerifyMismatchError:
        return False


def create_access_token(user_id: uuid.UUID, org_id: uuid.UUID, role: str) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": str(user_id),
        "org_id": str(org_id),
        "role": role,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(
        payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
    )


def decode_access_token(token: str) -> dict:
    """Decode and validate an access token. Raises JWTError if invalid."""
    payload = jwt.decode(
        token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
    )
    if payload.get("type") != "access":
        raise JWTError("Not an access token")
    return payload


_PLACEHOLDER = "change-me-in-production"
_JWT_MIN_BITS = 256
_API_MIN_BITS = 128


def validate_secret_keys() -> None:
    """Raise at startup if JWT_SECRET_KEY or API_SECRET_KEY are missing or
    still set to the placeholder default.

    Must be called during the app lifespan so that a misconfigured
    deployment fails to boot rather than silently using weak keys.
    """
    if not settings.jwt_secret_key or settings.jwt_secret_key == _PLACEHOLDER:
        raise RuntimeError(
            "JWT_SECRET_KEY is not set or still has the default placeholder. "
            "Generate a strong key with: "
            'python3 -c "import secrets; print(secrets.token_hex(64))"',
        )
    if len(settings.jwt_secret_key.encode("utf-8")) * 4 < _JWT_MIN_BITS:
        raise RuntimeError(
            f"JWT_SECRET_KEY is too short ({len(settings.jwt_secret_key)} chars). "
            f"Minimum {_JWT_MIN_BITS // 4} characters recommended for HMAC."
        )

    if not settings.api_secret_key or settings.api_secret_key == _PLACEHOLDER:
        raise RuntimeError(
            "API_SECRET_KEY is not set or still has the default placeholder. "
            "Generate a strong key with: "
            'python3 -c "import secrets; print(secrets.token_hex(32))"',
        )
    if len(settings.api_secret_key.encode("utf-8")) * 4 < _API_MIN_BITS:
        raise RuntimeError(
            f"API_SECRET_KEY is too short ({len(settings.api_secret_key)} chars)."
        )


def generate_refresh_token() -> tuple[str, str]:
    """Return (raw_token, token_hash). Store only the hash."""
    raw = str(uuid.uuid4())
    return raw, hash_token(raw)


def generate_invite_token() -> tuple[str, str]:
    """Return (raw_token, token_hash) for an invitation. Store only the hash.

    Uses secrets.token_urlsafe(32) (256 bits) instead of uuid4 (122 bits)
    because invite tokens are shared externally and the higher entropy margin
    is worth the small size increase.
    """
    raw = secrets.token_urlsafe(32)
    return raw, hash_token(raw)


def create_verification_token(email: str) -> str:
    expire = datetime.now(UTC) + timedelta(hours=24)
    payload = {"sub": email, "exp": expire, "type": "verify_email"}
    return jwt.encode(
        payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
    )


def decode_verification_token(token: str) -> str:
    """Decode and validate a verification token.
    Returns email. Raises JWTError if invalid.
    """
    payload = jwt.decode(
        token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
    )
    if payload.get("type") != "verify_email":
        raise JWTError("Not a verification token")
    return payload.get("sub")


def create_password_reset_token(email: str) -> str:
    expire = datetime.now(UTC) + timedelta(hours=1)
    payload = {"sub": email, "exp": expire, "type": "password_reset"}
    return jwt.encode(
        payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
    )


def decode_password_reset_token(token: str) -> str:
    """Decode and validate a password reset token.
    Returns email. Raises JWTError if invalid.
    """
    payload = jwt.decode(
        token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
    )
    if payload.get("type") != "password_reset":
        raise JWTError("Not a password reset token")
    return payload.get("sub")
