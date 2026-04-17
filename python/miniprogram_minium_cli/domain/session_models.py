"""会话领域模型。"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from .network_models import NetworkState


def utcnow() -> datetime:
    """返回当前 UTC 时间。"""
    return datetime.now(timezone.utc)


@dataclass(slots=True)
class ActivePointer:
    """单个活跃触点摘要。"""

    pointer_id: int
    x: float
    y: float
    source: str
    target: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "pointerId": self.pointer_id,
            "x": self.x,
            "y": self.y,
            "source": self.source,
            "target": self.target,
        }


@dataclass(slots=True)
class AcceptanceSession:
    """单个执行会话的内存态模型。"""

    session_id: str
    created_at: datetime = field(default_factory=utcnow)
    last_active_at: datetime = field(default_factory=utcnow)
    current_page_path: str | None = None
    latest_screenshot_path: str | None = None
    latest_failure_summary: str | None = None
    active_pointers: dict[int, ActivePointer] = field(default_factory=dict)
    latest_gesture_event: dict[str, Any] | None = None
    network_state: NetworkState = field(default_factory=NetworkState)
    metadata: dict[str, Any] = field(default_factory=dict)

    def touch(self) -> None:
        """刷新最近活跃时间。"""
        self.last_active_at = utcnow()

    def active_pointer_summary(self) -> list[dict[str, Any]]:
        """返回稳定排序的活跃触点摘要。"""
        return [
            self.active_pointers[pointer_id].to_dict()
            for pointer_id in sorted(self.active_pointers)
        ]
