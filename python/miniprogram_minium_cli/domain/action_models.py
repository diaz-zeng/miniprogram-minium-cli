"""动作与断言相关模型。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .errors import CliExecutionError, ErrorCode
from ..support.i18n import t

_SUPPORTED_LOCATOR_TYPES = {"css", "text", "id"}
_SUPPORTED_WAIT_KINDS = {"page_path_equals", "element_exists", "element_visible"}
_RAW_GESTURE_FIELDS = {"touches", "changedTouches", "script", "events"}


@dataclass(slots=True)
class Locator:
    """结构化定位器。"""

    type: str
    value: str
    index: int = 0

    @classmethod
    def from_input(cls, payload: Any) -> "Locator":
        if not isinstance(payload, dict):
            raise CliExecutionError(
                error_code=ErrorCode.PLAN_ERROR,
                message=t("error.locator_input_object"),
            )
        locator_type = str(payload.get("type", "")).strip()
        locator_value = str(payload.get("value", "")).strip()
        locator_index = int(payload.get("index", 0))
        if locator_type not in _SUPPORTED_LOCATOR_TYPES:
            raise CliExecutionError(
                error_code=ErrorCode.PLAN_ERROR,
                message=t("error.unsupported_locator_type"),
                details={
                    "locator_type": locator_type,
                    "supported_types": sorted(_SUPPORTED_LOCATOR_TYPES),
                },
            )
        if not locator_value:
            raise CliExecutionError(
                error_code=ErrorCode.PLAN_ERROR,
                message=t("error.locator_value_empty"),
            )
        if locator_index < 0:
            raise CliExecutionError(
                error_code=ErrorCode.PLAN_ERROR,
                message=t("error.locator_index_invalid"),
            )
        return cls(type=locator_type, value=locator_value, index=locator_index)

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "value": self.value,
            "index": self.index,
        }


@dataclass(slots=True)
class WaitCondition:
    """显式等待条件。"""

    kind: str
    expected_value: str | None = None
    locator: Locator | None = None
    timeout_ms: int = 3000

    @classmethod
    def from_input(cls, payload: Any) -> "WaitCondition":
        if not isinstance(payload, dict):
            raise CliExecutionError(
                error_code=ErrorCode.PLAN_ERROR,
                message=t("error.wait_input_object"),
            )
        kind = str(payload.get("kind", "")).strip()
        expected_value = payload.get("expectedValue")
        timeout_ms = int(payload.get("timeoutMs", 3000))
        locator_payload = payload.get("locator")
        locator = Locator.from_input(locator_payload) if locator_payload is not None else None
        if kind not in _SUPPORTED_WAIT_KINDS:
            raise CliExecutionError(
                error_code=ErrorCode.PLAN_ERROR,
                message=t("error.unsupported_wait_kind"),
                details={
                    "wait_kind": kind,
                    "supported_kinds": sorted(_SUPPORTED_WAIT_KINDS),
                },
            )
        if kind == "page_path_equals" and not isinstance(expected_value, str):
            raise CliExecutionError(
                error_code=ErrorCode.PLAN_ERROR,
                message=t("error.page_path_expected_value"),
            )
        if kind in {"element_exists", "element_visible"} and locator is None:
            raise CliExecutionError(
                error_code=ErrorCode.PLAN_ERROR,
                message=t("error.wait_requires_locator", kind=kind),
            )
        if timeout_ms < 1:
            raise CliExecutionError(
                error_code=ErrorCode.PLAN_ERROR,
                message=t("error.timeout_ms_invalid"),
            )
        return cls(
            kind=kind,
            expected_value=expected_value if isinstance(expected_value, str) else None,
            locator=locator,
            timeout_ms=timeout_ms,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "expectedValue": self.expected_value,
            "locator": self.locator.to_dict() if self.locator is not None else None,
            "timeoutMs": self.timeout_ms,
        }


@dataclass(slots=True)
class GestureTarget:
    """手势目标，支持定位器与绝对坐标。"""

    locator: Locator | None = None
    x: float | None = None
    y: float | None = None

    @classmethod
    def from_input(cls, payload: Any, *, allow_empty: bool = False) -> "GestureTarget | None":
        if payload is None:
            if allow_empty:
                return None
            raise CliExecutionError(
                error_code=ErrorCode.PLAN_ERROR,
                message=t("error.gesture_target_required"),
            )
        if not isinstance(payload, dict):
            raise CliExecutionError(
                error_code=ErrorCode.PLAN_ERROR,
                message=t("error.gesture_target_object"),
            )
        unsupported_fields = sorted(_RAW_GESTURE_FIELDS.intersection(payload.keys()))
        if unsupported_fields:
            raise CliExecutionError(
                error_code=ErrorCode.PLAN_ERROR,
                message=t("error.gesture_raw_injection"),
                details={"unsupported_fields": unsupported_fields},
            )
        locator_payload = payload.get("locator")
        locator = Locator.from_input(locator_payload) if locator_payload is not None else None
        has_x = payload.get("x") is not None
        has_y = payload.get("y") is not None
        if locator is not None and not has_x and not has_y:
            return cls(locator=locator)
        if locator_payload is not None:
            try:
                x = float(payload["x"])
                y = float(payload["y"])
            except (KeyError, TypeError, ValueError) as exc:
                raise CliExecutionError(
                    error_code=ErrorCode.PLAN_ERROR,
                    message=t("error.gesture_target_coordinates"),
                ) from exc
            return cls(locator=locator, x=x, y=y)

        if not has_x and not has_y and allow_empty:
            return None

        try:
            x = float(payload["x"])
            y = float(payload["y"])
        except (KeyError, TypeError, ValueError) as exc:
            raise CliExecutionError(
                error_code=ErrorCode.PLAN_ERROR,
                message=t("error.gesture_target_coordinates"),
            ) from exc
        return cls(x=x, y=y)

    def to_dict(self) -> dict[str, Any]:
        return {
            "locator": self.locator.to_dict() if self.locator is not None else None,
            "x": self.x,
            "y": self.y,
        }
