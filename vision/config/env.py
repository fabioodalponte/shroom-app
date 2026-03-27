"""Environment loading for remote persistence settings."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class SupabaseEnvConfig:
    url: str
    key: str
    storage_bucket: str
    env_file_path: str | None = None
    env_file_loaded: bool = False

    @property
    def has_api_access(self) -> bool:
        return bool(self.url and self.key)

    @property
    def is_ready(self) -> bool:
        return bool(self.has_api_access and self.storage_bucket)


def _resolve_env_file_path() -> Path:
    configured = os.getenv("VISION_ENV_FILE", "").strip()
    if configured:
        return Path(configured).expanduser().resolve()
    return (Path(__file__).resolve().parent / ".env.local").resolve()


def _strip_optional_quotes(value: str) -> str:
    stripped = value.strip()
    if len(stripped) >= 2 and stripped[0] == stripped[-1] and stripped[0] in {"'", '"'}:
        return stripped[1:-1]
    return stripped


def _load_env_file_defaults() -> tuple[Path, bool]:
    env_file = _resolve_env_file_path()
    if not env_file.exists() or not env_file.is_file():
        return env_file, False

    for raw_line in env_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].strip()
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if not key:
            continue
        os.environ.setdefault(key, _strip_optional_quotes(value))

    return env_file, True


def load_supabase_env() -> SupabaseEnvConfig:
    env_file, env_file_loaded = _load_env_file_defaults()
    return SupabaseEnvConfig(
        url=os.getenv("SUPABASE_URL", "").strip(),
        key=(os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip(),
        storage_bucket=(os.getenv("SUPABASE_STORAGE_BUCKET") or os.getenv("VISION_STORAGE_BUCKET") or "").strip(),
        env_file_path=str(env_file),
        env_file_loaded=env_file_loaded,
    )
