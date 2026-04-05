"""手势服务层。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from ..adapters.minium.runtime import MiniumRuntimeAdapter
from ..support.artifacts import ArtifactManager
from ..support.i18n import t
from .action_models import GestureTarget
from .errors import CliExecutionError, ErrorCode
from .session_models import ActivePointer
from .session_repository import SessionRepository

_MAX_ACTIVE_POINTERS = 2


@dataclass(slots=True)
class GestureService:
    """管理跨步骤触点状态与手势执行。"""

    repository: SessionRepository
    runtime_adapter: MiniumRuntimeAdapter
    artifact_manager: ArtifactManager

    def touch_start(self, session_id: str, pointer_id: int, target: GestureTarget) -> dict[str, Any]:
        session = self._require_session(session_id)
        self._validate_pointer_id(pointer_id)
        if pointer_id in session.active_pointers:
            raise self._attach_evidence(
                session,
                CliExecutionError(
                    error_code=ErrorCode.ACTION_ERROR,
                    message=t("error.pointer_already_active"),
                    details={"pointer_id": pointer_id},
                ),
                pointer_id=pointer_id,
                event_type="touch_start",
                target=target,
            )
        self._ensure_pointer_capacity(session, pointer_id)
        return self._apply_stateful_gesture(
            session=session,
            pointer_id=pointer_id,
            event_type="touch_start",
            target=target,
            keep_pointer=True,
        )

    def touch_move(self, session_id: str, pointer_id: int, target: GestureTarget) -> dict[str, Any]:
        session = self._require_session(session_id)
        self._validate_pointer_id(pointer_id)
        if pointer_id not in session.active_pointers:
            raise self._attach_evidence(
                session,
                CliExecutionError(
                    error_code=ErrorCode.ACTION_ERROR,
                    message=t("error.pointer_not_active"),
                    details={"pointer_id": pointer_id},
                ),
                pointer_id=pointer_id,
                event_type="touch_move",
                target=target,
            )
        return self._apply_stateful_gesture(
            session=session,
            pointer_id=pointer_id,
            event_type="touch_move",
            target=target,
            keep_pointer=True,
        )

    def touch_tap(self, session_id: str, pointer_id: int, target: GestureTarget) -> dict[str, Any]:
        session = self._require_session(session_id)
        self._validate_pointer_id(pointer_id)
        if pointer_id not in session.active_pointers:
            self._ensure_pointer_capacity(session, pointer_id)
        return self._apply_stateful_gesture(
            session=session,
            pointer_id=pointer_id,
            event_type="touch_tap",
            target=target,
            keep_pointer=False,
        )

    def touch_end(self, session_id: str, pointer_id: int) -> dict[str, Any]:
        session = self._require_session(session_id)
        self._validate_pointer_id(pointer_id)
        active_pointer = session.active_pointers.get(pointer_id)
        if active_pointer is None:
            raise self._attach_evidence(
                session,
                CliExecutionError(
                    error_code=ErrorCode.ACTION_ERROR,
                    message=t("error.pointer_not_active"),
                    details={"pointer_id": pointer_id},
                ),
                pointer_id=pointer_id,
                event_type="touch_end",
            )
        return self._apply_stateful_gesture(
            session=session,
            pointer_id=pointer_id,
            event_type="touch_end",
            target=None,
            keep_pointer=False,
            fallback_target={
                "x": active_pointer.x,
                "y": active_pointer.y,
                "source": active_pointer.source,
                "target": active_pointer.target,
            },
        )

    def _apply_stateful_gesture(
        self,
        *,
        session,
        pointer_id: int,
        event_type: str,
        target: GestureTarget | None,
        keep_pointer: bool,
        fallback_target: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        try:
            gesture_state = self.runtime_adapter.perform_gesture(
                session.metadata,
                session.current_page_path,
                event_type=event_type,
                pointer_id=pointer_id,
                target=target,
                active_pointers=session.active_pointer_summary(),
                fallback_target=fallback_target,
            )
        except CliExecutionError as error:
            raise self._attach_evidence(
                session,
                error,
                pointer_id=pointer_id,
                event_type=event_type,
                target=target,
            )

        session.current_page_path = gesture_state["current_page_path"]
        resolved_target = gesture_state["resolved_target"]
        if keep_pointer:
            session.active_pointers[pointer_id] = ActivePointer(
                pointer_id=pointer_id,
                x=float(resolved_target["x"]),
                y=float(resolved_target["y"]),
                source=str(resolved_target["source"]),
                target=resolved_target["target"],
            )
        else:
            session.active_pointers.pop(pointer_id, None)

        session.latest_gesture_event = {
            "eventType": event_type,
            "pointerId": pointer_id,
            "resolvedTarget": resolved_target,
            "activePointers": session.active_pointer_summary(),
        }
        self.repository.update(session)
        return {
            "session_id": session.session_id,
            "pointer_id": pointer_id,
            "event_type": event_type,
            "resolved_target": resolved_target,
            "current_page_path": session.current_page_path,
            "active_pointers": session.active_pointer_summary(),
            "latest_gesture_event": session.latest_gesture_event,
        }

    def _attach_evidence(
        self,
        session,
        error: CliExecutionError,
        *,
        pointer_id: int,
        event_type: str,
        target: GestureTarget | None = None,
    ) -> CliExecutionError:
        details = dict(error.details)
        details["pointer_id"] = pointer_id
        details["event_type"] = event_type
        details["active_pointers"] = session.active_pointer_summary()
        if target is not None:
            details["target"] = target.to_dict()

        target_path = self.artifact_manager.next_screenshot_path(session.session_id, prefix="gesture-failure")
        try:
            screenshot_state = self.runtime_adapter.capture_screenshot(
                session_metadata=session.metadata,
                target_path=target_path,
                current_page_path=session.current_page_path,
            )
        except Exception:
            screenshot_state = None

        if screenshot_state is not None:
            session.current_page_path = screenshot_state["current_page_path"]
            session.latest_screenshot_path = screenshot_state["artifact_path"]
            details["current_page_path"] = session.current_page_path

        session.latest_failure_summary = error.message
        self.repository.update(session)

        artifact_paths = list(error.artifacts)
        if screenshot_state is not None:
            artifact_paths.append(screenshot_state["artifact_path"])
        return CliExecutionError(
            error_code=error.error_code,
            message=error.message,
            details=details,
            artifacts=artifact_paths,
        )

    @staticmethod
    def _validate_pointer_id(pointer_id: int) -> None:
        if pointer_id < 0:
            raise CliExecutionError(
                error_code=ErrorCode.PLAN_ERROR,
                message=t("error.pointer_id_invalid"),
                details={"pointer_id": pointer_id},
            )

    @staticmethod
    def _ensure_pointer_capacity(session, pointer_id: int) -> None:
        active_count = len(session.active_pointers)
        if pointer_id not in session.active_pointers and active_count >= _MAX_ACTIVE_POINTERS:
            raise CliExecutionError(
                error_code=ErrorCode.ACTION_ERROR,
                message=t("error.pointer_limit"),
                details={
                    "pointer_id": pointer_id,
                    "active_pointer_count": active_count,
                    "max_active_pointers": _MAX_ACTIVE_POINTERS,
                },
            )

    def _require_session(self, session_id: str):
        session = self.repository.get(session_id)
        if session is None:
            raise CliExecutionError(
                error_code=ErrorCode.SESSION_ERROR,
                message=t("error.invalid_session"),
                details={"session_id": session_id},
            )
        return session
