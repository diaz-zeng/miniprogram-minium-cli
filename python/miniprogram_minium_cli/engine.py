"""Bootstrap execution engine for miniprogram-minium-cli."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import sys
import time
from typing import Any
from uuid import uuid4

from .adapters.minium import MiniumRuntimeAdapter
from .domain.action_models import GestureTarget, Locator, WaitCondition
from .domain.action_service import ActionService
from .domain.errors import CliExecutionError, ErrorCode
from .domain.gesture_service import GestureService
from .domain.network_models import (
    NetworkAssertConfig,
    NetworkInterceptConfig,
    NetworkListenConfig,
    NetworkWaitConfig,
)
from .domain.network_service import NetworkService
from .domain.session_repository import SessionRepository
from .domain.session_service import SessionService
from .support.artifacts import ArtifactManager
from .support.config import load_runtime_config
from .support.i18n import set_language, t
from .support.logging import get_logger

PROTOCOL_VERSION = 1

_BRIDGE_STEP_TYPES = {
    "storage.set",
    "storage.get",
    "storage.info",
    "storage.remove",
    "storage.clear",
    "navigation.navigateTo",
    "navigation.redirectTo",
    "navigation.reLaunch",
    "navigation.switchTab",
    "navigation.back",
    "app.getLaunchOptions",
    "app.getSystemInfo",
    "app.getAccountInfo",
    "settings.get",
    "settings.authorize",
    "settings.open",
    "clipboard.set",
    "clipboard.get",
    "ui.showToast",
    "ui.hideToast",
    "ui.showLoading",
    "ui.hideLoading",
    "ui.showModal",
    "ui.showActionSheet",
    "location.get",
    "location.choose",
    "location.open",
    "media.chooseImage",
    "media.chooseMedia",
    "media.takePhoto",
    "media.getImageInfo",
    "media.saveImageToPhotosAlbum",
    "file.stage",
    "file.upload",
    "file.download",
    "device.scanCode",
    "device.makePhoneCall",
    "auth.login",
    "auth.checkSession",
    "subscription.requestMessage",
}

_TOURIST_APPID_RESTRICTED_STEP_TYPES = {
    "ui.showModal",
    "ui.showActionSheet",
    "settings.authorize",
    "location.get",
    "location.choose",
    "subscription.requestMessage",
}

_NETWORK_STEP_TYPES = {
    "network.listen.start",
    "network.listen.stop",
    "network.listen.clear",
    "network.wait",
    "assert.networkRequest",
    "assert.networkResponse",
    "network.intercept.add",
    "network.intercept.remove",
    "network.intercept.clear",
}


def execute_request(request: dict[str, Any]) -> dict[str, Any]:
    try:
        _validate_request(request)
        command = request["command"]
        if command != "execute_plan":
            raise CliExecutionError(
                error_code=ErrorCode.PLAN_ERROR,
                message=t("error.unsupported_command", command=command),
            )
        payload = request["payload"]
        plan = payload["plan"]
        return {
            "ok": True,
            "protocolVersion": PROTOCOL_VERSION,
            "result": _execute_plan(plan),
        }
    except CliExecutionError as error:
        return {
            "ok": False,
            "protocolVersion": PROTOCOL_VERSION,
            "error": error.to_response(),
        }


def _validate_request(request: dict[str, Any]) -> None:
    if request.get("protocolVersion") != PROTOCOL_VERSION:
        raise CliExecutionError(
            error_code=ErrorCode.PLAN_ERROR,
            message=t("error.protocol_mismatch"),
            details={
                "expected": PROTOCOL_VERSION,
                "actual": request.get("protocolVersion"),
            },
        )
    if "payload" not in request or not isinstance(request["payload"], dict):
        raise CliExecutionError(
            error_code=ErrorCode.PLAN_ERROR,
            message=t("error.request_payload_missing"),
        )
    if "plan" not in request["payload"]:
        raise CliExecutionError(
            error_code=ErrorCode.PLAN_ERROR,
            message=t("error.request_plan_missing"),
        )


def _execute_plan(plan: dict[str, Any]) -> dict[str, Any]:
    config = load_runtime_config(plan)
    set_language(config.language)
    logger = get_logger("INFO")
    run_id = _build_run_id()
    root_artifact_manager = ArtifactManager(config.artifacts_dir)
    run_dir = root_artifact_manager.ensure_run_dir(run_id)
    run_artifact_manager = ArtifactManager(run_dir)
    summary_path = root_artifact_manager.summary_path(run_id)

    repository = SessionRepository(timeout_seconds=config.session_timeout_seconds)
    runtime_adapter = MiniumRuntimeAdapter(config=config)
    session_service = SessionService(
        repository=repository,
        runtime_adapter=runtime_adapter,
        artifact_manager=run_artifact_manager,
    )
    action_service = ActionService(
        repository=repository,
        runtime_adapter=runtime_adapter,
        artifact_manager=run_artifact_manager,
    )
    gesture_service = GestureService(
        repository=repository,
        runtime_adapter=runtime_adapter,
        artifact_manager=run_artifact_manager,
    )
    network_service = NetworkService(
        repository=repository,
        runtime_adapter=runtime_adapter,
    )

    executor = _ExecutionEngine(
        session_service=session_service,
        action_service=action_service,
        gesture_service=gesture_service,
        network_service=network_service,
        logger=logger,
        auto_screenshot_mode=config.auto_screenshot,
    )
    (run_dir / "plan.json").write_text(
        json.dumps(plan, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    execution_result = executor.execute(plan)

    summary = {
        "runId": run_id,
        "status": execution_result["status"],
        "stepCount": len(plan.get("steps", [])),
        "successCount": execution_result["success_count"],
        "failedCount": execution_result["failed_count"],
        "skippedCount": execution_result["skipped_count"],
        "projectPath": str(config.project_path) if config.project_path else None,
        "artifactsDir": str(run_dir),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "durationMs": execution_result["duration_ms"],
        "pythonExecutable": sys.executable,
        "finalSessionId": execution_result["final_session_id"],
        "autoClosedSessionIds": execution_result["auto_closed_session_ids"],
    }
    if execution_result["skipped_steps"]:
        summary["skipped"] = execution_result["skipped_steps"]
    if execution_result.get("latest_page_path"):
        summary["latestPagePath"] = execution_result["latest_page_path"]
    network_meta = execution_result["network_activity"].get("meta", {})
    if network_meta.get("eventCount", 0) > 0:
        summary["networkEventCount"] = network_meta.get("eventCount")
        summary["networkSessionCount"] = network_meta.get("sessionCount")
    if execution_result.get("failure_error"):
        summary["failure"] = execution_result["failure_error"]

    summary_path.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    logger.info("Execution summary written to %s", summary_path)

    result_path = run_dir / "result.json"
    comparison_path = run_dir / "comparison.json"
    network_path = run_dir / "network.json"
    network_path.write_text(
        json.dumps(execution_result["network_activity"], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    _attach_network_artifact_path(execution_result["step_results"], str(network_path))
    result_payload = {
        "summary": summary,
        "stepResults": execution_result["step_results"],
        "artifacts": {
            "runDir": str(run_dir),
            "summaryPath": str(summary_path),
            "planPath": str(run_dir / "plan.json"),
            "resultPath": str(result_path),
            "comparisonPath": str(comparison_path),
            "networkPath": str(network_path),
            "screenshotPaths": execution_result["screenshot_paths"],
        },
        "network": execution_result["network_activity"],
        "runtime": {
            "language": config.language,
            "pythonExecutable": sys.executable,
            "runtimeMode": config.runtime_mode,
            "autoScreenshot": config.auto_screenshot,
        },
    }
    result_path.write_text(
        json.dumps(result_payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    comparison_path.write_text(
        json.dumps(_build_comparison_payload(result_payload), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    logger.info("Execution result written to %s", result_path)
    logger.info("Stable comparison result written to %s", comparison_path)

    return result_payload


def _build_run_id() -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return f"run-{timestamp}-{uuid4().hex[:8]}"


def _build_comparison_payload(result_payload: dict[str, Any]) -> dict[str, Any]:
    summary = dict(result_payload["summary"])
    summary.pop("runId", None)
    summary.pop("createdAt", None)
    summary.pop("durationMs", None)
    summary.pop("pythonExecutable", None)
    summary.pop("artifactsDir", None)
    summary.pop("finalSessionId", None)
    summary.pop("autoClosedSessionIds", None)
    if isinstance(summary.get("failure"), dict):
        failure = dict(summary["failure"])
        artifacts = failure.pop("artifacts", [])
        failure["artifactCount"] = len(artifacts) if isinstance(artifacts, list) else 0
        summary["failure"] = failure

    return {
        "summary": summary,
        "stepResults": [_normalize_step_for_comparison(step) for step in result_payload["stepResults"]],
        "runtime": {
            "language": result_payload["runtime"]["language"],
            "runtimeMode": result_payload["runtime"]["runtimeMode"],
        },
    }


def _normalize_step_for_comparison(step: dict[str, Any]) -> dict[str, Any]:
    normalized = {
        "id": step.get("id"),
        "type": step.get("type"),
        "ok": step.get("ok"),
        "status": step.get("status"),
    }
    if isinstance(step.get("output"), dict):
        normalized["output"] = _strip_volatile_fields(step["output"])
    if isinstance(step.get("error"), dict):
        normalized_error = _strip_volatile_fields(step["error"])
        if isinstance(normalized_error.get("artifacts"), list):
            normalized_error["artifactCount"] = len(normalized_error["artifacts"])
            normalized_error.pop("artifacts", None)
        normalized["error"] = normalized_error
    return normalized


def _attach_network_artifact_path(step_results: list[dict[str, Any]], network_path: str) -> None:
    for step_result in step_results:
        details = step_result.get("details")
        if not isinstance(details, dict):
            continue
        network_evidence = details.get("networkEvidence")
        if not isinstance(network_evidence, list):
            continue
        for item in network_evidence:
            if not isinstance(item, dict):
                continue
            item["artifactPath"] = network_path


def _strip_volatile_fields(value: Any) -> Any:
    if isinstance(value, dict):
        volatile_keys = {
            "session_id",
            "sessionId",
            "artifact_path",
            "artifactsDir",
            "summaryPath",
            "resultPath",
            "planPath",
            "comparisonPath",
            "runDir",
            "durationMs",
            "createdAt",
            "runId",
            "pythonExecutable",
            "auto_screenshot_artifact_path",
            "screenshotPaths",
        }
        return {
            key: _strip_volatile_fields(item)
            for key, item in value.items()
            if key not in volatile_keys
        }
    if isinstance(value, list):
        return [_strip_volatile_fields(item) for item in value]
    return value


class _ExecutionEngine:
    """顺序执行计划步骤。"""

    def __init__(
        self,
        session_service: SessionService,
        action_service: ActionService,
        gesture_service: GestureService,
        network_service: NetworkService,
        logger,
        auto_screenshot_mode: str,
    ) -> None:
        self._session_service = session_service
        self._action_service = action_service
        self._gesture_service = gesture_service
        self._network_service = network_service
        self._logger = logger
        self._auto_screenshot_mode = auto_screenshot_mode
        self._current_session_id: str | None = None
        self._latest_page_path: str | None = None
        self._screenshot_paths: list[str] = []
        self._closed_network_sessions: list[dict[str, Any]] = []

    def execute(self, plan: dict[str, Any]) -> dict[str, Any]:
        step_results: list[dict[str, Any]] = []
        status = "passed"
        fail_fast = bool(plan.get("execution", {}).get("failFast", True))
        started_at = time.perf_counter()
        failure_error: dict[str, Any] | None = None
        steps = list(plan.get("steps", []))

        try:
            for index, step in enumerate(steps):
                step_result = self._execute_step(step)
                step_results.append(step_result)
                if not step_result["ok"]:
                    status = "failed"
                    failure_error = step_result.get("error")
                    if fail_fast:
                        for skipped_step in steps[index + 1 :]:
                            step_results.append(
                                {
                                    "id": skipped_step.get("id"),
                                    "type": skipped_step.get("type"),
                                    "ok": False,
                                    "status": "skipped",
                                    "output": None,
                                    "durationMs": 0,
                                }
                            )
                        break
        finally:
            network_activity = self._network_service.export_state(self._closed_network_sessions)
            auto_closed_session_ids = self._session_service.cleanup_all()

        success_count = sum(1 for item in step_results if item.get("status") == "passed")
        failed_count = sum(1 for item in step_results if item.get("status") == "failed")
        skipped_count = sum(1 for item in step_results if item.get("status") == "skipped")
        skipped_steps = [
            {
                "id": item.get("id"),
                "type": item.get("type"),
                "reason": (item.get("output") or {}).get("skip_reason")
                if isinstance(item.get("output"), dict)
                else None,
            }
            for item in step_results
            if item.get("status") == "skipped"
        ]

        return {
            "status": status,
            "success_count": success_count,
            "failed_count": failed_count,
            "skipped_count": skipped_count,
            "skipped_steps": skipped_steps,
            "step_results": step_results,
            "latest_page_path": self._latest_page_path,
            "final_session_id": self._current_session_id,
            "auto_closed_session_ids": auto_closed_session_ids,
            "duration_ms": int((time.perf_counter() - started_at) * 1000),
            "failure_error": failure_error,
            "screenshot_paths": list(dict.fromkeys(self._screenshot_paths)),
            "network_activity": network_activity,
        }

    def _execute_step(self, step: dict[str, Any]) -> dict[str, Any]:
        step_type = step["type"]
        step_id = step.get("id")
        input_data = step.get("input", {})
        started_at = time.perf_counter()
        network_session_id: str | None = None

        skip_result = self._maybe_skip_step(step_type, input_data)
        if skip_result is not None:
            return {
                "id": step.get("id"),
                "type": step_type,
                "ok": True,
                "status": "skipped",
                "output": skip_result,
                "durationMs": int((time.perf_counter() - started_at) * 1000),
            }

        try:
            if step_type == "session.start":
                output = self._session_service.create_session(
                    mode=input_data.get("mode", "launch"),
                    initial_page_path=input_data.get("initialPagePath"),
                    project_path=input_data.get("projectPath"),
                )
                self._current_session_id = output["session_id"]
                self._latest_page_path = output.get("current_page_path")
            elif step_type == "page.read":
                output = self._session_service.get_current_page(self._require_session_id(input_data))
                self._latest_page_path = output.get("current_page_path")
            elif step_type == "element.query":
                locator = Locator.from_input(input_data.get("locator"))
                output = self._action_service.query_elements(self._require_session_id(input_data), locator)
                self._latest_page_path = output.get("current_page_path")
            elif step_type == "element.click":
                locator = Locator.from_input(input_data.get("locator"))
                output = self._action_service.click(self._require_session_id(input_data), locator)
                self._latest_page_path = output.get("current_page_path")
            elif step_type == "element.input":
                locator = Locator.from_input(input_data.get("locator"))
                text = str(input_data.get("text", ""))
                output = self._action_service.input_text(self._require_session_id(input_data), locator, text)
                self._latest_page_path = output.get("current_page_path")
            elif step_type == "wait.for":
                condition = WaitCondition.from_input(input_data.get("condition"))
                output = self._action_service.wait_for(self._require_session_id(input_data), condition)
                self._latest_page_path = output.get("current_page_path")
            elif step_type == "assert.pagePath":
                expected_path = str(input_data.get("expectedPath", ""))
                output = self._action_service.assert_page_path(
                    self._require_session_id(input_data),
                    expected_path,
                )
            elif step_type == "assert.elementText":
                locator = Locator.from_input(input_data.get("locator"))
                expected_text = str(input_data.get("expectedText", ""))
                output = self._action_service.assert_element_text(
                    self._require_session_id(input_data),
                    locator,
                    expected_text,
                )
            elif step_type == "assert.elementVisible":
                locator = Locator.from_input(input_data.get("locator"))
                output = self._action_service.assert_element_visible(
                    self._require_session_id(input_data),
                    locator,
                )
            elif step_type == "network.listen.start":
                network_session_id = self._require_session_id(input_data)
                output = self._network_service.start_listener(
                    network_session_id,
                    NetworkListenConfig.from_input(input_data),
                    step_id=step_id,
                )
            elif step_type == "network.listen.stop":
                network_session_id = self._require_session_id(input_data)
                output = self._network_service.stop_listener(
                    network_session_id,
                    str(input_data["listenerId"]),
                    step_id=step_id,
                )
            elif step_type == "network.listen.clear":
                network_session_id = self._require_session_id(input_data)
                output = self._network_service.clear_listener_events(
                    network_session_id,
                    input_data.get("listenerId"),
                    step_id=step_id,
                )
            elif step_type == "network.wait":
                network_session_id = self._require_session_id(input_data)
                output = self._network_service.wait_for_event(
                    network_session_id,
                    NetworkWaitConfig.from_input(input_data),
                    step_id=step_id,
                )
            elif step_type == "assert.networkRequest":
                network_session_id = self._require_session_id(input_data)
                output = self._network_service.assert_request(
                    network_session_id,
                    NetworkAssertConfig.from_input(input_data),
                    step_id=step_id,
                )
            elif step_type == "assert.networkResponse":
                network_session_id = self._require_session_id(input_data)
                output = self._network_service.assert_response(
                    network_session_id,
                    NetworkAssertConfig.from_input(input_data),
                    step_id=step_id,
                )
            elif step_type == "network.intercept.add":
                network_session_id = self._require_session_id(input_data)
                output = self._network_service.add_intercept_rule(
                    network_session_id,
                    NetworkInterceptConfig.from_input(input_data),
                    step_id=step_id,
                )
            elif step_type == "network.intercept.remove":
                network_session_id = self._require_session_id(input_data)
                output = self._network_service.remove_intercept_rule(
                    network_session_id,
                    str(input_data["ruleId"]),
                    step_id=step_id,
                )
            elif step_type == "network.intercept.clear":
                network_session_id = self._require_session_id(input_data)
                output = self._network_service.clear_intercept_rules(
                    network_session_id,
                    step_id=step_id,
                )
            elif step_type in _BRIDGE_STEP_TYPES:
                output = self._action_service.execute_bridge_action(
                    self._require_session_id(input_data),
                    step_type,
                    input_data,
                )
                self._latest_page_path = output.get("current_page_path")
            elif step_type == "gesture.touchStart":
                target = GestureTarget.from_input(input_data)
                output = self._gesture_service.touch_start(
                    self._require_session_id(input_data),
                    int(input_data["pointerId"]),
                    target,
                )
                self._latest_page_path = output.get("current_page_path")
            elif step_type == "gesture.touchMove":
                target = GestureTarget.from_input(input_data)
                output = self._gesture_service.touch_move(
                    self._require_session_id(input_data),
                    int(input_data["pointerId"]),
                    target,
                )
                self._latest_page_path = output.get("current_page_path")
            elif step_type == "gesture.touchTap":
                target = GestureTarget.from_input(input_data)
                output = self._gesture_service.touch_tap(
                    self._require_session_id(input_data),
                    int(input_data["pointerId"]),
                    target,
                )
                self._latest_page_path = output.get("current_page_path")
            elif step_type == "gesture.touchEnd":
                output = self._gesture_service.touch_end(
                    self._require_session_id(input_data),
                    int(input_data["pointerId"]),
                )
                self._latest_page_path = output.get("current_page_path")
            elif step_type == "artifact.screenshot":
                output = self._session_service.capture_screenshot(
                    self._require_session_id(input_data),
                    prefix=input_data.get("prefix", "screenshot"),
                )
                self._latest_page_path = output.get("current_page_path")
            elif step_type == "session.close":
                if self._should_capture_after_success() and self._current_session_id:
                    auto_capture = self._capture_auto_screenshot(step, prefix="before-close")
                    if auto_capture is not None:
                        output = auto_capture
                closing_session_id = self._require_session_id(input_data)
                self._closed_network_sessions.append(self._network_service.snapshot_session(closing_session_id))
                output = self._session_service.close_session(closing_session_id)
                self._current_session_id = None
            else:
                raise CliExecutionError(
                    error_code=ErrorCode.PLAN_ERROR,
                    message=t("error.step_not_implemented", step_type=step_type),
                    details={"step_id": step.get("id"), "step_type": step_type},
                )
        except CliExecutionError as error:
            if self._auto_screenshot_mode == "always" and self._current_session_id is not None:
                auto_capture = self._capture_auto_screenshot(step, prefix="failure")
                if auto_capture is not None:
                    error_artifacts = list(error.artifacts)
                    error_artifacts.append(auto_capture["artifact_path"])
                    error = CliExecutionError(
                        error_code=error.error_code,
                        message=error.message,
                        details=error.details,
                        artifacts=list(dict.fromkeys(error_artifacts)),
                    )
            self._record_error_artifacts(error)
            self._logger.error("Step %s (%s) failed: %s", step.get("id"), step_type, error.message)
            failure_result = {
                "id": step.get("id"),
                "type": step_type,
                "ok": False,
                "status": "failed",
                "output": None,
                "error": error.to_response(),
                "durationMs": int((time.perf_counter() - started_at) * 1000),
            }
            details = self._build_network_details(
                step_id=step_id,
                step_type=step_type,
                session_id=network_session_id,
                output=None,
                input_data=input_data,
            )
            if details is not None:
                failure_result["details"] = details
            return failure_result

        if self._should_capture_after_success() and step_type not in {"artifact.screenshot", "session.close"}:
            auto_capture = self._capture_auto_screenshot(step)
            if auto_capture is not None:
                output["auto_screenshot_artifact_path"] = auto_capture["artifact_path"]
        self._record_output_artifact(output)

        self._logger.info("Step %s (%s) completed.", step.get("id"), step_type)
        success_result = {
            "id": step.get("id"),
            "type": step_type,
            "ok": True,
            "status": "passed",
            "output": output,
            "durationMs": int((time.perf_counter() - started_at) * 1000),
        }
        details = self._build_network_details(
            step_id=step_id,
            step_type=step_type,
            session_id=network_session_id,
            output=output,
            input_data=input_data,
        )
        if details is not None:
            success_result["details"] = details
        return success_result

    def _should_capture_after_success(self) -> bool:
        return self._auto_screenshot_mode in {"on-success", "always"}

    def _build_network_details(
        self,
        *,
        step_id: str | None,
        step_type: str,
        session_id: str | None,
        output: dict[str, Any] | None,
        input_data: dict[str, Any],
    ) -> dict[str, Any] | None:
        if step_type not in _NETWORK_STEP_TYPES or step_id is None or session_id is None:
            return None
        network_evidence = self._network_service.collect_step_network_evidence(
            session_id,
            step_id=step_id,
            output=output,
            input_data=input_data,
        )
        if not network_evidence:
            return None
        return {"networkEvidence": network_evidence}

    def _capture_auto_screenshot(
        self,
        step: dict[str, Any],
        *,
        prefix: str = "success",
    ) -> dict[str, Any] | None:
        if not self._current_session_id:
            return None
        try:
            capture = self._session_service.capture_screenshot(
                self._current_session_id,
                prefix=f"auto-{self._sanitize_token(step.get('id') or step.get('type') or 'step')}-{prefix}",
            )
        except CliExecutionError:
            return None
        artifact_path = capture.get("artifact_path")
        if isinstance(artifact_path, str):
            self._screenshot_paths.append(artifact_path)
        self._latest_page_path = capture.get("current_page_path", self._latest_page_path)
        return capture

    def _record_output_artifact(self, output: dict[str, Any]) -> None:
        for key in ("artifact_path", "auto_screenshot_artifact_path"):
            artifact_path = output.get(key)
            if isinstance(artifact_path, str):
                self._screenshot_paths.append(artifact_path)

    def _record_error_artifacts(self, error: CliExecutionError) -> None:
        for artifact_path in error.artifacts:
            if isinstance(artifact_path, str):
                self._screenshot_paths.append(artifact_path)

    @staticmethod
    def _sanitize_token(value: Any) -> str:
        token = str(value).strip().lower()
        safe = []
        for char in token:
            if char.isalnum():
                safe.append(char)
            else:
                safe.append("-")
        return "".join(safe).strip("-") or "step"

    def _require_session_id(self, input_data: dict[str, Any]) -> str:
        session_id = input_data.get("sessionId") or self._current_session_id
        if session_id:
            return session_id
        raise CliExecutionError(
            error_code=ErrorCode.SESSION_ERROR,
            message=t("error.session_required"),
        )

    def _maybe_skip_step(self, step_type: str, input_data: dict[str, Any]) -> dict[str, Any] | None:
        session_id = input_data.get("sessionId") or self._current_session_id
        if not session_id:
            return None
        session = self._session_service.require_session(session_id)
        if not bool(session.metadata.get("uses_tourist_appid")):
            return None

        requires_developer_appid = bool(input_data.get("requiresDeveloperAppId"))
        if not requires_developer_appid and step_type not in _TOURIST_APPID_RESTRICTED_STEP_TYPES:
            return None

        reason = input_data.get("skipReason")
        if not isinstance(reason, str) or not reason.strip():
            reason = "Skipped because the target project uses touristappid and this action requires a developer-owned AppID."

        self._latest_page_path = session.current_page_path
        return {
            "skipped": True,
            "skip_reason": reason,
            "uses_tourist_appid": True,
            "current_page_path": session.current_page_path,
        }
