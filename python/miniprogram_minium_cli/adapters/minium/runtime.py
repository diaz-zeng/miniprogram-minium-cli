"""Minium 运行时适配器。"""

from __future__ import annotations

import base64
from dataclasses import dataclass
import importlib.util
import json
from pathlib import Path
import socket
import subprocess
import time
from typing import Any, Literal

from ...domain.action_models import GestureTarget, Locator, WaitCondition
from ...domain.errors import CliExecutionError, ErrorCode
from ...support.config import CliRuntimeConfig
from ...support.i18n import t

SessionMode = Literal["launch", "attach"]

_PLACEHOLDER_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9o9l9x8AAAAASUVORK5CYII="
)


@dataclass(slots=True)
class MiniumRuntimeAdapter:
    """底层运行时适配器。"""

    config: CliRuntimeConfig

    def describe_environment(self, project_path: Path | None = None) -> dict[str, str | bool | None]:
        """返回当前运行环境摘要。"""
        resolved_project_path = project_path or self.config.project_path
        devtool_path = self.config.wechat_devtool_path
        return {
            "project_path": str(resolved_project_path) if resolved_project_path else None,
            "project_exists": bool(resolved_project_path and resolved_project_path.exists()),
            "project_config_exists": bool(
                resolved_project_path and (resolved_project_path / "project.config.json").exists()
            ),
            "wechat_devtool_path": str(devtool_path) if devtool_path else None,
            "wechat_devtool_exists": bool(devtool_path and devtool_path.exists()),
            "test_port": str(self.config.test_port),
            "runtime_mode": self.config.runtime_mode,
        }

    def start_session(
        self,
        mode: SessionMode,
        initial_page_path: str | None,
        metadata: dict[str, Any],
        project_path: Path | None = None,
    ) -> dict[str, Any]:
        """启动或附着一个会话。"""
        environment = self.describe_environment(project_path=project_path)
        resolved_project_path = project_path or self.config.project_path
        if self._should_use_real_runtime(mode=mode, project_path=resolved_project_path):
            return self._start_real_session(
                mode=mode,
                initial_page_path=initial_page_path,
                metadata=metadata,
                environment=environment,
                project_path=resolved_project_path,
            )
        return self._start_placeholder_session(
            initial_page_path=initial_page_path,
            metadata=metadata,
            environment=environment,
        )

    def stop_session(self, session_metadata: dict[str, Any]) -> None:
        """关闭一个底层会话。"""
        driver = session_metadata.get("runtime_driver")
        if driver is None:
            return
        try:
            driver.shutdown()
        except Exception:
            pass

    def get_current_page(
        self,
        session_metadata: dict[str, Any],
        current_page_path: str | None,
    ) -> dict[str, Any]:
        """读取当前页面。"""
        driver = session_metadata.get("runtime_driver")
        if driver is not None:
            page = driver.app.get_current_page()
            normalized = self._normalize_page_path(getattr(page, "path", current_page_path))
            return {
                "current_page_path": normalized,
                "page_summary": {
                    "path": normalized,
                    "source": "minium-runtime",
                    "renderer": getattr(page, "renderer", None),
                },
            }
        resolved_page = current_page_path or "pages/index/index"
        return {
            "current_page_path": resolved_page,
            "page_summary": {
                "path": resolved_page,
                "source": "placeholder-runtime",
            },
        }

    def capture_screenshot(
        self,
        session_metadata: dict[str, Any],
        target_path: Path,
        current_page_path: str | None,
    ) -> dict[str, Any]:
        """生成当前页面截图。"""
        driver = session_metadata.get("runtime_driver")
        target_path.parent.mkdir(parents=True, exist_ok=True)
        if driver is not None:
            driver.app.screen_shot(save_path=str(target_path))
            page = driver.app.get_current_page()
            return {
                "current_page_path": self._normalize_page_path(getattr(page, "path", current_page_path)),
                "artifact_path": str(target_path),
                "source": "minium-runtime",
            }

        target_path.write_bytes(_PLACEHOLDER_PNG)
        return {
            "current_page_path": current_page_path or "pages/index/index",
            "artifact_path": str(target_path),
            "source": "placeholder-runtime",
        }

    def query_elements(
        self,
        session_metadata: dict[str, Any],
        current_page_path: str | None,
        locator: Locator,
    ) -> dict[str, Any]:
        """查询元素。"""
        driver = session_metadata.get("runtime_driver")
        if driver is not None:
            page = driver.app.get_current_page()
            elements = self._query_real_elements(page, locator)
            return {
                "current_page_path": self._normalize_page_path(getattr(page, "path", current_page_path)),
                "matches": [self._serialize_real_element(element, locator) for element in elements],
            }

        page_path = current_page_path or "pages/index/index"
        elements = self._placeholder_elements(page_path)
        matches = [element for element in elements if self._matches(locator, element)]
        if locator.index >= len(matches):
            return {
                "current_page_path": page_path,
                "matches": [],
            }
        return {
            "current_page_path": page_path,
            "matches": [matches[locator.index]],
        }

    def click_element(
        self,
        session_metadata: dict[str, Any],
        current_page_path: str | None,
        locator: Locator,
    ) -> dict[str, Any]:
        """点击元素。"""
        driver = session_metadata.get("runtime_driver")
        if driver is not None:
            page = driver.app.get_current_page()
            elements = self._query_real_elements(page, locator)
            element = self._require_match(elements, locator)
            before_page_path = self._normalize_page_path(getattr(page, "path", current_page_path))
            candidates = self._collect_real_click_candidates(page, element, locator)
            last_error: Exception | None = None
            try:
                for index, candidate in enumerate(candidates):
                    try:
                        self._click_real_candidate(candidate)
                    except Exception as exc:
                        last_error = exc
                        continue

                    next_page = driver.app.get_current_page()
                    next_page_path = self._normalize_page_path(getattr(next_page, "path", current_page_path))
                    is_last_candidate = index == len(candidates) - 1
                    should_continue = (
                        locator.type == "text"
                        and len(candidates) > 1
                        and next_page_path == before_page_path
                        and not is_last_candidate
                    )
                    if should_continue:
                        continue
                    return {
                        "current_page_path": next_page_path,
                    }
                if last_error is None:
                    last_error = RuntimeError("no click candidate available")
                raise last_error
            except Exception as exc:
                raise CliExecutionError(
                    error_code=ErrorCode.ACTION_ERROR,
                    message=t("error.element_not_interactable"),
                    details={"locator": locator.to_dict(), "cause": str(exc)},
                ) from exc

        query_state = self.query_elements(session_metadata, current_page_path, locator)
        match = self._require_match(query_state["matches"], locator)
        if not match["visible"] or not match["enabled"]:
            raise CliExecutionError(
                error_code=ErrorCode.ACTION_ERROR,
                message=t("error.element_not_interactable"),
                details={"locator": locator.to_dict()},
            )
        next_page_path = query_state["current_page_path"]
        if match.get("id") == "login-button" and next_page_path == "pages/index/index":
            next_page_path = "pages/home/index"
        return {"current_page_path": next_page_path}

    def input_text(
        self,
        session_metadata: dict[str, Any],
        current_page_path: str | None,
        locator: Locator,
        text: str,
    ) -> dict[str, Any]:
        """输入文本。"""
        driver = session_metadata.get("runtime_driver")
        if driver is not None:
            page = driver.app.get_current_page()
            elements = self._query_real_elements(page, locator)
            element = self._require_match(elements, locator)
            try:
                if callable(getattr(element, "input", None)):
                    element.input(text)
                else:
                    raise RuntimeError("no input method available")
            except Exception as exc:
                raise CliExecutionError(
                    error_code=ErrorCode.ACTION_ERROR,
                    message=t("error.element_not_interactable"),
                    details={"locator": locator.to_dict(), "cause": str(exc)},
                ) from exc
            return {
                "current_page_path": self._normalize_page_path(getattr(page, "path", current_page_path)),
            }

        query_state = self.query_elements(session_metadata, current_page_path, locator)
        match = self._require_match(query_state["matches"], locator)
        if not match["editable"] or not match["visible"]:
            raise CliExecutionError(
                error_code=ErrorCode.ACTION_ERROR,
                message=t("error.element_not_interactable"),
                details={"locator": locator.to_dict()},
            )
        return {"current_page_path": query_state["current_page_path"]}

    def wait_for_condition(
        self,
        session_metadata: dict[str, Any],
        current_page_path: str | None,
        condition: WaitCondition,
    ) -> dict[str, Any]:
        """等待条件成立。"""
        driver = session_metadata.get("runtime_driver")
        if driver is not None:
            deadline = time.time() + (condition.timeout_ms / 1000)
            while time.time() < deadline:
                page = driver.app.get_current_page()
                page_path = self._normalize_page_path(getattr(page, "path", current_page_path))
                if condition.kind == "page_path_equals" and page_path == condition.expected_value:
                    return {"current_page_path": page_path}
                if condition.kind in {"element_exists", "element_visible"} and condition.locator is not None:
                    elements = self._query_real_elements(page, condition.locator)
                    if condition.kind == "element_exists" and elements:
                        return {"current_page_path": page_path}
                    if condition.kind == "element_visible" and elements:
                        summary = self._serialize_real_element(elements[0], condition.locator)
                        if summary["visible"]:
                            return {"current_page_path": page_path}
                time.sleep(0.25)
            raise CliExecutionError(
                error_code=ErrorCode.ACTION_ERROR,
                message=t("error.wait_timed_out"),
                details={
                    "condition": condition.kind,
                    "expected_value": condition.expected_value,
                    "timeout_ms": condition.timeout_ms,
                },
            )

        page_path = current_page_path or "pages/index/index"
        if condition.kind == "page_path_equals":
            if page_path == condition.expected_value:
                return {"current_page_path": page_path}
        elif condition.kind == "element_exists" and condition.locator is not None:
            query_state = self.query_elements(session_metadata, page_path, condition.locator)
            if query_state["matches"]:
                return {"current_page_path": page_path}
        elif condition.kind == "element_visible" and condition.locator is not None:
            query_state = self.query_elements(session_metadata, page_path, condition.locator)
            if query_state["matches"] and query_state["matches"][0]["visible"]:
                return {"current_page_path": page_path}
        raise CliExecutionError(
            error_code=ErrorCode.ACTION_ERROR,
            message=t("error.wait_timed_out"),
            details={
                "condition": condition.kind,
                "expected_value": condition.expected_value,
                "timeout_ms": condition.timeout_ms,
            },
        )

    def perform_gesture(
        self,
        session_metadata: dict[str, Any],
        current_page_path: str | None,
        *,
        event_type: str,
        pointer_id: int,
        target: GestureTarget | None,
        active_pointers: list[dict[str, Any]],
        fallback_target: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """执行基础触摸手势。"""
        driver = session_metadata.get("runtime_driver")
        if driver is not None:
            gesture_state = self._perform_real_gesture(
                session_metadata=session_metadata,
                current_page_path=current_page_path,
                event_type=event_type,
                pointer_id=pointer_id,
                target=target,
                active_pointers=active_pointers,
                fallback_target=fallback_target,
            )
            return gesture_state

        resolved_target = self.resolve_gesture_target(
            session_metadata,
            current_page_path,
            target=target,
            fallback_target=fallback_target,
        )
        current_page = current_page_path or "pages/index/index"
        return {
            "current_page_path": current_page,
            "resolved_target": resolved_target,
        }

    @staticmethod
    def _runtime_active_pointers(session_metadata: dict[str, Any]) -> dict[int, dict[str, Any]]:
        runtime_active_pointers = session_metadata.get("runtime_active_pointers")
        if not isinstance(runtime_active_pointers, dict):
            runtime_active_pointers = {}
            session_metadata["runtime_active_pointers"] = runtime_active_pointers
        return runtime_active_pointers

    @staticmethod
    def _sync_runtime_active_pointers(
        runtime_active_pointers: dict[int, dict[str, Any]],
        active_pointers: list[dict[str, Any]],
    ) -> dict[int, dict[str, Any]]:
        active_pointer_ids = {
            int(pointer["pointerId"])
            for pointer in active_pointers
            if isinstance(pointer, dict) and "pointerId" in pointer
        }
        stale_pointer_ids = [pointer_id for pointer_id in runtime_active_pointers if pointer_id not in active_pointer_ids]
        for pointer_id in stale_pointer_ids:
            runtime_active_pointers.pop(pointer_id, None)
        return runtime_active_pointers

    def _perform_real_gesture(
        self,
        *,
        session_metadata: dict[str, Any],
        current_page_path: str | None,
        event_type: str,
        pointer_id: int,
        target: GestureTarget | None,
        active_pointers: list[dict[str, Any]],
        fallback_target: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        driver = session_metadata["runtime_driver"]
        page = driver.app.get_current_page()
        runtime_active_pointers = self._sync_runtime_active_pointers(
            self._runtime_active_pointers(session_metadata),
            active_pointers,
        )

        if event_type == "touch_tap":
            dispatch_target, resolved_target, position = self._resolve_real_gesture_target(
                page=page,
                target=target,
                runtime_active_pointers=runtime_active_pointers,
                pointer_id=pointer_id,
                fallback_target=fallback_target,
            )
            changed_touch = self._position_to_touch(position, pointer_id)
            touches = self._build_touches_payload(runtime_active_pointers, changed_touch=changed_touch)
            self._dispatch_real_touch_event(
                dispatch_target,
                "touchstart",
                touches=touches,
                changed_touches=[changed_touch],
            )
            self._dispatch_real_touch_event(
                dispatch_target,
                "touchend",
                touches=self._build_touches_payload(runtime_active_pointers),
                changed_touches=[changed_touch],
            )
            self._dispatch_real_tap_event(dispatch_target)
            next_page = driver.app.get_current_page()
            return {
                "current_page_path": self._normalize_page_path(getattr(next_page, "path", current_page_path)),
                "resolved_target": resolved_target,
            }

        if event_type == "touch_start":
            dispatch_target, resolved_target, position = self._resolve_real_gesture_target(
                page=page,
                target=target,
                runtime_active_pointers=runtime_active_pointers,
                pointer_id=pointer_id,
                fallback_target=fallback_target,
            )
            changed_touch = self._position_to_touch(position, pointer_id)
            touches = self._build_touches_payload(runtime_active_pointers, changed_touch=changed_touch)
            self._dispatch_real_touch_event(
                dispatch_target,
                "touchstart",
                touches=touches,
                changed_touches=[changed_touch],
            )
            runtime_active_pointers[pointer_id] = {
                "pointer_id": pointer_id,
                "current_position": position,
                "origin_target_summary": resolved_target,
                "runtime_target": dispatch_target,
            }
        elif event_type == "touch_move":
            pointer_state = runtime_active_pointers.get(pointer_id)
            if pointer_state is None:
                raise CliExecutionError(
                    error_code=ErrorCode.ACTION_ERROR,
                    message=t("error.pointer_not_active"),
                    details={"pointer_id": pointer_id},
                )
            dispatch_target, resolved_target, destination = self._resolve_real_gesture_target(
                page=page,
                target=target,
                runtime_active_pointers=runtime_active_pointers,
                pointer_id=pointer_id,
                fallback_target=fallback_target,
            )
            for position in self._interpolate_positions(pointer_state["current_position"], destination, steps=1):
                changed_touch = self._position_to_touch(position, pointer_id)
                pointer_state["current_position"] = position
                if target is not None and target.locator is not None:
                    pointer_state["runtime_target"] = dispatch_target
                self._dispatch_real_touch_event(
                    pointer_state.get("runtime_target") or dispatch_target,
                    "touchmove",
                    touches=self._build_touches_payload(runtime_active_pointers),
                    changed_touches=[changed_touch],
                )
        elif event_type == "touch_end":
            pointer_state = runtime_active_pointers.get(pointer_id)
            if pointer_state is None:
                raise CliExecutionError(
                    error_code=ErrorCode.ACTION_ERROR,
                    message=t("error.pointer_not_active"),
                    details={"pointer_id": pointer_id},
                )
            changed_touch = self._position_to_touch(pointer_state["current_position"], pointer_id)
            remaining_pointers = {
                candidate_id: candidate
                for candidate_id, candidate in runtime_active_pointers.items()
                if candidate_id != pointer_id
            }
            self._dispatch_real_touch_event(
                pointer_state.get("runtime_target") or self._resolve_runtime_dispatch_target(page, runtime_active_pointers, pointer_id),
                "touchend",
                touches=self._build_touches_payload(remaining_pointers),
                changed_touches=[changed_touch],
            )
            runtime_active_pointers.pop(pointer_id, None)
            resolved_target = {
                "x": float(pointer_state["current_position"]["x"]),
                "y": float(pointer_state["current_position"]["y"]),
                "source": "active-pointer",
                "target": {
                    "type": "release",
                    "position": {
                        "x": float(pointer_state["current_position"]["x"]),
                        "y": float(pointer_state["current_position"]["y"]),
                    },
                },
            }
        else:
            raise CliExecutionError(
                error_code=ErrorCode.PLAN_ERROR,
                message=t("error.unsupported_step_type"),
                details={"event_type": event_type},
            )

        next_page = driver.app.get_current_page()
        return {
            "current_page_path": self._normalize_page_path(getattr(next_page, "path", current_page_path)),
            "resolved_target": resolved_target,
        }

    def resolve_gesture_target(
        self,
        session_metadata: dict[str, Any],
        current_page_path: str | None,
        *,
        target: GestureTarget | None,
        fallback_target: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """将高层目标解析为绝对坐标。"""
        if target is None:
            if fallback_target is None:
                raise CliExecutionError(
                    error_code=ErrorCode.PLAN_ERROR,
                    message=t("error.gesture_target_required"),
                )
            return {
                "x": float(fallback_target["x"]),
                "y": float(fallback_target["y"]),
                "source": str(fallback_target.get("source") or "active-pointer"),
                "target": fallback_target.get("target") or {
                    "x": float(fallback_target["x"]),
                    "y": float(fallback_target["y"]),
                },
            }

        if target.locator is not None:
            query_state = self.query_elements(session_metadata, current_page_path, target.locator)
            matches = query_state["matches"]
            match = self._require_match(matches, target.locator)
            return {
                "x": float(match["center_x"]),
                "y": float(match["center_y"]),
                "source": "locator",
                "target": {
                    "locator": target.locator.to_dict(),
                    "match": match,
                },
            }

        if target.x is None or target.y is None:
            raise CliExecutionError(
                error_code=ErrorCode.PLAN_ERROR,
                message=t("error.gesture_target_resolved_coordinates"),
            )
        return {
            "x": float(target.x),
            "y": float(target.y),
            "source": "coordinates",
            "target": {"x": float(target.x), "y": float(target.y)},
        }

    def _should_use_real_runtime(
        self,
        mode: SessionMode,
        project_path: Path | None,
    ) -> bool:
        if self.config.runtime_mode == "placeholder":
            return False
        if self.config.runtime_mode == "real":
            self._ensure_real_runtime_prerequisites(mode=mode, project_path=project_path)
            return True

        if importlib.util.find_spec("minium") is None:
            return False
        if not self.is_executable(self.config.wechat_devtool_path):
            return False
        if project_path is None or not self.is_executable(project_path):
            return False
        if not (project_path / "project.config.json").exists():
            return False
        return True

    def _ensure_real_runtime_prerequisites(
        self,
        mode: SessionMode,
        project_path: Path | None,
    ) -> None:
        if importlib.util.find_spec("minium") is None:
            raise CliExecutionError(
                error_code=ErrorCode.ENVIRONMENT_ERROR,
                message=t("error.minium_import_failed"),
                details={"runtime_mode": self.config.runtime_mode},
            )
        if not self.is_executable(self.config.wechat_devtool_path):
            raise CliExecutionError(
                error_code=ErrorCode.ENVIRONMENT_ERROR,
                message=t("error.devtool_missing"),
                details={
                    "wechat_devtool_path": str(self.config.wechat_devtool_path)
                    if self.config.wechat_devtool_path
                    else None,
                    "runtime_mode": self.config.runtime_mode,
                },
            )
        if mode == "launch":
            if project_path is None or not project_path.exists():
                raise CliExecutionError(
                    error_code=ErrorCode.ENVIRONMENT_ERROR,
                    message=t("error.project_path_missing"),
                    details={"project_path": str(project_path) if project_path else None},
                )
            project_config = project_path / "project.config.json"
            if not project_config.exists():
                raise CliExecutionError(
                    error_code=ErrorCode.ENVIRONMENT_ERROR,
                    message=t("error.project_config_missing"),
                    details={"project_config_path": str(project_config)},
                )
        elif project_path is not None and not project_path.exists():
            raise CliExecutionError(
                error_code=ErrorCode.ENVIRONMENT_ERROR,
                message=t("error.project_path_missing"),
                details={"project_path": str(project_path)},
            )

    def _start_real_session(
        self,
        mode: SessionMode,
        initial_page_path: str | None,
        metadata: dict[str, Any],
        environment: dict[str, str | bool | None],
        project_path: Path | None,
    ) -> dict[str, Any]:
        """启动真实 Minium 会话。"""
        try:
            from minium import Minium
        except Exception as exc:  # pragma: no cover - 真实依赖路径
            raise CliExecutionError(
                error_code=ErrorCode.ENVIRONMENT_ERROR,
                message=t("error.minium_import_failed"),
                details={**environment, "cause": self._format_exception(exc)},
            ) from exc

        if project_path is not None:
            self._prepare_automation_target(project_path=project_path, test_port=self.config.test_port)

        conf: dict[str, Any] = {
            "project_path": str(project_path) if mode == "launch" and project_path else None,
            "dev_tool_path": str(self.config.wechat_devtool_path) if self.config.wechat_devtool_path else None,
            "test_port": self.config.test_port,
            "outputs": str(self.config.artifacts_dir),
            "auto_relaunch": False,
        }
        if self._should_disable_native_modal_mock(project_path):
            conf["mock_native_modal"] = False
        conf = {key: value for key, value in conf.items() if value is not None}

        try:
            driver = Minium(conf)
            app = driver.app
            if initial_page_path:
                app.navigate_to(initial_page_path)
            page = app.get_current_page()
        except Exception as exc:  # pragma: no cover - 真实依赖路径
            raise CliExecutionError(
                error_code=ErrorCode.ENVIRONMENT_ERROR,
                message=t("error.minium_connect_failed"),
                details={**environment, "cause": self._format_exception(exc), "mode": mode},
            ) from exc

        return {
            "backend": "minium",
            "connected": True,
            "current_page_path": self._normalize_page_path(getattr(page, "path", initial_page_path)),
            "environment": environment,
            "note": "real-runtime",
            "metadata": metadata,
            "runtime_driver": driver,
            "runtime_app": app,
            "test_port": self.config.test_port,
        }

    def _start_placeholder_session(
        self,
        initial_page_path: str | None,
        metadata: dict[str, Any],
        environment: dict[str, str | bool | None],
    ) -> dict[str, Any]:
        """启动占位会话。"""
        return {
            "backend": "placeholder",
            "connected": True,
            "current_page_path": initial_page_path or "pages/index/index",
            "environment": environment,
            "note": "placeholder-runtime",
            "metadata": metadata,
            "runtime_driver": None,
            "runtime_app": None,
            "test_port": self.config.test_port,
        }

    @staticmethod
    def is_executable(path: Path | None) -> bool:
        """判断路径是否存在且可作为可执行入口使用。"""
        return bool(path and path.exists())

    def _prepare_automation_target(self, project_path: Path, test_port: int) -> None:
        command = [
            str(self.config.wechat_devtool_path),
            "auto",
            "--project",
            str(project_path),
            "--auto-port",
            str(test_port),
            "--lang",
            "zh" if self.config.language == "zh-CN" else "en",
            "--trust-project",
        ]
        try:
            completed = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=90,
                check=False,
            )
        except Exception as exc:
            raise CliExecutionError(
                error_code=ErrorCode.ENVIRONMENT_ERROR,
                message=t("error.devtool_prepare_failed"),
                details={
                    "project_path": str(project_path),
                    "test_port": test_port,
                    "command": command,
                    "cause": str(exc),
                },
            ) from exc

        if completed.returncode != 0:
            raise CliExecutionError(
                error_code=ErrorCode.ENVIRONMENT_ERROR,
                message=t("error.devtool_prepare_failed"),
                details={
                    "project_path": str(project_path),
                    "test_port": test_port,
                    "command": command,
                    "stdout": completed.stdout.strip(),
                    "stderr": completed.stderr.strip(),
                    "returncode": completed.returncode,
                },
            )

        if not self._wait_for_port(test_port, timeout_seconds=20):
            raise CliExecutionError(
                error_code=ErrorCode.ENVIRONMENT_ERROR,
                message=t("error.devtool_prepare_failed"),
                details={
                    "project_path": str(project_path),
                    "test_port": test_port,
                    "command": command,
                    "stdout": completed.stdout.strip(),
                    "stderr": completed.stderr.strip(),
                    "reason": "automation port is not listening",
                },
            )

    @staticmethod
    def _is_port_listening(test_port: int) -> bool:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.2)
            return sock.connect_ex(("127.0.0.1", test_port)) == 0

    def _wait_for_port(self, test_port: int, timeout_seconds: float) -> bool:
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            if self._is_port_listening(test_port):
                return True
            time.sleep(0.25)
        return False

    @staticmethod
    def _format_exception(exc: Exception) -> str:
        text = str(exc).strip()
        if text:
            return text
        return repr(exc)

    @staticmethod
    def _should_disable_native_modal_mock(project_path: Path | None) -> bool:
        if project_path is None:
            return False
        project_config_path = project_path / "project.config.json"
        if not project_config_path.exists():
            return False
        try:
            payload = json.loads(project_config_path.read_text(encoding="utf-8"))
        except Exception:
            return False
        return str(payload.get("appid", "")).strip() == "touristappid"

    def _resolve_real_gesture_target(
        self,
        *,
        page: Any,
        target: GestureTarget | None,
        runtime_active_pointers: dict[int, dict[str, Any]],
        pointer_id: int,
        fallback_target: dict[str, Any] | None = None,
    ) -> tuple[Any, dict[str, Any], dict[str, float]]:
        if target is not None and target.locator is not None:
            elements = self._query_real_elements(page, target.locator)
            element = self._require_match(elements, target.locator)
            dispatch_target = self._resolve_real_gesture_dispatch_target(page, element, target.locator)
            element_center = self._real_element_center(element)
            position = (
                {"x": float(target.x), "y": float(target.y)}
                if target.x is not None and target.y is not None
                else element_center
            )
            return (
                dispatch_target,
                {
                    "x": position["x"],
                    "y": position["y"],
                    "source": "locator",
                    "target": {
                        "locator": target.locator.to_dict(),
                        "match": self._serialize_real_element(element, target.locator),
                        "dispatchPosition": {
                            "x": position["x"],
                            "y": position["y"],
                        },
                        "elementCenter": {
                            "x": element_center["x"],
                            "y": element_center["y"],
                        },
                        "dispatchTag": getattr(dispatch_target, "_tag_name", None),
                        "dispatchId": getattr(dispatch_target, "id", None),
                    },
                },
                position,
            )

        if target is not None and target.x is not None and target.y is not None:
            position = {"x": float(target.x), "y": float(target.y)}
            return (
                self._resolve_runtime_dispatch_target(page, runtime_active_pointers, pointer_id),
                {
                    "x": position["x"],
                    "y": position["y"],
                    "source": "coordinates",
                    "target": {"x": position["x"], "y": position["y"]},
                },
                position,
            )

        if fallback_target is not None:
            position = {
                "x": float(fallback_target["x"]),
                "y": float(fallback_target["y"]),
            }
            return (
                self._resolve_runtime_dispatch_target(page, runtime_active_pointers, pointer_id),
                {
                    "x": position["x"],
                    "y": position["y"],
                    "source": str(fallback_target.get("source") or "active-pointer"),
                    "target": fallback_target.get("target") or position,
                },
                position,
            )

        raise CliExecutionError(
            error_code=ErrorCode.PLAN_ERROR,
            message=t("error.gesture_target_required"),
        )

    @staticmethod
    def _resolve_runtime_dispatch_target(
        page: Any,
        runtime_active_pointers: dict[int, dict[str, Any]],
        pointer_id: int,
    ) -> Any:
        pointer_state = runtime_active_pointers.get(pointer_id)
        if pointer_state is not None and pointer_state.get("runtime_target") is not None:
            return pointer_state["runtime_target"]
        for candidate_id in sorted(runtime_active_pointers):
            candidate = runtime_active_pointers[candidate_id]
            if candidate.get("runtime_target") is not None:
                return candidate["runtime_target"]
        return page

    def _resolve_real_gesture_dispatch_target(
        self,
        page: Any,
        element: Any,
        locator: Locator,
    ) -> Any:
        if locator.type != "text":
            return element

        candidates = self._collect_real_click_candidates(page, element, locator)
        base_identity = self._real_element_identity(element)
        base_id = getattr(element, "id", None)
        base_element_id = getattr(element, "element_id", None)
        base_rect = getattr(element, "rect", None) or {}
        base_area = max(float(base_rect.get("width", 0)) * float(base_rect.get("height", 0)), 0.0)

        better_candidates: list[tuple[float, Any]] = []
        for candidate in candidates:
            candidate_identity = self._real_element_identity(candidate)
            if candidate_identity == base_identity:
                continue
            if getattr(candidate, "id", None) == base_id:
                continue
            if getattr(candidate, "element_id", None) == base_element_id:
                continue
            rect = getattr(candidate, "rect", None) or {}
            area = max(float(rect.get("width", 0)) * float(rect.get("height", 0)), 0.0)
            if area <= 0 or area > max(base_area * 4, 20_000):
                continue
            better_candidates.append((area, candidate))

        if not better_candidates:
            return element
        better_candidates.sort(key=lambda item: item[0])
        return better_candidates[0][1]

    def _dispatch_real_touch_event(
        self,
        target: Any,
        event_type: str,
        touches: list[dict[str, float | int]],
        changed_touches: list[dict[str, float | int]],
    ) -> None:
        if callable(getattr(target, "dispatch_event", None)):
            target.dispatch_event(
                event_type,
                touches=touches,
                change_touches=changed_touches,
                detail={},
            )
            return
        if event_type == "touchstart" and callable(getattr(target, "touch_start", None)):
            target.touch_start(touches, changed_touches)
            return
        if event_type == "touchmove" and callable(getattr(target, "touch_move", None)):
            target.touch_move(touches, changed_touches)
            return
        if event_type == "touchend" and callable(getattr(target, "touch_end", None)):
            target.touch_end(changed_touches)
            return
        if callable(getattr(target, "trigger_events", None)):
            target.trigger_events(
                [
                    {
                        "type": event_type,
                        "touches": touches,
                        "changedTouches": changed_touches,
                        "interval": 0,
                    }
                ]
            )
            return
        raise CliExecutionError(
            error_code=ErrorCode.ACTION_ERROR,
            message=t("error.minium_touch_not_supported"),
            details={
                "event_type": event_type,
                "available_methods": [],
            },
        )

    def _dispatch_real_tap_event(self, target: Any) -> None:
        if callable(getattr(target, "trigger", None)):
            target.trigger("tap", {})
            return
        if callable(getattr(target, "dispatch_event", None)):
            target.dispatch_event("tap", detail={})
            return
        if callable(getattr(target, "trigger_events", None)):
            target.trigger_events([{"type": "tap", "detail": {}, "interval": 0}])
            return

    @staticmethod
    def _build_touches_payload(
        runtime_active_pointers: dict[int, dict[str, Any]],
        changed_touch: dict[str, float | int] | None = None,
    ) -> list[dict[str, float | int]]:
        touches = [
            MiniumRuntimeAdapter._position_to_touch(pointer["current_position"], pointer_id)
            for pointer_id, pointer in sorted(runtime_active_pointers.items(), key=lambda item: item[0])
        ]
        if changed_touch is not None and all(touch["identifier"] != changed_touch["identifier"] for touch in touches):
            touches.append(changed_touch)
        return touches

    @staticmethod
    def _position_to_touch(
        position: dict[str, float],
        pointer_id: int,
    ) -> dict[str, float | int]:
        return {
            "identifier": pointer_id,
            "pageX": float(position["x"]),
            "pageY": float(position["y"]),
            "clientX": float(position["x"]),
            "clientY": float(position["y"]),
        }

    @staticmethod
    def _interpolate_positions(
        start: dict[str, float],
        destination: dict[str, float],
        *,
        steps: int,
    ) -> list[dict[str, float]]:
        if steps <= 1:
            return [{"x": float(destination["x"]), "y": float(destination["y"])}]
        positions: list[dict[str, float]] = []
        for index in range(1, steps + 1):
            ratio = index / steps
            positions.append(
                {
                    "x": float(start["x"]) + ((float(destination["x"]) - float(start["x"])) * ratio),
                    "y": float(start["y"]) + ((float(destination["y"]) - float(start["y"])) * ratio),
                }
            )
        return positions

    @staticmethod
    def _real_element_center(element: Any) -> dict[str, float]:
        rect = getattr(element, "rect", None) or {}
        width = float(rect.get("width", 0) or 0)
        height = float(rect.get("height", 0) or 0)
        left = float(rect.get("left", 0) or 0)
        top = float(rect.get("top", 0) or 0)
        return {
            "x": left + (width / 2),
            "y": top + (height / 2),
        }

    def _collect_real_click_candidates(
        self,
        page: Any,
        element: Any,
        locator: Locator,
    ) -> list[Any]:
        candidates = [element]
        if locator.type == "text":
            candidates.extend(self._query_click_ancestors(page, element))

        deduped: list[Any] = []
        seen: set[str] = set()
        for candidate in candidates:
            identity = self._real_element_identity(candidate)
            if identity in seen:
                continue
            seen.add(identity)
            deduped.append(candidate)
        return deduped

    def _click_real_candidate(self, element: Any) -> None:
        methods: list[tuple[str, Any]] = [
            ("click", lambda: element.click()),
            ("tap", lambda: element.tap()),
            ("trigger_click", lambda: element.trigger("click", {})),
            ("trigger_tap", lambda: element.trigger("tap", {})),
            ("dispatch_click", lambda: element.dispatch_event("click", detail={})),
            ("touch_sequence", lambda: self._trigger_touch_sequence(element)),
        ]
        last_error: Exception | None = None
        for _, method in methods:
            try:
                method()
                return
            except Exception as exc:
                last_error = exc
        if last_error is None:
            raise RuntimeError("no click method available")
        raise last_error

    def _trigger_touch_sequence(self, element: Any) -> None:
        rect = getattr(element, "rect", None) or {}
        center_x = float(rect.get("left", 0)) + (float(rect.get("width", 0)) / 2)
        center_y = float(rect.get("top", 0)) + (float(rect.get("height", 0)) / 2)
        touch = {
            "identifier": 0,
            "pageX": center_x,
            "pageY": center_y,
            "clientX": center_x,
            "clientY": center_y,
        }
        element.trigger_events(
            [
                {
                    "type": "touchstart",
                    "touches": [touch],
                    "changedTouches": [touch],
                    "interval": 0,
                },
                {
                    "type": "touchend",
                    "changedTouches": [touch],
                    "interval": 0,
                },
                {"type": "tap", "detail": {}, "interval": 0},
            ]
        )

    def _query_click_ancestors(
        self,
        page: Any,
        element: Any,
        max_depth: int = 4,
    ) -> list[Any]:
        base_xpath = self._real_element_xpath(element)
        if not base_xpath:
            return []

        ancestors: list[Any] = []
        for depth in range(1, max_depth + 1):
            xpath = base_xpath + ("/.." * depth)
            ancestors.extend(self._query_xpath_elements(page, xpath))
        return ancestors

    @staticmethod
    def _real_element_xpath(element: Any) -> str | None:
        selector = getattr(element, "selector", None)
        if selector is None:
            return None
        full_selector = getattr(selector, "full_selector", None)
        if callable(full_selector):
            try:
                value = full_selector()
                if isinstance(value, str) and value.startswith("/"):
                    return value
            except Exception:
                return None
        return None

    def _query_xpath_elements(self, page: Any, xpath: str) -> list[Any]:
        try:
            return page.get_elements_by_xpath(xpath, max_timeout=0)
        except TypeError:
            return page.get_elements_by_xpath(xpath)
        except Exception:
            return []

    @staticmethod
    def _real_element_identity(element: Any) -> str:
        selector = getattr(element, "selector", None)
        selector_value = None
        if selector is not None:
            full_selector = getattr(selector, "full_selector", None)
            if callable(full_selector):
                try:
                    selector_value = full_selector()
                except Exception:
                    selector_value = None
        return "|".join(
            [
                str(getattr(element, "element_id", "")),
                str(getattr(element, "id", "")),
                str(getattr(element, "_tag_name", "")),
                str(selector_value or ""),
            ]
        )

    @staticmethod
    def _try_call(target: Any, method_name: str, *args: Any) -> bool:
        method = getattr(target, method_name, None)
        if not callable(method):
            return False
        try:
            method(*args)
            return True
        except TypeError:
            return False

    @staticmethod
    def _normalize_page_path(page_path: str | None) -> str:
        if not page_path:
            return "pages/index/index"
        return str(page_path).lstrip("/")

    def _query_real_elements(self, page: Any, locator: Locator) -> list[Any]:
        if locator.type == "id":
            return page.get_elements(f"#{locator.value}", max_timeout=0, index=locator.index)
        if locator.type == "css":
            return page.get_elements(locator.value, max_timeout=0, index=locator.index)
        if locator.type == "text":
            return self._query_real_elements_by_text(page, locator)
        raise CliExecutionError(
            error_code=ErrorCode.ACTION_ERROR,
            message=t("error.unsupported_locator_type"),
            details={"locator": locator.to_dict()},
        )

    def _query_real_elements_by_text(self, page: Any, locator: Locator) -> list[Any]:
        target_text = self._normalize_text(locator.value)
        exact_xpath = f"//*[normalize-space(string(.))={self._to_xpath_literal(target_text)}]"
        contains_xpath = f"//*[contains(normalize-space(string(.)), {self._to_xpath_literal(target_text)})]"
        matches = self._query_xpath_elements(page, exact_xpath)
        if not matches:
            matches = self._query_xpath_elements(page, contains_xpath)

        filtered: list[tuple[str, Any]] = []
        seen_keys: set[str] = set()
        for element in matches:
            normalized_text = self._normalize_text(self._read_element_text(element))
            if not normalized_text or target_text not in normalized_text:
                continue

            element_id = getattr(element, "id", None)
            element_tag = getattr(element, "_tag_name", None)
            dedupe_key = f"{element_id}|{element_tag}|{normalized_text}"
            if dedupe_key in seen_keys:
                continue
            seen_keys.add(dedupe_key)
            filtered.append((normalized_text, element))

        filtered.sort(key=lambda item: (item[0] != target_text, len(item[0])))
        ordered_matches = [element for _, element in filtered]
        if locator.index >= len(ordered_matches):
            return []
        return [ordered_matches[locator.index]]

    def _serialize_real_element(self, element: Any, locator: Locator) -> dict[str, Any]:
        text = self._read_element_text(element)
        rect = getattr(element, "rect", {}) or {}
        width = float(rect.get("width", 0) or 0)
        height = float(rect.get("height", 0) or 0)
        left = float(rect.get("left", 0) or 0)
        top = float(rect.get("top", 0) or 0)
        return {
            "locator": locator.to_dict(),
            "id": getattr(element, "id", None),
            "tag": getattr(element, "_tag_name", None),
            "text": text,
            "visible": True,
            "enabled": True,
            "editable": callable(getattr(element, "input", None)),
            "center_x": left + (width / 2),
            "center_y": top + (height / 2),
        }

    @staticmethod
    def _read_element_text(element: Any) -> str:
        for attr_name in ("inner_text", "text", "value"):
            attr = getattr(element, attr_name, None)
            if callable(attr):
                try:
                    value = attr()
                except Exception:
                    continue
                if value:
                    return str(value)
            elif attr:
                return str(attr)
        return ""

    @staticmethod
    def _normalize_text(value: str | None) -> str:
        return " ".join(str(value or "").split())

    @staticmethod
    def _to_xpath_literal(value: str) -> str:
        if "'" not in value:
            return f"'{value}'"
        if '"' not in value:
            return f'"{value}"'
        parts = value.split("'")
        return "concat(" + ", \"'\", ".join(f"'{part}'" for part in parts) + ")"

    @staticmethod
    def _placeholder_elements(page_path: str) -> list[dict[str, Any]]:
        if page_path == "pages/home/index":
            return [
                {
                    "id": "home-title",
                    "text": "Home",
                    "visible": True,
                    "enabled": True,
                    "editable": False,
                    "center_x": 160,
                    "center_y": 80,
                    "selector": ".page-title",
                },
                {
                    "id": "search-input",
                    "text": "",
                    "visible": True,
                    "enabled": True,
                    "editable": True,
                    "center_x": 180,
                    "center_y": 150,
                    "selector": "#search-input",
                },
            ]
        return [
            {
                "id": "login-button",
                "text": "Login",
                "visible": True,
                "enabled": True,
                "editable": False,
                "center_x": 180,
                "center_y": 240,
                "selector": "#login-button",
            },
            {
                "id": "username-input",
                "text": "",
                "visible": True,
                "enabled": True,
                "editable": True,
                "center_x": 180,
                "center_y": 180,
                "selector": "#username-input",
            },
            {
                "id": "page-title",
                "text": "Login",
                "visible": True,
                "enabled": True,
                "editable": False,
                "center_x": 160,
                "center_y": 80,
                "selector": ".page-title",
            },
        ]

    @staticmethod
    def _matches(locator: Locator, element: dict[str, Any]) -> bool:
        if locator.type == "id":
            return element.get("id") == locator.value
        if locator.type == "css":
            return element.get("selector") == locator.value
        if locator.type == "text":
            return locator.value in str(element.get("text", ""))
        return False

    def _require_match(self, matches: list[Any], locator: Locator):
        if not matches:
            raise CliExecutionError(
                error_code=ErrorCode.ACTION_ERROR,
                message=t("error.no_matching_element"),
                details={"locator": locator.to_dict()},
            )
        return matches[0]
