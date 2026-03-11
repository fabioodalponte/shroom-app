"""Config loader for the vision module.

The module uses JSON to avoid extra dependencies on the Raspberry Pi.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def load_vision_config(path: str | Path) -> dict[str, Any]:
    config_path = Path(path).expanduser().resolve()
    if not config_path.exists():
        raise FileNotFoundError(f"Vision config not found: {config_path}")

    with config_path.open("r", encoding="utf-8") as file:
        return json.load(file)
