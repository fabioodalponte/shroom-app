"""Environment loading for remote persistence settings."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class SupabaseEnvConfig:
    url: str
    key: str
    storage_bucket: str

    @property
    def is_ready(self) -> bool:
        return bool(self.url and self.key and self.storage_bucket)


def load_supabase_env() -> SupabaseEnvConfig:
    return SupabaseEnvConfig(
        url=os.getenv("SUPABASE_URL", "").strip(),
        key=os.getenv("SUPABASE_KEY", "").strip(),
        storage_bucket=os.getenv("SUPABASE_STORAGE_BUCKET", "").strip(),
    )
