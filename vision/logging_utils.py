"""Shared logging setup for the vision module."""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any


def get_vision_logger(config: dict[str, Any]) -> logging.Logger:
    """Return a singleton logger configured for console and file output."""
    logging_config = config.get("logging", {})
    log_dir = Path(logging_config.get("dir", "vision/logs"))
    log_file_name = str(logging_config.get("file_name", "vision.log")).strip() or "vision.log"
    log_level_name = str(logging_config.get("level", "INFO")).upper()
    log_level = getattr(logging, log_level_name, logging.INFO)

    log_dir.mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger("vision")
    logger.setLevel(log_level)

    if logger.handlers:
        return logger

    formatter = logging.Formatter(
        "%(asctime)s %(levelname)s %(name)s %(message)s",
        "%Y-%m-%dT%H:%M:%SZ",
    )
    formatter.converter = time.gmtime

    file_handler = logging.FileHandler(log_dir / log_file_name, encoding="utf-8")
    file_handler.setLevel(log_level)
    file_handler.setFormatter(formatter)

    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_level)
    console_handler.setFormatter(formatter)

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    logger.propagate = False
    return logger
