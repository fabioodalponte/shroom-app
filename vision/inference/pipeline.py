"""Placeholder inference pipeline.

There is no AI model in this first cut.
The pipeline only emits structured metadata so the rest of the system can
be wired and tested before model work starts.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class VisionInferencePipeline:
    """Stub that returns deterministic metadata for future expansion."""

    def __init__(self, config: dict[str, Any]) -> None:
        self.config = config
        self.mode = config.get("inference", {}).get("mode", "stub")
        self.target_labels = config.get("inference", {}).get("target_labels", [])

    def run(self, image_path: Path, capture_metadata: dict[str, Any]) -> dict[str, Any]:
        return {
            "executed_at": datetime.now(timezone.utc).isoformat(),
            "mode": self.mode,
            "image_path": str(image_path),
            "capture_metadata": capture_metadata,
            "summary": {
                "blocos_detectados": 0,
                "contaminacao_visual_detectada": False,
                "colonizacao_estimada": None,
            },
            "detections": [],
            "notes": [
                "Pipeline stub executado sem IA real.",
                "Use este contrato para ligar persistencia, dataset e futuras rotinas de modelo."
            ],
            "target_labels": self.target_labels,
        }
