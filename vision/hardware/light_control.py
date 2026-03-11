"""Lighting control abstraction for scheduled captures.

This first version is intentionally a stub so the vision scheduler can be wired
without depending on GPIO or relay integration yet.
"""

from __future__ import annotations

import logging
from typing import Any


def turn_light_on(config: dict[str, Any] | None = None, logger: logging.Logger | None = None) -> None:
    """Turn the room light on for image capture.

    Stub implementation: only logs the action. Future versions can proxy the
    room controller or GPIO here without changing the runner contract.
    """
    active_logger = logger or logging.getLogger("vision")
    active_logger.info("vision light_on")


def turn_light_off(config: dict[str, Any] | None = None, logger: logging.Logger | None = None) -> None:
    """Turn the room light off after image capture.

    Stub implementation: only logs the action. Future versions can proxy the
    room controller or GPIO here without changing the runner contract.
    """
    active_logger = logger or logging.getLogger("vision")
    active_logger.info("vision light_off")
