from pydantic import Field, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = (
        "postgresql+asyncpg://mentamind:mentamind@localhost:5432/mentamind"
    )
    redis_url: str = "redis://localhost:6379/0"
    api_secret_key: str = "change-me-in-production"
    environment: str = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # AES-256-GCM key for application-layer field encryption.
    # Must be base64-encoded 32 bytes. Generate with: openssl rand -base64 32
    encryption_key: str = ""

    # CORS: allowed frontend origins, stored as a raw string so pydantic-settings
    # does NOT try to JSON-parse it (which crashes on a plain URL). Reads the
    # CORS_ORIGINS env var via alias. Accepts a comma-separated string OR a JSON
    # array. Consumers read `cors_origins` (the computed list below).
    cors_origins_raw: str = Field(
        default="http://localhost:3000", validation_alias="CORS_ORIGINS"
    )

    # Set to True when the API runs behind a reverse proxy that sets X-Forwarded-For.
    # Only enable in controlled environments where the proxy is trusted.
    behind_proxy: bool = False

    # Auth endpoint IP-based rate limits.
    auth_login_rate_limit_calls: int = 5
    auth_login_rate_limit_window: int = 900  # 15 minutes
    auth_register_rate_limit_calls: int = 3
    auth_register_rate_limit_window: int = 3600  # 1 hour

    # The one email address that may hold the ADMIN role and grant it to others.
    # Changing this in production requires a matching DB update.
    super_admin_email: str = "zaid@mentamind.in"

    invitation_expire_days: int = 7

    resend_api_key: str | None = None
    frontend_url: str = "http://localhost:3000"

    # Notification service
    # Quiet window is UTC-based. Start is inclusive, end is exclusive.
    # Default: 22:00-07:00 UTC (wrap-around midnight).
    notification_quiet_start: int = 22
    notification_quiet_end: int = 7
    # Rate cap: max sends per user per category within the rolling window.
    notification_rate_window_seconds: int = 86400  # 24 h

    # SAML 2.0 SSO (OneLogin / python3-saml)
    saml_strict: bool = True
    saml_debug: bool = False
    saml_sp_entity_id: str = "mentamind-sp"
    saml_sp_acs_url: str = "http://localhost:8000/auth/saml/acs"
    saml_idp_entity_id: str = ""
    saml_idp_sso_url: str = ""
    saml_idp_x509_cert: str = ""

    groq_api_key: str | None = None
    groq_model: str = "llama-3.3-70b-versatile"
    groq_base_url: str = "https://api.groq.com/openai/v1"

    # Media storage backend: "local" (filesystem) or "r2" (Cloudflare R2).
    # Use "local" for development and "r2" in production, since a container's
    # local disk is ephemeral and uploads would be lost on every deploy.
    storage_backend: str = "local"

    # Local backend (development).
    # media_dir is where files are written on the API container's filesystem.
    media_dir: str = "/app/media"
    # Public base URL for the local /media mount. Set to the API's own origin.
    media_base_url: str = "http://localhost:8000/media"

    # Cloudflare R2 backend (production). See services/media_storage.py for the
    # one-time bucket + API-token setup steps.
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = ""
    # Public HTTPS base URL of the bucket (R2.dev subdomain or a custom domain),
    # e.g. https://pub-xxxx.r2.dev  — the uploaded filename is appended to this.
    r2_public_base_url: str = ""

    # Max upload size for audio files, in megabytes.
    max_audio_upload_mb: int = 50

    # Background reminder scheduler (mood / meditation / assessment reminders).
    reminders_enabled: bool = True

    @computed_field  # type: ignore[prop-decorator]
    @property
    def cors_origins(self) -> list[str]:
        """Parse the raw CORS value into a list of origins.

        Accepts a JSON array (``["https://a.com"]``) or a comma-separated
        string (``https://a.com, https://b.com``) or a single URL. Returns an
        empty list only if the value is blank.
        """
        s = self.cors_origins_raw.strip()
        if not s:
            return []
        if s.startswith("["):
            import json

            try:
                parsed = json.loads(s)
                if isinstance(parsed, list):
                    return [str(i).strip() for i in parsed if str(i).strip()]
            except json.JSONDecodeError:
                pass
        return [part.strip() for part in s.split(",") if part.strip()]

    @field_validator("database_url")
    @classmethod
    def _ensure_async_driver(cls, v: str) -> str:
        """Normalize the DB URL to the asyncpg driver.

        Managed hosts (e.g. Render, Heroku) hand out URLs with a bare
        ``postgresql://`` or legacy ``postgres://`` scheme. SQLAlchemy's async
        engine and this app's Alembic env both require the ``+asyncpg`` driver,
        so we rewrite the scheme when the driver is absent. URLs that already
        specify a driver (``postgresql+asyncpg://`` / ``postgresql+psycopg://``)
        are left untouched.
        """
        if v.startswith("postgresql+"):
            return v
        if v.startswith("postgresql://"):
            return "postgresql+asyncpg://" + v[len("postgresql://") :]
        if v.startswith("postgres://"):
            return "postgresql+asyncpg://" + v[len("postgres://") :]
        return v


settings = Settings()
