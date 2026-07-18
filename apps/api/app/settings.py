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

    # CORS: comma-separated list of allowed frontend origins.
    cors_origins: list[str] = ["http://localhost:3000"]

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

    # Media storage (uploaded meditation audio, etc.).
    # media_dir is where files are written on the API container's filesystem;
    # mount a Docker volume here so uploads survive rebuilds.
    media_dir: str = "/app/media"
    # Public base URL the frontend uses to fetch stored media. In development
    # this points at the API's own /media mount. In production set this to a
    # CDN / object-store URL.
    media_base_url: str = "http://localhost:8000/media"
    # Max upload size for audio files, in megabytes.
    max_audio_upload_mb: int = 50

    # Background reminder scheduler (mood / meditation / assessment reminders).
    reminders_enabled: bool = True


settings = Settings()
