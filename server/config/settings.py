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

    # m1ddc CLI - DDC/CI control for external displays (brightness only, so far)
    M1DDC_BIN: str = "/opt/homebrew/bin/m1ddc"

    # HTTP
    PORT: int = 8484

    # Volume step for up/down endpoints (percentage points)
    VOLUME_STEP: int = 6

    # Brightness step for external-display up/down endpoints (percentage points)
    BRIGHTNESS_STEP: int = 8

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
