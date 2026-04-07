"""Config loader for the vision module.

The module uses JSON to avoid extra dependencies on the Raspberry Pi.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def _infer_room_name_from_camera_name(camera_name: str) -> str | None:
    normalized = camera_name.strip().replace("_", "-").lower()
    if not normalized:
        return None

    if "colonizacao" in normalized:
        return "Colonizacao"
    if "frutificacao" in normalized:
        return "Frutificacao"
    if "sala-1" in normalized or "sala1" in normalized:
        return "Sala 1"
    return None


def load_vision_config(path: str | Path) -> dict[str, Any]:
    config_path = Path(path).expanduser().resolve()
    if not config_path.exists():
        raise FileNotFoundError(f"Vision config not found: {config_path}")

    with config_path.open("r", encoding="utf-8") as file:
        config = json.load(file)

    capture_config = config.setdefault("capture", {})
    existing_runtime = config.get("_runtime", {})
    config["_runtime"] = {
        **existing_runtime,
        "config_path": str(config_path),
        "config_name": config_path.name,
        "config_stem": config_path.stem,
    }

    room_name = str(capture_config.get("room_name", "") or "").strip()
    if not room_name:
        inferred_room_name = _infer_room_name_from_camera_name(str(capture_config.get("camera_name", "") or ""))
        if inferred_room_name:
            capture_config["room_name"] = inferred_room_name

    return config
