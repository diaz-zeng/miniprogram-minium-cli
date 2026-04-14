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
from urllib.parse import parse_qsl, urlsplit

from ...domain.action_models import GestureTarget, Locator, WaitCondition
from ...domain.errors import CliExecutionError, ErrorCode
from ...domain.network_models import NetworkEvent, NetworkInterceptRuleState, NetworkListenerState, NetworkState
from ...support.config import CliRuntimeConfig
from ...support.i18n import t

SessionMode = Literal["launch", "attach"]

_BRIDGE_ASYNC_STEP_TYPES = {
    "location.get",
    "location.choose",
    "media.chooseImage",
    "media.chooseMedia",
    "media.takePhoto",
    "file.upload",
    "file.download",
    "device.scanCode",
    "auth.login",
    "auth.checkSession",
    "subscription.requestMessage",
    "ui.showModal",
    "ui.showActionSheet",
}

_TOURIST_APPID_RESTRICTED_STEP_TYPES = {
    "ui.showModal",
    "ui.showActionSheet",
    "settings.authorize",
    "location.get",
    "location.choose",
    "subscription.requestMessage",
}

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
            project_path=resolved_project_path,
        )

    def stop_session(self, session_metadata: dict[str, Any]) -> None:
        """关闭一个底层会话。"""
        driver = session_metadata.get("runtime_driver")
        self._cleanup_network_runtime(session_metadata)
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
        resolved_page = self._normalize_page_path(current_page_path)
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
            "current_page_path": self._normalize_page_path(current_page_path),
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

        page_path = self._normalize_page_path(current_page_path)
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
        transitions = {
            ("pages/index/index", "login-button"): ("pages/home/index", "replace"),
            ("pages/home/index", "home-to-bridge-lab-button"): ("pages/bridge-lab/index", "push"),
            ("pages/home/index", "home-to-gesture-button"): ("pages/gesture/index", "push"),
            ("pages/home/index", "home-to-cursor-lab-button"): ("pages/cursor-lab/index", "push"),
            ("pages/home/index", "home-to-review-board-button"): ("pages/review-board/index", "push"),
            ("pages/bridge-lab/index", "bridge-to-home-button"): ("pages/home/index", "push"),
            ("pages/bridge-lab/index", "bridge-to-review-board-button"): ("pages/review-board/index", "push"),
        }
        transition = transitions.get((next_page_path, str(match.get("id"))))
        if transition is not None:
            state = self._placeholder_bridge_state(session_metadata, next_page_path)
            next_page_path = self._apply_placeholder_page_transition(
                state,
                current_page_path=next_page_path,
                next_page_path=transition[0],
                mode=transition[1],
            )
        self._emit_placeholder_click_network_event(
            session_metadata,
            current_page_path=next_page_path,
            element_id=str(match.get("id") or ""),
        )
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

        page_path = self._normalize_page_path(current_page_path)
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

    def start_network_listener(
        self,
        session_metadata: dict[str, Any],
        network_state: NetworkState,
        listener: NetworkListenerState,
    ) -> None:
        """Register a network listener in the active runtime."""
        self._ensure_network_runtime_supported(session_metadata)
        self._ensure_real_network_controls(session_metadata, network_state)

    def stop_network_listener(
        self,
        session_metadata: dict[str, Any],
        network_state: NetworkState,
        listener_id: str,
    ) -> None:
        """Stop a previously registered network listener."""
        self._ensure_network_runtime_supported(session_metadata)

    def clear_network_events(
        self,
        session_metadata: dict[str, Any],
        network_state: NetworkState,
        listener_id: str | None = None,
    ) -> int:
        """Clear buffered network events."""
        self._ensure_network_runtime_supported(session_metadata)
        if listener_id is None:
            cleared_count = len(network_state.events)
            network_state.events.clear()
            for listener in network_state.listeners.values():
                listener.matched_event_ids.clear()
                listener.hit_count = 0
            return cleared_count

        listener = network_state.listeners.get(listener_id)
        if listener is None:
            return 0
        cleared_ids = set(listener.matched_event_ids)
        cleared_count = len(cleared_ids)
        network_state.events = [event for event in network_state.events if event.event_id not in cleared_ids]
        listener.matched_event_ids.clear()
        listener.hit_count = 0
        return cleared_count

    def add_network_intercept_rule(
        self,
        session_metadata: dict[str, Any],
        network_state: NetworkState,
        rule: NetworkInterceptRuleState,
    ) -> None:
        """Register a network interception rule in the active runtime."""
        self._ensure_network_runtime_supported(session_metadata)
        self._ensure_real_network_controls(session_metadata, network_state)
        self._sync_real_network_intercepts(session_metadata, network_state)

    def remove_network_intercept_rule(
        self,
        session_metadata: dict[str, Any],
        network_state: NetworkState,
        rule_id: str,
    ) -> None:
        """Remove a previously registered network interception rule."""
        self._ensure_network_runtime_supported(session_metadata)
        self._sync_real_network_intercepts(session_metadata, network_state)

    def clear_network_intercept_rules(
        self,
        session_metadata: dict[str, Any],
        network_state: NetworkState,
    ) -> None:
        """Clear all interception rules in the active runtime."""
        self._ensure_network_runtime_supported(session_metadata)
        self._sync_real_network_intercepts(session_metadata, network_state)

    def execute_bridge_action(
        self,
        session_metadata: dict[str, Any],
        current_page_path: str | None,
        step_type: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """执行结构化 wx 能力桥接动作。"""
        try:
            driver = session_metadata.get("runtime_driver")
            if driver is not None:
                return self._execute_real_bridge_action(
                    session_metadata,
                    current_page_path,
                    step_type,
                    payload,
                )
            return self._execute_placeholder_bridge_action(
                session_metadata,
                current_page_path,
                step_type,
                payload,
            )
        except CliExecutionError:
            raise
        except Exception as exc:
            raise CliExecutionError(
                error_code=ErrorCode.ACTION_ERROR,
                message=t("error.bridge_action_failed"),
                details={
                    "step_type": step_type,
                    "cause": self._format_exception(exc),
                },
            ) from exc

    def _execute_real_bridge_action(
        self,
        session_metadata: dict[str, Any],
        current_page_path: str | None,
        step_type: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        app = session_metadata.get("runtime_app")
        if app is None and session_metadata.get("runtime_driver") is not None:
            app = session_metadata["runtime_driver"].app
        if app is None:
            raise CliExecutionError(
                error_code=ErrorCode.ACTION_ERROR,
                message=t("error.bridge_runtime_unavailable"),
                details={"step_type": step_type},
            )

        route_state = self._execute_real_navigation_action(app, current_page_path, step_type, payload)
        if route_state is not None:
            return route_state

        bridge_method, bridge_args = self._build_bridge_request(step_type, payload)
        if step_type in _BRIDGE_ASYNC_STEP_TYPES:
            response = self._call_real_bridge_async(app, bridge_method, bridge_args, payload)
        else:
            response = app.call_wx_method(bridge_method, bridge_args)

        next_page = app.get_current_page()
        return {
            "bridge_method": bridge_method,
            "result": self._extract_bridge_result(response),
            "current_page_path": self._normalize_page_path(getattr(next_page, "path", current_page_path)),
        }

    def _execute_real_navigation_action(
        self,
        app: Any,
        current_page_path: str | None,
        step_type: str,
        payload: dict[str, Any],
    ) -> dict[str, Any] | None:
        route_result = None
        bridge_method = None

        if step_type == "navigation.navigateTo":
            bridge_method = "navigateTo"
            route_result = app.navigate_to(payload["url"])
        elif step_type == "navigation.redirectTo":
            bridge_method = "redirectTo"
            route_result = app.redirect_to(payload["url"])
        elif step_type == "navigation.reLaunch":
            bridge_method = "reLaunch"
            route_result = app.relaunch(payload["url"])
        elif step_type == "navigation.switchTab":
            bridge_method = "switchTab"
            route_result = app.switch_tab(payload["url"])
        elif step_type == "navigation.back":
            bridge_method = "navigateBack"
            route_result = app.navigate_back(int(payload.get("delta", 1)))

        if bridge_method is None:
            return None

        route_path = getattr(route_result, "path", current_page_path)
        return {
            "bridge_method": bridge_method,
            "result": {
                "url": payload.get("url"),
                "delta": int(payload.get("delta", 1)),
                "pagePath": self._normalize_page_path(route_path),
            },
            "current_page_path": self._normalize_page_path(route_path),
        }

    def _call_real_bridge_async(
        self,
        app: Any,
        bridge_method: str,
        bridge_args: Any,
        payload: dict[str, Any],
    ) -> Any:
        timeout_ms = int(payload.get("timeoutMs", 15_000))
        timeout_seconds = max(timeout_ms / 1000, 0.001)
        message_id = app.call_wx_method_async(bridge_method, bridge_args)
        response = app.get_async_response(message_id, timeout=timeout_seconds)
        if response is None:
            raise CliExecutionError(
                error_code=ErrorCode.ACTION_ERROR,
                message=t("error.bridge_async_timeout"),
                details={
                    "bridge_method": bridge_method,
                    "timeout_ms": timeout_ms,
                },
            )
        return response

    def _execute_placeholder_bridge_action(
        self,
        session_metadata: dict[str, Any],
        current_page_path: str | None,
        step_type: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        state = self._placeholder_bridge_state(session_metadata, current_page_path)
        page_path = self._normalize_page_path(current_page_path or state["page_stack"][-1])

        if step_type == "storage.set":
            state["storage"][payload["key"]] = payload["value"]
            result = {"key": payload["key"], "value": payload["value"]}
        elif step_type == "storage.get":
            result = {"key": payload["key"], "value": state["storage"].get(payload["key"])}
        elif step_type == "storage.info":
            keys = sorted(state["storage"].keys())
            result = {"keys": keys, "currentSize": len(keys), "limitSize": 10240}
        elif step_type == "storage.remove":
            existed = payload["key"] in state["storage"]
            state["storage"].pop(payload["key"], None)
            result = {"key": payload["key"], "removed": existed}
        elif step_type == "storage.clear":
            state["storage"].clear()
            result = {"cleared": True}
        elif step_type.startswith("navigation."):
            page_path, result = self._execute_placeholder_navigation_action(state, page_path, step_type, payload)
        elif step_type == "app.getLaunchOptions":
            result = {
                "path": page_path,
                "query": {},
                "scene": 1001,
                "referrerInfo": {},
            }
        elif step_type == "app.getSystemInfo":
            result = {
                "brand": "devtools",
                "model": "placeholder",
                "platform": "devtools",
                "pixelRatio": 2,
                "screenWidth": 375,
                "screenHeight": 812,
                "windowWidth": 375,
                "windowHeight": 812,
            }
        elif step_type == "app.getAccountInfo":
            result = {
                "miniProgram": {
                    "appId": session_metadata.get("project_appid") or "mock-appid",
                    "envVersion": "develop",
                }
            }
        elif step_type == "settings.get":
            result = {"authSetting": dict(state["settings"])}
        elif step_type == "settings.authorize":
            state["settings"][payload["scope"]] = True
            result = {"scope": payload["scope"], "authorized": True}
        elif step_type == "settings.open":
            result = {"opened": True}
        elif step_type == "clipboard.set":
            state["clipboard"] = payload["text"]
            result = {"text": payload["text"]}
        elif step_type == "clipboard.get":
            result = {"text": state["clipboard"]}
        elif step_type == "ui.showToast":
            state["ui_state"] = {"type": "toast", "title": payload["title"]}
            result = {"shown": True, "title": payload["title"]}
        elif step_type == "ui.hideToast":
            state["ui_state"] = {"type": "toast", "title": ""}
            result = {"hidden": True}
        elif step_type == "ui.showLoading":
            state["ui_state"] = {"type": "loading", "title": payload["title"]}
            result = {"shown": True, "title": payload["title"]}
        elif step_type == "ui.hideLoading":
            state["ui_state"] = {"type": "loading", "title": ""}
            result = {"hidden": True}
        elif step_type == "ui.showModal":
            result = {"confirm": True, "cancel": False, "content": payload["content"]}
        elif step_type == "ui.showActionSheet":
            result = {"tapIndex": 0, "item": payload["itemList"][0]}
        elif step_type == "location.get":
            result = {
                "latitude": 23.1291,
                "longitude": 113.2644,
                "speed": -1,
                "accuracy": 30,
            }
        elif step_type == "location.choose":
            result = {
                "name": "Demo Location",
                "address": "Tianhe District",
                "latitude": 23.1291,
                "longitude": 113.2644,
            }
        elif step_type == "location.open":
            result = {
                "opened": True,
                "latitude": payload["latitude"],
                "longitude": payload["longitude"],
            }
        elif step_type == "media.chooseImage":
            result = {"tempFilePaths": ["/tmp/mock-image.png"], "tempFiles": [{"path": "/tmp/mock-image.png"}]}
        elif step_type == "media.chooseMedia":
            result = {"tempFiles": [{"tempFilePath": "/tmp/mock-media.png", "fileType": "image"}]}
        elif step_type == "media.takePhoto":
            result = {"tempImagePath": "/tmp/mock-photo.png"}
        elif step_type == "media.getImageInfo":
            result = {"path": payload["src"], "width": 120, "height": 120, "type": "png"}
        elif step_type == "media.saveImageToPhotosAlbum":
            result = {"saved": True, "filePath": payload["filePath"]}
        elif step_type == "file.upload":
            result = {"statusCode": 200, "data": "{\"ok\":true}", "errMsg": "uploadFile:ok"}
            self._emit_placeholder_network_request(
                session_metadata,
                request={
                    "url": payload["url"],
                    "method": "POST",
                    "resourceType": "upload",
                    "query": {},
                    "headers": {},
                    "body": {
                        "filePath": payload["filePath"],
                        "name": payload["name"],
                    },
                    "pagePath": page_path,
                },
                response={
                    "statusCode": 200,
                    "headers": {},
                    "body": {"ok": True},
                },
            )
        elif step_type == "file.download":
            result = {"tempFilePath": "/tmp/mock-download.bin", "statusCode": 200}
            self._emit_placeholder_network_request(
                session_metadata,
                request={
                    "url": payload["url"],
                    "method": "GET",
                    "resourceType": "download",
                    "query": {},
                    "headers": {},
                    "body": None,
                    "pagePath": page_path,
                },
                response={
                    "statusCode": 200,
                    "headers": {},
                    "body": {"tempFilePath": "/tmp/mock-download.bin"},
                },
            )
        elif step_type == "device.scanCode":
            result = {"result": "MINIUM-DEMO-CODE", "scanType": "QR_CODE"}
        elif step_type == "device.makePhoneCall":
            result = {"called": True, "phoneNumber": payload["phoneNumber"]}
        elif step_type == "auth.login":
            result = {"code": "mock-login-code"}
            self._emit_placeholder_network_request(
                session_metadata,
                request={
                    "url": "/api/login",
                    "method": "POST",
                    "resourceType": "request",
                    "query": {},
                    "headers": {},
                    "body": {"source": "auth.login"},
                    "pagePath": page_path,
                },
                response={
                    "statusCode": 200,
                    "headers": {},
                    "body": {"code": "mock-login-code"},
                },
            )
        elif step_type == "auth.checkSession":
            result = {"valid": True}
        elif step_type == "subscription.requestMessage":
            result = {"accepted": True, "tmplIds": list(payload["tmplIds"])}
        else:
            raise CliExecutionError(
                error_code=ErrorCode.PLAN_ERROR,
                message=t("error.step_not_implemented", step_type=step_type),
                details={"step_type": step_type},
            )

        return {
            "bridge_method": self._bridge_method_name(step_type),
            "result": result,
            "current_page_path": page_path,
        }

    def _execute_placeholder_navigation_action(
        self,
        state: dict[str, Any],
        current_page_path: str,
        step_type: str,
        payload: dict[str, Any],
    ) -> tuple[str, dict[str, Any]]:
        current_stack = self._sync_placeholder_page_stack(state, current_page_path)
        next_path = self._normalize_page_path(str(payload.get("url", current_page_path)).split("?")[0])

        if step_type == "navigation.navigateTo":
            current_stack.append(next_path)
        elif step_type == "navigation.redirectTo":
            if current_stack:
                current_stack[-1] = next_path
            else:
                current_stack.append(next_path)
        elif step_type == "navigation.reLaunch":
            current_stack = [next_path]
        elif step_type == "navigation.switchTab":
            current_stack = [next_path]
        elif step_type == "navigation.back":
            delta = max(1, int(payload.get("delta", 1)))
            if len(current_stack) > 1:
                current_stack = current_stack[: max(1, len(current_stack) - delta)]
            next_path = current_stack[-1]

        state["page_stack"] = current_stack
        return next_path, {
            "url": payload.get("url"),
            "delta": int(payload.get("delta", 1)),
            "pagePath": next_path,
        }

    def _apply_placeholder_page_transition(
        self,
        state: dict[str, Any],
        *,
        current_page_path: str,
        next_page_path: str,
        mode: str,
    ) -> str:
        current_stack = self._sync_placeholder_page_stack(state, current_page_path)
        normalized_next = self._normalize_page_path(next_page_path)

        if mode == "replace":
            if current_stack:
                current_stack[-1] = normalized_next
            else:
                current_stack = [normalized_next]
        elif mode == "reset":
            current_stack = [normalized_next]
        else:
            if not current_stack or current_stack[-1] != normalized_next:
                current_stack.append(normalized_next)

        state["page_stack"] = current_stack
        return normalized_next

    def _sync_placeholder_page_stack(
        self,
        state: dict[str, Any],
        current_page_path: str | None,
    ) -> list[str]:
        normalized_current = self._normalize_page_path(current_page_path)
        current_stack = [self._normalize_page_path(path) for path in list(state.get("page_stack") or [])]

        if not current_stack:
            current_stack = [normalized_current]
        elif current_stack[-1] != normalized_current:
            if normalized_current in current_stack:
                current_stack = current_stack[: current_stack.index(normalized_current) + 1]
            else:
                current_stack.append(normalized_current)

        state["page_stack"] = current_stack
        return current_stack

    def _build_bridge_request(self, step_type: str, payload: dict[str, Any]) -> tuple[str, Any]:
        if step_type == "storage.set":
            return "setStorageSync", {"key": payload["key"], "data": payload["value"]}
        if step_type == "storage.get":
            return "getStorageSync", {"key": payload["key"]}
        if step_type == "storage.info":
            return "getStorageInfoSync", {}
        if step_type == "storage.remove":
            return "removeStorageSync", {"key": payload["key"]}
        if step_type == "storage.clear":
            return "clearStorageSync", {}
        if step_type == "app.getLaunchOptions":
            return "getLaunchOptionsSync", {}
        if step_type == "app.getSystemInfo":
            return "getSystemInfoSync", {}
        if step_type == "app.getAccountInfo":
            return "getAccountInfoSync", {}
        if step_type == "settings.get":
            return "getSetting", {}
        if step_type == "settings.authorize":
            return "authorize", {"scope": payload["scope"]}
        if step_type == "settings.open":
            return "openSetting", {}
        if step_type == "clipboard.set":
            return "setClipboardData", {"data": payload["text"]}
        if step_type == "clipboard.get":
            return "getClipboardData", {}
        if step_type == "ui.showToast":
            return "showToast", self._compact_dict(
                {
                    "title": payload["title"],
                    "icon": payload.get("icon"),
                    "duration": payload.get("duration"),
                    "mask": payload.get("mask"),
                }
            )
        if step_type == "ui.hideToast":
            return "hideToast", {}
        if step_type == "ui.showLoading":
            return "showLoading", self._compact_dict({"title": payload["title"], "mask": payload.get("mask")})
        if step_type == "ui.hideLoading":
            return "hideLoading", {}
        if step_type == "ui.showModal":
            return "showModal", self._compact_dict(
                {
                    "title": payload["title"],
                    "content": payload["content"],
                    "showCancel": payload.get("showCancel"),
                    "confirmText": payload.get("confirmText"),
                    "cancelText": payload.get("cancelText"),
                }
            )
        if step_type == "ui.showActionSheet":
            return "showActionSheet", {"itemList": payload["itemList"]}
        if step_type == "location.get":
            return "getLocation", self._compact_dict({"type": payload.get("type"), "altitude": payload.get("altitude")})
        if step_type == "location.choose":
            return "chooseLocation", {}
        if step_type == "location.open":
            return "openLocation", self._compact_dict(
                {
                    "latitude": payload["latitude"],
                    "longitude": payload["longitude"],
                    "name": payload.get("name"),
                    "address": payload.get("address"),
                    "scale": payload.get("scale"),
                }
            )
        if step_type == "media.chooseImage":
            return "chooseImage", self._compact_dict(
                {
                    "count": payload.get("count"),
                    "sizeType": payload.get("sizeType"),
                    "sourceType": payload.get("sourceType"),
                }
            )
        if step_type == "media.chooseMedia":
            return "chooseMedia", self._compact_dict(
                {
                    "count": payload.get("count"),
                    "mediaType": payload.get("mediaType"),
                    "sourceType": payload.get("sourceType"),
                }
            )
        if step_type == "media.takePhoto":
            return "chooseMedia", {"count": 1, "mediaType": ["image"], "sourceType": ["camera"]}
        if step_type == "media.getImageInfo":
            return "getImageInfo", {"src": payload["src"]}
        if step_type == "media.saveImageToPhotosAlbum":
            return "saveImageToPhotosAlbum", {"filePath": payload["filePath"]}
        if step_type == "file.upload":
            return "uploadFile", self._compact_dict(
                {
                    "url": payload["url"],
                    "filePath": payload["filePath"],
                    "name": payload["name"],
                    "formData": payload.get("formData"),
                }
            )
        if step_type == "file.download":
            return "downloadFile", {"url": payload["url"]}
        if step_type == "device.scanCode":
            return "scanCode", self._compact_dict(
                {
                    "onlyFromCamera": payload.get("onlyFromCamera"),
                    "scanType": payload.get("scanType"),
                }
            )
        if step_type == "device.makePhoneCall":
            return "makePhoneCall", {"phoneNumber": payload["phoneNumber"]}
        if step_type == "auth.login":
            return "login", {}
        if step_type == "auth.checkSession":
            return "checkSession", {}
        if step_type == "subscription.requestMessage":
            return "requestSubscribeMessage", {"tmplIds": payload["tmplIds"]}
        raise CliExecutionError(
            error_code=ErrorCode.PLAN_ERROR,
            message=t("error.step_not_implemented", step_type=step_type),
            details={"step_type": step_type},
        )

    @staticmethod
    def _bridge_method_name(step_type: str) -> str:
        bridge_methods = {
            "storage.set": "setStorageSync",
            "storage.get": "getStorageSync",
            "storage.info": "getStorageInfoSync",
            "storage.remove": "removeStorageSync",
            "storage.clear": "clearStorageSync",
            "navigation.navigateTo": "navigateTo",
            "navigation.redirectTo": "redirectTo",
            "navigation.reLaunch": "reLaunch",
            "navigation.switchTab": "switchTab",
            "navigation.back": "navigateBack",
            "app.getLaunchOptions": "getLaunchOptionsSync",
            "app.getSystemInfo": "getSystemInfoSync",
            "app.getAccountInfo": "getAccountInfoSync",
            "settings.get": "getSetting",
            "settings.authorize": "authorize",
            "settings.open": "openSetting",
            "clipboard.set": "setClipboardData",
            "clipboard.get": "getClipboardData",
            "ui.showToast": "showToast",
            "ui.hideToast": "hideToast",
            "ui.showLoading": "showLoading",
            "ui.hideLoading": "hideLoading",
            "ui.showModal": "showModal",
            "ui.showActionSheet": "showActionSheet",
            "location.get": "getLocation",
            "location.choose": "chooseLocation",
            "location.open": "openLocation",
            "media.chooseImage": "chooseImage",
            "media.chooseMedia": "chooseMedia",
            "media.takePhoto": "chooseMedia",
            "media.getImageInfo": "getImageInfo",
            "media.saveImageToPhotosAlbum": "saveImageToPhotosAlbum",
            "file.upload": "uploadFile",
            "file.download": "downloadFile",
            "device.scanCode": "scanCode",
            "device.makePhoneCall": "makePhoneCall",
            "auth.login": "login",
            "auth.checkSession": "checkSession",
            "subscription.requestMessage": "requestSubscribeMessage",
        }
        return bridge_methods.get(step_type, step_type.split(".", 1)[-1])

    def _placeholder_bridge_state(
        self,
        session_metadata: dict[str, Any],
        current_page_path: str | None,
    ) -> dict[str, Any]:
        bridge_state = session_metadata.get("bridge_state")
        if isinstance(bridge_state, dict):
            return bridge_state
        normalized_page = self._normalize_page_path(current_page_path)
        bridge_state = {
            "storage": {},
            "clipboard": "",
            "settings": {},
            "ui_state": {"type": None, "title": ""},
            "page_stack": [normalized_page],
        }
        session_metadata["bridge_state"] = bridge_state
        return bridge_state

    def _ensure_network_runtime_supported(self, session_metadata: dict[str, Any]) -> None:
        driver = session_metadata.get("runtime_driver")
        if driver is None:
            return
        app = session_metadata.get("runtime_app")
        if app is None and driver is not None:
            app = getattr(driver, "app", None)
            session_metadata["runtime_app"] = app
        if app is None or not callable(getattr(app, "hook_wx_method", None)) or not callable(
            getattr(app, "release_hook_wx_method", None)
        ):
            raise CliExecutionError(
                error_code=ErrorCode.ENVIRONMENT_ERROR,
                message=t("error.network_runtime_unavailable"),
            )

    def _ensure_real_network_controls(
        self,
        session_metadata: dict[str, Any],
        network_state: NetworkState,
    ) -> dict[str, Any]:
        driver = session_metadata.get("runtime_driver")
        if driver is None:
            return {}
        runtime_state = session_metadata.setdefault(
            "network_runtime_state",
            {
                "initialized": False,
                "hook_ids": {},
                "pending_requests": {},
                "mocked_interfaces": [],
            },
        )
        if runtime_state.get("initialized"):
            return runtime_state

        app = session_metadata.get("runtime_app")
        if app is None:
            app = getattr(driver, "app", None)
            session_metadata["runtime_app"] = app
        if app is None:
            raise CliExecutionError(
                error_code=ErrorCode.ENVIRONMENT_ERROR,
                message=t("error.network_runtime_unavailable"),
            )

        class _HookCallbackAdapter:
            def __init__(self, callback):
                self._callback = callback

            def __call__(self, args):
                if isinstance(args, (list, tuple)):
                    return self._callback(*args)
                return self._callback(args)

        hook_ids: dict[str, int] = {}
        for interface_name in ("request", "uploadFile", "downloadFile"):
            before = _HookCallbackAdapter(
                lambda options, call_id=None, *_args, interface_name=interface_name: self._handle_real_network_before(
                    session_metadata,
                    network_state,
                    interface_name=interface_name,
                    options=options,
                    call_id=call_id,
                )
            )
            callback = _HookCallbackAdapter(
                lambda result, call_id=None, *_args, interface_name=interface_name: self._handle_real_network_callback(
                    session_metadata,
                    network_state,
                    interface_name=interface_name,
                    result=result,
                    call_id=call_id,
                )
            )
            hook_ids[interface_name] = app.hook_wx_method(
                interface_name,
                before=before,
                callback=callback,
                with_id=True,
            )

        runtime_state["initialized"] = True
        runtime_state["hook_ids"] = hook_ids
        return runtime_state

    def _handle_real_network_before(
        self,
        session_metadata: dict[str, Any],
        network_state: NetworkState,
        *,
        interface_name: str,
        options: Any,
        call_id: Any,
    ) -> None:
        normalized_options = options if isinstance(options, dict) else {}
        request = self._normalize_real_network_request(
            session_metadata,
            interface_name=interface_name,
            options=normalized_options,
            call_id=call_id,
        )
        rule = self._match_network_intercept_rule(network_state, request)
        outcome = "continue"
        if rule is not None:
            rule.hit_count += 1
            outcome = rule.behavior.action
            if outcome == "delay":
                time.sleep(max((rule.behavior.delay_ms or 0) / 1000, 0))

        pending_requests = self._ensure_real_network_controls(session_metadata, network_state).setdefault(
            "pending_requests",
            {},
        )
        pending_requests[str(call_id or request["requestId"])] = {
            "request": dict(request),
            "intercept_rule_id": rule.rule_id if rule is not None else None,
            "outcome": outcome,
        }

        listener_ids = self._matching_network_listener_ids(
            network_state,
            request=request,
            response=None,
            event_type="request",
        )
        network_state.add_event(
            request=request,
            response=None,
            listener_ids=listener_ids,
            intercept_rule_id=rule.rule_id if rule is not None else None,
            outcome=outcome,
        )

    def _handle_real_network_callback(
        self,
        session_metadata: dict[str, Any],
        network_state: NetworkState,
        *,
        interface_name: str,
        result: Any,
        call_id: Any,
    ) -> None:
        runtime_state = session_metadata.get("network_runtime_state")
        if not isinstance(runtime_state, dict):
            return
        pending_requests = runtime_state.get("pending_requests")
        if not isinstance(pending_requests, dict):
            return
        pending = pending_requests.pop(str(call_id), None)
        if not isinstance(pending, dict):
            return

        request = pending.get("request")
        if not isinstance(request, dict):
            return
        response = self._normalize_real_network_response(interface_name=interface_name, result=result)
        listener_ids = self._matching_network_listener_ids(
            network_state,
            request=request,
            response=response,
            event_type="response",
        )
        network_state.add_event(
            request=dict(request),
            response=response,
            listener_ids=listener_ids,
            intercept_rule_id=pending.get("intercept_rule_id"),
            outcome=str(pending.get("outcome") or "continue"),
        )

    def _sync_real_network_intercepts(
        self,
        session_metadata: dict[str, Any],
        network_state: NetworkState,
    ) -> None:
        driver = session_metadata.get("runtime_driver")
        if driver is None:
            return
        runtime_state = self._ensure_real_network_controls(session_metadata, network_state)
        app = session_metadata.get("runtime_app") or getattr(driver, "app", None)
        if app is None:
            raise CliExecutionError(
                error_code=ErrorCode.ENVIRONMENT_ERROR,
                message=t("error.network_runtime_unavailable"),
            )
        if not callable(getattr(app, "_mock_network", None)) or not callable(getattr(app, "_restore_network", None)):
            needs_mocking = any(
                rule.behavior.action in {"mock", "fail"}
                for rule in network_state.intercept_rules.values()
            )
            if needs_mocking:
                raise CliExecutionError(
                    error_code=ErrorCode.ENVIRONMENT_ERROR,
                    message=t("error.network_runtime_unavailable"),
                )
            return

        mocked_interfaces = runtime_state.setdefault("mocked_interfaces", [])
        for interface_name in tuple(dict.fromkeys(mocked_interfaces)):
            app._restore_network(interface_name)
        mocked_interfaces.clear()

        interface_map = {
            "request": "request",
            "uploadFile": "upload",
            "downloadFile": "download",
        }
        for interface_name, resource_type in interface_map.items():
            for rule in network_state.intercept_rules.values():
                if rule.behavior.action not in {"mock", "fail"}:
                    continue
                if not self._matcher_supports_resource_type(rule.matcher, resource_type):
                    continue
                mock_rule = self._build_real_network_mock_rule(rule, resource_type=resource_type)
                if mock_rule is None:
                    continue
                if rule.behavior.action == "mock":
                    app._mock_network(interface_name, mock_rule, success=self._build_real_mock_success(rule, interface_name))
                else:
                    app._mock_network(interface_name, mock_rule, fail=self._build_real_mock_failure(rule, interface_name))
                if interface_name not in mocked_interfaces:
                    mocked_interfaces.append(interface_name)

    def _cleanup_network_runtime(self, session_metadata: dict[str, Any]) -> None:
        runtime_state = session_metadata.pop("network_runtime_state", None)
        driver = session_metadata.get("runtime_driver")
        if not isinstance(runtime_state, dict):
            return
        if driver is None:
            return
        app = session_metadata.get("runtime_app") or getattr(driver, "app", None)
        if app is None:
            return
        for interface_name, hook_id in dict(runtime_state.get("hook_ids") or {}).items():
            if callable(getattr(app, "release_hook_wx_method", None)):
                try:
                    app.release_hook_wx_method(interface_name, hook_id)
                except Exception:
                    pass
        for interface_name in list(dict.fromkeys(runtime_state.get("mocked_interfaces") or [])):
            if callable(getattr(app, "_restore_network", None)):
                try:
                    app._restore_network(interface_name)
                except Exception:
                    pass

    def _normalize_real_network_request(
        self,
        session_metadata: dict[str, Any],
        *,
        interface_name: str,
        options: dict[str, Any],
        call_id: Any,
    ) -> dict[str, Any]:
        plain_options = self._to_plain_data(options)
        if not isinstance(plain_options, dict):
            plain_options = {}
        raw_url = str(plain_options.get("url") or "")
        split_result = urlsplit(raw_url)
        normalized_url = split_result.path or raw_url
        if split_result.scheme and split_result.netloc:
            normalized_url = f"{split_result.scheme}://{split_result.netloc}{split_result.path or ''}"
        query = {key: value for key, value in parse_qsl(split_result.query, keep_blank_values=True)}
        headers = plain_options.get("header")
        if not isinstance(headers, dict):
            headers = plain_options.get("headers")
        if not isinstance(headers, dict):
            headers = {}

        body: Any = None
        method = "GET"
        resource_type = "request"
        if interface_name == "uploadFile":
            method = str(plain_options.get("method") or "POST").upper()
            resource_type = "upload"
            body = self._compact_dict(
                {
                    "name": plain_options.get("name"),
                    "formData": plain_options.get("formData"),
                    "fileName": Path(str(plain_options.get("filePath") or "")).name or None,
                }
            )
        elif interface_name == "downloadFile":
            method = str(plain_options.get("method") or "GET").upper()
            resource_type = "download"
        else:
            method = str(plain_options.get("method") or "GET").upper()
            body = plain_options.get("data")
            if method == "GET" and isinstance(body, dict):
                query.update({str(key): value for key, value in body.items()})
                body = None

        return self._compact_dict(
            {
                "requestId": str(call_id) if call_id is not None else None,
                "url": normalized_url,
                "method": method,
                "resourceType": resource_type,
                "query": query,
                "headers": headers,
                "body": body,
                "pagePath": self._get_real_runtime_page_path(session_metadata),
            }
        )

    def _normalize_real_network_response(self, *, interface_name: str, result: Any) -> dict[str, Any]:
        plain_result = self._to_plain_data(result)
        if not isinstance(plain_result, dict):
            plain_result = {"value": plain_result}
        headers = plain_result.get("header")
        if not isinstance(headers, dict):
            headers = plain_result.get("headers")
        if not isinstance(headers, dict):
            headers = {}
        status_code = plain_result.get("statusCode")
        try:
            normalized_status_code = int(status_code) if status_code is not None else 0
        except (TypeError, ValueError):
            normalized_status_code = 0

        if interface_name == "downloadFile":
            body = self._compact_dict(
                {
                    "tempFilePath": plain_result.get("tempFilePath"),
                    "filePath": plain_result.get("filePath"),
                    "profile": plain_result.get("profile"),
                    "errMsg": plain_result.get("errMsg"),
                }
            )
        elif interface_name == "uploadFile":
            body = self._compact_dict(
                {
                    "data": plain_result.get("data"),
                    "errMsg": plain_result.get("errMsg"),
                }
            )
        else:
            body = plain_result.get("data")
            if body is None and plain_result.get("errMsg") is not None:
                body = self._compact_dict(
                    {
                        "errMsg": plain_result.get("errMsg"),
                        "errorCode": plain_result.get("errorCode"),
                    }
                )

        return {
            "statusCode": normalized_status_code,
            "headers": headers,
            "body": body,
        }

    def _build_real_network_mock_rule(
        self,
        rule: NetworkInterceptRuleState,
        *,
        resource_type: str,
    ) -> dict[str, Any] | None:
        matcher = rule.matcher
        mock_rule: dict[str, Any] = {}
        if matcher.url_pattern is not None:
            mock_rule["url"] = matcher.url_pattern
        elif matcher.url is not None:
            mock_rule["url"] = matcher.url
        if matcher.method is not None:
            mock_rule["method"] = matcher.method
        if matcher.query is not None:
            mock_rule["params"] = matcher.query
        if matcher.headers is not None:
            mock_rule["header"] = matcher.headers
        if matcher.body is not None:
            if resource_type == "request":
                mock_rule["data"] = matcher.body
            elif resource_type == "upload" and isinstance(matcher.body, dict):
                if "formData" in matcher.body:
                    mock_rule["formData"] = matcher.body["formData"]
                if "name" in matcher.body:
                    mock_rule["name"] = matcher.body["name"]
        return mock_rule

    @staticmethod
    def _build_real_mock_success(rule: NetworkInterceptRuleState, interface_name: str) -> dict[str, Any]:
        response = dict(rule.behavior.response or {})
        headers = response.get("headers")
        if not isinstance(headers, dict):
            headers = {}
        body = response.get("body")
        payload = {
            "statusCode": int(response.get("statusCode", 200)),
            "header": headers,
        }
        if interface_name == "downloadFile":
            payload["tempFilePath"] = body.get("tempFilePath") if isinstance(body, dict) else "/tmp/mock-download.bin"
        elif interface_name == "uploadFile":
            payload["data"] = json.dumps(body, ensure_ascii=False) if isinstance(body, (dict, list)) else (body or "")
        else:
            payload["data"] = body
        return payload

    @staticmethod
    def _build_real_mock_failure(rule: NetworkInterceptRuleState, interface_name: str) -> dict[str, Any]:
        error_message = rule.behavior.error_message or f"{interface_name}:fail mocked by miniprogram-minium-cli"
        payload = {
            "errMsg": error_message,
        }
        if rule.behavior.error_code is not None:
            payload["errorCode"] = rule.behavior.error_code
        return payload

    @staticmethod
    def _matcher_supports_resource_type(matcher: Any, resource_type: str) -> bool:
        matcher_resource_type = getattr(matcher, "resource_type", None)
        return matcher_resource_type in (None, resource_type)

    def _get_real_runtime_page_path(self, session_metadata: dict[str, Any]) -> str | None:
        app = session_metadata.get("runtime_app")
        if app is None:
            driver = session_metadata.get("runtime_driver")
            if driver is None:
                return None
            app = getattr(driver, "app", None)
        if app is None or not callable(getattr(app, "get_current_page", None)):
            return None
        try:
            page = app.get_current_page()
        except Exception:
            return None
        return self._normalize_page_path(getattr(page, "path", None))

    def _emit_placeholder_click_network_event(
        self,
        session_metadata: dict[str, Any],
        *,
        current_page_path: str,
        element_id: str,
    ) -> None:
        if not element_id:
            return
        if element_id == "login-button":
            self._emit_placeholder_network_request(
                session_metadata,
                request={
                    "url": "/api/login",
                    "method": "POST",
                    "resourceType": "request",
                    "query": {},
                    "headers": {"content-type": "application/json"},
                    "body": {"username": "demo-user"},
                    "pagePath": current_page_path,
                },
                response={
                    "statusCode": 200,
                    "headers": {"content-type": "application/json"},
                    "body": {"ok": True, "redirect": "pages/home/index"},
                },
            )
            return
        if element_id == "network-login-request-button":
            self._emit_placeholder_network_request(
                session_metadata,
                request={
                    "url": "https://service.invalid/api/login",
                    "method": "POST",
                    "resourceType": "request",
                    "query": {},
                    "headers": {"content-type": "application/json"},
                    "body": {"username": "demo-user"},
                    "pagePath": current_page_path,
                },
                response={
                    "statusCode": 200,
                    "headers": {"content-type": "application/json"},
                    "body": {"ok": True, "source": "demo-home"},
                },
            )
            return
        if element_id == "network-reviews-request-button":
            self._emit_placeholder_network_request(
                session_metadata,
                request={
                    "url": "https://service.invalid/api/reviews",
                    "method": "GET",
                    "resourceType": "request",
                    "query": {"tab": "main"},
                    "headers": {},
                    "body": None,
                    "pagePath": current_page_path,
                },
                response={
                    "statusCode": 200,
                    "headers": {"content-type": "application/json"},
                    "body": {"items": [{"id": "review-1", "score": 5}], "source": "demo-home"},
                },
            )
            return
        if element_id in {"home-to-review-board-button", "bridge-to-review-board-button"}:
            self._emit_placeholder_network_request(
                session_metadata,
                request={
                    "url": "/api/reviews",
                    "method": "GET",
                    "resourceType": "request",
                    "query": {"tab": "main"},
                    "headers": {},
                    "body": None,
                    "pagePath": current_page_path,
                },
                response={
                    "statusCode": 200,
                    "headers": {"content-type": "application/json"},
                    "body": {"items": [{"id": "review-1", "score": 5}]},
                },
            )

    def _emit_placeholder_network_request(
        self,
        session_metadata: dict[str, Any],
        *,
        request: dict[str, Any],
        response: dict[str, Any] | None,
    ) -> None:
        network_state = session_metadata.get("network_state")
        if not isinstance(network_state, NetworkState):
            return
        normalized_request = dict(request)
        normalized_request["resourceType"] = normalized_request.get("resourceType") or "request"
        rule = self._match_network_intercept_rule(network_state, normalized_request)
        resolved_response = dict(response) if isinstance(response, dict) else None
        outcome = "continue"
        if rule is not None:
            rule.hit_count += 1
            outcome = rule.behavior.action
            if outcome == "fail":
                resolved_response = {
                    "statusCode": 0,
                    "headers": {},
                    "body": {
                        "errorMessage": rule.behavior.error_message or "forced failure",
                        "errorCode": rule.behavior.error_code or "NETWORK_MOCK",
                    },
                }
            elif outcome == "delay":
                time.sleep(max((rule.behavior.delay_ms or 0) / 1000, 0))
            elif outcome == "mock":
                resolved_response = dict(rule.behavior.response or {})

        request_listener_ids = self._matching_network_listener_ids(
            network_state,
            request=normalized_request,
            response=None,
            event_type="request",
        )
        network_state.add_event(
            request=normalized_request,
            response=None,
            listener_ids=request_listener_ids,
            intercept_rule_id=rule.rule_id if rule is not None else None,
            outcome=outcome,
        )
        if resolved_response is not None:
            response_listener_ids = self._matching_network_listener_ids(
                network_state,
                request=normalized_request,
                response=resolved_response,
                event_type="response",
            )
            network_state.add_event(
                request=normalized_request,
                response=resolved_response,
                listener_ids=response_listener_ids,
                intercept_rule_id=rule.rule_id if rule is not None else None,
                outcome=outcome,
            )

    def _matching_network_listener_ids(
        self,
        network_state: NetworkState,
        *,
        request: dict[str, Any],
        response: dict[str, Any] | None,
        event_type: str,
    ) -> list[str]:
        temp_event = NetworkEvent(
            event_id="preview",
            request_id=str(request.get("requestId") or "preview-request"),
            event_type=event_type,
            sequence=0,
            timestamp_ms=int(time.time() * 1000),
            request=request,
            response=response,
        )
        matched_listener_ids: list[str] = []
        for listener_id, listener in network_state.listeners.items():
            if event_type == "response" and not listener.capture_responses:
                continue
            if listener.matcher is not None and not listener.matcher.matches(temp_event, event_kind=event_type):
                continue
            matched_listener_ids.append(listener_id)
        return matched_listener_ids

    @staticmethod
    def _match_network_intercept_rule(
        network_state: NetworkState,
        request: dict[str, Any],
    ) -> NetworkInterceptRuleState | None:
        preview_event = NetworkEvent(
            event_id="preview",
            request_id=str(request.get("requestId") or "preview-request"),
            event_type="request",
            sequence=0,
            timestamp_ms=int(time.time() * 1000),
            request=request,
            response=None,
        )
        for rule in network_state.intercept_rules.values():
            if rule.matcher.matches(preview_event, event_kind="request"):
                return rule
        return None

    @staticmethod
    def _compact_dict(payload: dict[str, Any]) -> dict[str, Any]:
        return {key: value for key, value in payload.items() if value is not None}

    def _extract_bridge_result(self, response: Any) -> Any:
        outer_result = self._lookup_value(response, "result")
        if outer_result is None:
            return self._to_plain_data(response)
        inner_result = self._lookup_value(outer_result, "result")
        if inner_result is None:
            return self._to_plain_data(outer_result)
        return self._to_plain_data(inner_result)

    @staticmethod
    def _lookup_value(target: Any, key: str) -> Any:
        if target is None:
            return None
        if isinstance(target, dict):
            return target.get(key)
        if hasattr(target, key):
            return getattr(target, key)
        return None

    def _to_plain_data(self, value: Any) -> Any:
        if value is None or isinstance(value, (str, int, float, bool)):
            return value
        if isinstance(value, list):
            return [self._to_plain_data(item) for item in value]
        if isinstance(value, tuple):
            return [self._to_plain_data(item) for item in value]
        if isinstance(value, dict):
            return {str(key): self._to_plain_data(item) for key, item in value.items()}
        if hasattr(value, "items") and callable(getattr(value, "items", None)):
            return {str(key): self._to_plain_data(item) for key, item in value.items()}
        if hasattr(value, "__dict__"):
            return {
                str(key): self._to_plain_data(item)
                for key, item in vars(value).items()
                if not str(key).startswith("_")
            }
        return str(value)

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
        project_appid = self._read_project_appid(project_path)
        uses_tourist_appid = project_appid == "touristappid"
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

        last_exception: Exception | None = None
        for attempt in range(1, 4):
            try:
                driver = Minium(conf)
                app = driver.app
                if initial_page_path:
                    app.navigate_to(initial_page_path)
                page = app.get_current_page()
                break
            except Exception as exc:  # pragma: no cover - 真实依赖路径
                last_exception = exc
                if attempt == 3:
                    raise CliExecutionError(
                        error_code=ErrorCode.ENVIRONMENT_ERROR,
                        message=t("error.minium_connect_failed"),
                        details={
                            **environment,
                            "cause": self._format_exception(exc),
                            "mode": mode,
                            "attempts": attempt,
                        },
                    ) from exc
                time.sleep(2)
                self._prepare_automation_target(project_path=project_path, test_port=self.config.test_port)

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
            "bridge_state": None,
            "project_appid": project_appid,
            "uses_tourist_appid": uses_tourist_appid,
        }

    def _start_placeholder_session(
        self,
        initial_page_path: str | None,
        metadata: dict[str, Any],
        environment: dict[str, str | bool | None],
        project_path: Path | None = None,
    ) -> dict[str, Any]:
        """启动占位会话。"""
        page_path = initial_page_path or "pages/index/index"
        project_appid = self._read_project_appid(project_path)
        uses_tourist_appid = project_appid == "touristappid"
        return {
            "backend": "placeholder",
            "connected": True,
            "current_page_path": self._normalize_page_path(page_path),
            "environment": environment,
            "note": "placeholder-runtime",
            "metadata": metadata,
            "runtime_driver": None,
            "runtime_app": None,
            "test_port": self.config.test_port,
            "bridge_state": {
                "storage": {},
                "clipboard": "",
                "settings": {},
                "ui_state": {"type": None, "title": ""},
                "page_stack": [self._normalize_page_path(page_path)],
            },
            "project_appid": project_appid,
            "uses_tourist_appid": uses_tourist_appid,
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
        return MiniumRuntimeAdapter._read_project_appid(project_path) == "touristappid"

    @staticmethod
    def _read_project_appid(project_path: Path | None) -> str | None:
        if project_path is None:
            return None
        project_config_path = project_path / "project.config.json"
        if not project_config_path.exists():
            return None
        try:
            payload = json.loads(project_config_path.read_text(encoding="utf-8"))
        except Exception:
            return None
        appid = str(payload.get("appid", "")).strip()
        return appid or None

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
        if callable(getattr(target, "click", None)):
            target.click()
            return
        if callable(getattr(target, "tap", None)):
            target.tap()
            return
        if callable(getattr(target, "trigger", None)):
            for event_name in ("tap", "click"):
                try:
                    target.trigger(event_name, {})
                    return
                except Exception:
                    continue
        if callable(getattr(target, "dispatch_event", None)):
            for event_name in ("tap", "click"):
                try:
                    target.dispatch_event(event_name, detail={})
                    return
                except Exception:
                    continue
        if callable(getattr(target, "trigger_events", None)):
            target.trigger_events(
                [
                    {"type": "tap", "detail": {}, "interval": 0},
                    {"type": "click", "detail": {}, "interval": 0},
                ]
            )
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
        page_path = MiniumRuntimeAdapter._normalize_page_path(page_path)
        if page_path == "pages/home/index":
            return [
                {
                    "id": "home-title",
                    "text": "Demo Home",
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
                {
                    "id": "home-to-bridge-lab-button",
                    "text": "Open the bridge lab",
                    "visible": True,
                    "enabled": True,
                    "editable": False,
                    "center_x": 180,
                    "center_y": 240,
                    "selector": "#home-to-bridge-lab-button",
                },
                {
                    "id": "home-to-review-board-button",
                    "text": "Open the review board",
                    "visible": True,
                    "enabled": True,
                    "editable": False,
                    "center_x": 180,
                    "center_y": 320,
                    "selector": "#home-to-review-board-button",
                },
                {
                    "id": "network-login-request-button",
                    "text": "Trigger login request",
                    "visible": True,
                    "enabled": True,
                    "editable": False,
                    "center_x": 180,
                    "center_y": 400,
                    "selector": "#network-login-request-button",
                },
                {
                    "id": "network-reviews-request-button",
                    "text": "Trigger reviews request",
                    "visible": True,
                    "enabled": True,
                    "editable": False,
                    "center_x": 180,
                    "center_y": 480,
                    "selector": "#network-reviews-request-button",
                },
            ]
        if page_path == "pages/bridge-lab/index":
            return [
                {
                    "id": "bridge-lab-title",
                    "text": "Bridge Lab",
                    "visible": True,
                    "enabled": True,
                    "editable": False,
                    "center_x": 180,
                    "center_y": 84,
                    "selector": "#bridge-lab-title",
                },
                {
                    "id": "bridge-high-priority-summary",
                    "text": "Storage, navigation, app context, settings, clipboard, toast, and loading plans start here.",
                    "visible": True,
                    "enabled": True,
                    "editable": False,
                    "center_x": 180,
                    "center_y": 184,
                    "selector": "#bridge-high-priority-summary",
                },
                {
                    "id": "bridge-medium-priority-summary",
                    "text": "Location, media, file, device, auth, and session flows are demonstrated with a placeholder-safe plan.",
                    "visible": True,
                    "enabled": True,
                    "editable": False,
                    "center_x": 180,
                    "center_y": 284,
                    "selector": "#bridge-medium-priority-summary",
                },
                {
                    "id": "bridge-touristappid-note",
                    "text": "Plans that require a developer-owned AppID should be skipped automatically when the demo project still uses touristappid.",
                    "visible": True,
                    "enabled": True,
                    "editable": False,
                    "center_x": 180,
                    "center_y": 384,
                    "selector": "#bridge-touristappid-note",
                },
                {
                    "id": "bridge-to-home-button",
                    "text": "Open the home page",
                    "visible": True,
                    "enabled": True,
                    "editable": False,
                    "center_x": 180,
                    "center_y": 484,
                    "selector": "#bridge-to-home-button",
                },
                {
                    "id": "bridge-to-review-board-button",
                    "text": "Open the review board",
                    "visible": True,
                    "enabled": True,
                    "editable": False,
                    "center_x": 180,
                    "center_y": 544,
                    "selector": "#bridge-to-review-board-button",
                },
            ]
        return [
            {
                "id": "login-button",
                "text": "WeChat Login",
                "visible": True,
                "enabled": True,
                "editable": False,
                "center_x": 180,
                "center_y": 240,
                "selector": "#login-button",
            },
            {
                "id": "login-title",
                "text": "Demo Login",
                "visible": True,
                "enabled": True,
                "editable": False,
                "center_x": 160,
                "center_y": 80,
                "selector": "#login-title",
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
