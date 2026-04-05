"""动作、等待与断言服务层。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from ..adapters.minium.runtime import MiniumRuntimeAdapter
from ..support.artifacts import ArtifactManager
from ..support.i18n import t
from .action_models import Locator, WaitCondition
from .errors import CliExecutionError, ErrorCode
from .session_repository import SessionRepository


@dataclass(slots=True)
class ActionService:
    """动作与断言服务。"""

    repository: SessionRepository
    runtime_adapter: MiniumRuntimeAdapter
    artifact_manager: ArtifactManager

    def query_elements(self, session_id: str, locator: Locator) -> dict[str, Any]:
        session = self._require_session(session_id)
        query_state = self.runtime_adapter.query_elements(
            session.metadata,
            session.current_page_path,
            locator,
        )
        session.current_page_path = query_state["current_page_path"]
        self.repository.update(session)
        return {
            "session_id": session_id,
            "locator": locator.to_dict(),
            "matches": query_state["matches"],
            "count": len(query_state["matches"]),
            "current_page_path": session.current_page_path,
        }

    def click(self, session_id: str, locator: Locator) -> dict[str, Any]:
        session = self._require_session(session_id)
        try:
            action_state = self.runtime_adapter.click_element(
                session.metadata,
                session.current_page_path,
                locator,
            )
        except CliExecutionError as error:
            raise self._attach_evidence(session, error, locator=locator)

        session.current_page_path = action_state["current_page_path"]
        self.repository.update(session)
        return {
            "session_id": session_id,
            "locator": locator.to_dict(),
            "current_page_path": session.current_page_path,
        }

    def input_text(self, session_id: str, locator: Locator, text: str) -> dict[str, Any]:
        session = self._require_session(session_id)
        try:
            action_state = self.runtime_adapter.input_text(
                session.metadata,
                session.current_page_path,
                locator,
                text,
            )
        except CliExecutionError as error:
            raise self._attach_evidence(session, error, locator=locator)

        session.current_page_path = action_state["current_page_path"]
        self.repository.update(session)
        return {
            "session_id": session_id,
            "locator": locator.to_dict(),
            "input_text": text,
            "current_page_path": session.current_page_path,
        }

    def wait_for(self, session_id: str, condition: WaitCondition) -> dict[str, Any]:
        session = self._require_session(session_id)
        try:
            wait_state = self.runtime_adapter.wait_for_condition(
                session.metadata,
                session.current_page_path,
                condition,
            )
        except CliExecutionError as error:
            raise self._attach_evidence(
                session,
                error,
                locator=condition.locator,
                extra_details={
                    "condition": condition.kind,
                    "expected_value": condition.expected_value,
                    "timeout_ms": condition.timeout_ms,
                },
            )

        session.current_page_path = wait_state["current_page_path"]
        self.repository.update(session)
        return {
            "session_id": session_id,
            "condition": condition.to_dict(),
            "current_page_path": session.current_page_path,
        }

    def assert_page_path(self, session_id: str, expected_path: str) -> dict[str, Any]:
        session = self._require_session(session_id)
        page_state = self.runtime_adapter.get_current_page(
            session.metadata,
            session.current_page_path,
        )
        actual = page_state["current_page_path"]
        session.current_page_path = actual
        self.repository.update(session)
        if actual != expected_path:
            raise self._attach_evidence(
                session,
                CliExecutionError(
                    error_code=ErrorCode.ASSERTION_FAILED,
                    message=t("error.page_path_assertion_failed"),
                    details={
                        "expected_value": expected_path,
                        "actual_value": actual,
                        "current_page_path": actual,
                    },
                ),
            )
        return {
            "session_id": session_id,
            "expected_value": expected_path,
            "actual_value": actual,
        }

    def assert_element_text(
        self,
        session_id: str,
        locator: Locator,
        expected_text: str,
    ) -> dict[str, Any]:
        session = self._require_session(session_id)
        try:
            query_state = self.runtime_adapter.query_elements(
                session.metadata,
                session.current_page_path,
                locator,
            )
        except CliExecutionError as error:
            raise self._attach_evidence(session, error, locator=locator)

        matches = query_state["matches"]
        actual_text = matches[0]["text"] if matches else None
        session.current_page_path = query_state["current_page_path"]
        self.repository.update(session)
        if actual_text != expected_text:
            raise self._attach_evidence(
                session,
                CliExecutionError(
                    error_code=ErrorCode.ASSERTION_FAILED,
                    message=t("error.element_text_assertion_failed"),
                    details={
                        "locator": locator.to_dict(),
                        "expected_value": expected_text,
                        "actual_value": actual_text,
                        "current_page_path": session.current_page_path,
                    },
                ),
                locator=locator,
            )
        return {
            "session_id": session_id,
            "locator": locator.to_dict(),
            "expected_value": expected_text,
            "actual_value": actual_text,
        }

    def assert_element_visible(self, session_id: str, locator: Locator) -> dict[str, Any]:
        session = self._require_session(session_id)
        try:
            query_state = self.runtime_adapter.query_elements(
                session.metadata,
                session.current_page_path,
                locator,
            )
        except CliExecutionError as error:
            raise self._attach_evidence(session, error, locator=locator)

        session.current_page_path = query_state["current_page_path"]
        self.repository.update(session)
        visible = bool(query_state["matches"] and query_state["matches"][0]["visible"])
        if not visible:
            raise self._attach_evidence(
                session,
                CliExecutionError(
                    error_code=ErrorCode.ASSERTION_FAILED,
                    message=t("error.element_visibility_assertion_failed"),
                    details={
                        "locator": locator.to_dict(),
                        "current_page_path": session.current_page_path,
                    },
                ),
                locator=locator,
            )
        return {
            "session_id": session_id,
            "locator": locator.to_dict(),
            "visible": True,
        }

    def _attach_evidence(
        self,
        session,
        error: CliExecutionError,
        locator: Locator | None = None,
        extra_details: dict[str, Any] | None = None,
    ) -> CliExecutionError:
        details = dict(error.details)
        if locator is not None:
            details["locator"] = locator.to_dict()
        if extra_details:
            details.update(extra_details)

        target_path = self.artifact_manager.next_screenshot_path(session.session_id, prefix="failure")
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

    def _require_session(self, session_id: str):
        session = self.repository.get(session_id)
        if session is None:
            raise CliExecutionError(
                error_code=ErrorCode.SESSION_ERROR,
                message=t("error.invalid_session"),
                details={"session_id": session_id},
            )
        return session
