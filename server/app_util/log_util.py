"""Log utility - set up before any feature code."""

import json
import logging
import os
import sys
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path

from config.settings import settings

# ── Formatters ──────────────────────────────────────────────────────────────

ANSI = {
    "DEBUG":    "\033[36m",   # cyan
    "INFO":     "\033[32m",   # green
    "WARNING":  "\033[33m",   # yellow
    "ERROR":    "\033[31m",   # red
    "CRITICAL": "\033[35m",   # magenta
    "RESET":    "\033[0m",
}


class DevFormatter(logging.Formatter):
    """Coloured, human-readable output for local development."""

    FMT = "{color}[{level}]{reset} {time} {module}:{line} - {msg}"

    def format(self, record: logging.LogRecord) -> str:
        color = ANSI.get(record.levelname, "")
        reset = ANSI["RESET"]
        time = datetime.now(timezone.utc).strftime("%H:%M:%S.%f")[:-3]
        return self.FMT.format(
            color=color,
            reset=reset,
            level=record.levelname[:4],
            time=time,
            module=record.module,
            line=record.lineno,
            msg=record.getMessage(),
        )


class JSONFormatter(logging.Formatter):
    """Structured JSON output for production."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict = {
            "level":     record.levelname,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "module":    record.module,
            "line":      record.lineno,
            "message":   record.getMessage(),
        }
        for key, val in record.__dict__.items():
            if key not in logging.LogRecord.__dict__ and not key.startswith("_"):
                payload[key] = val
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


# ── Builder ──────────────────────────────────────────────────────────────────

def _file_handler(level: int) -> logging.Handler | None:
    """Rotating file handler under LOG_DIR. Silently skipped if the dir can't be created
    (e.g. in a sandboxed test run)."""
    try:
        log_dir = Path(settings.LOG_DIR).expanduser()
        log_dir.mkdir(parents=True, exist_ok=True)
        handler = RotatingFileHandler(
            log_dir / "macremote.log",
            maxBytes=5 * 1024 * 1024,
            backupCount=3,
        )
        handler.setLevel(level)
        handler.setFormatter(JSONFormatter())
        return handler
    except OSError:
        return None


def build_logger(name: str, level: int) -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger  # already configured (e.g. re-import)

    logger.setLevel(level)

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setLevel(level)
    app_env = os.getenv("APP_ENV", settings.APP_ENV)
    stream_handler.setFormatter(DevFormatter() if app_env == "dev" else JSONFormatter())
    logger.addHandler(stream_handler)

    file_handler = _file_handler(level)
    if file_handler is not None:
        logger.addHandler(file_handler)

    logger.propagate = False
    return logger


# ── Public loggers ───────────────────────────────────────────────────────────

raw_level = os.getenv("LOG_LEVEL", settings.LOG_LEVEL).upper()
log_level = getattr(logging, raw_level, logging.DEBUG)

infologger = build_logger("macremote.info", log_level)
errorlogger = build_logger("macremote.error", logging.ERROR)
