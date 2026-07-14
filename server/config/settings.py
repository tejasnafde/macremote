"""Server configuration - pydantic-settings reading `.env`. NO SECRETS IN GIT."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_ENV: str = "dev"

    # Auth - static bearer token, defense-in-depth behind Tailscale
    API_TOKEN: str = ""

    # Discord lifecycle/error alerts - no-op when unset
    DISCORD_WEBHOOK_URL: str = ""

    # Hammerspoon IPC CLI
    HS_BIN: str = "/opt/homebrew/bin/hs"

    # HTTP
    PORT: int = 8484

    # Volume step for up/down endpoints (percentage points)
    VOLUME_STEP: int = 6

    # Logging
    LOG_LEVEL: str = "DEBUG"
    LOG_DIR: str = "~/Library/Logs/macremote"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
