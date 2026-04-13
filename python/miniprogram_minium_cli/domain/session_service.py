"""会话服务层。"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from ..adapters.minium.runtime import MiniumRuntimeAdapter
from ..support.artifacts import ArtifactManager
from ..support.i18n import t
from .errors import CliExecutionError, ErrorCode
from .session_repository import SessionRepository

SessionMode = Literal["launch", "attach"]


@dataclass(slots=True)
class SessionService:
    """会话服务。"""

    repository: SessionRepository
    runtime_adapter: MiniumRuntimeAdapter
    artifact_manager: ArtifactManager

    def create_session(
        self,
        mode: SessionMode = "launch",
        initial_page_path: str | None = None,
        metadata: dict[str, Any] | None = None,
        project_path: str | None = None,
    ) -> dict[str, Any]:
        """创建一个执行会话。"""
        self._cleanup_expired_sessions()
        runtime_state = self.runtime_adapter.start_session(
            mode=mode,
            initial_page_path=initial_page_path,
            metadata=metadata or {},
            project_path=self._resolve_project_path(project_path),
        )
        session = self.repository.create(
            metadata={
                "mode": mode,
                "runtime_backend": runtime_state["backend"],
                "runtime_connected": runtime_state["connected"],
                "runtime_driver": runtime_state.get("runtime_driver"),
                "runtime_app": runtime_state.get("runtime_app"),
                "runtime_note": runtime_state.get("note"),
                "test_port": runtime_state.get("test_port"),
                "bridge_state": runtime_state.get("bridge_state"),
                "project_appid": runtime_state.get("project_appid"),
                "uses_tourist_appid": runtime_state.get("uses_tourist_appid", False),
                "project_path": str(self._resolve_project_path(project_path)) if project_path else None,
            }
        )
        session.current_page_path = runtime_state["current_page_path"]
        self.repository.update(session)

        return {
            "session_id": session.session_id,
            "mode": mode,
            "current_page_path": session.current_page_path,
            "environment": runtime_state["environment"],
            "runtime_backend": runtime_state["backend"],
            "runtime_note": runtime_state.get("note"),
            "test_port": runtime_state.get("test_port"),
            "project_appid": runtime_state.get("project_appid"),
            "uses_tourist_appid": runtime_state.get("uses_tourist_appid", False),
        }

    def close_session(self, session_id: str) -> dict[str, Any]:
        """关闭一个活动会话。"""
        self._cleanup_expired_sessions()
        session = self.require_session(session_id)
        self.runtime_adapter.stop_session(session.metadata)
        self.repository.delete(session.session_id)
        return {
            "session_id": session_id,
            "closed": True,
        }

    def get_current_page(self, session_id: str) -> dict[str, Any]:
        """读取当前页面信息。"""
        session = self.require_session(session_id)
        page_state = self.runtime_adapter.get_current_page(
            session.metadata,
            session.current_page_path,
        )
        session.current_page_path = page_state["current_page_path"]
        self.repository.update(session)
        return {
            "session_id": session_id,
            "current_page_path": session.current_page_path,
            "page_summary": page_state["page_summary"],
            "runtime_backend": session.metadata.get("runtime_backend"),
            "runtime_note": session.metadata.get("runtime_note"),
        }

    def capture_screenshot(
        self,
        session_id: str,
        prefix: str = "screenshot",
    ) -> dict[str, Any]:
        """对当前会话截图。"""
        session = self.require_session(session_id)
        target_path = self.artifact_manager.next_screenshot_path(session_id, prefix=prefix)
        screenshot_state = self.runtime_adapter.capture_screenshot(
            session_metadata=session.metadata,
            target_path=target_path,
            current_page_path=session.current_page_path,
        )
        session.latest_screenshot_path = str(target_path)
        session.current_page_path = screenshot_state["current_page_path"]
        self.repository.update(session)
        return {
            "session_id": session_id,
            "current_page_path": session.current_page_path,
            "artifact_path": str(target_path),
            "runtime_backend": session.metadata.get("runtime_backend"),
            "runtime_note": session.metadata.get("runtime_note"),
        }

    def require_session(self, session_id: str):
        """读取一个有效会话，否则抛出结构化错误。"""
        self._cleanup_expired_sessions()
        session = self.repository.get(session_id)
        if session is None:
            raise CliExecutionError(
                error_code=ErrorCode.SESSION_ERROR,
                message=t("error.invalid_session"),
                details={"session_id": session_id},
            )
        return session

    def cleanup_all(self) -> list[str]:
        """关闭并清理所有活动会话。"""
        closed_session_ids: list[str] = []
        for session_id in self.repository.list_ids():
            session = self.repository.get(session_id)
            if session is None:
                continue
            self.runtime_adapter.stop_session(session.metadata)
            self.repository.delete(session_id)
            closed_session_ids.append(session_id)
        return closed_session_ids

    def _cleanup_expired_sessions(self) -> None:
        for expired_session in self.repository.pop_expired():
            self.runtime_adapter.stop_session(expired_session.metadata)

    @staticmethod
    def _resolve_project_path(project_path: str | None) -> Path | None:
        if project_path in (None, ""):
            return None
        return Path(project_path).expanduser().resolve()
