"""产物目录辅助工具。"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path


class ArtifactManager:
    """Manage run-level artifact directories."""

    def __init__(self, base_dir: Path) -> None:
        self.base_dir = base_dir

    def ensure_base_dir(self) -> Path:
        self.base_dir.mkdir(parents=True, exist_ok=True)
        return self.base_dir

    def ensure_run_dir(self, run_id: str) -> Path:
        run_dir = self.ensure_base_dir() / run_id
        run_dir.mkdir(parents=True, exist_ok=True)
        return run_dir

    def summary_path(self, run_id: str) -> Path:
        return self.ensure_run_dir(run_id) / "summary.json"

    def ensure_session_dir(self, session_id: str) -> Path:
        return self.ensure_base_dir() / session_id

    def next_screenshot_path(self, session_id: str, prefix: str = "screenshot") -> Path:
        session_dir = self.ensure_session_dir(session_id)
        session_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        return session_dir / f"{prefix}-{timestamp}.png"
