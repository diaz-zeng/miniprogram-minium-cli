"""Network observation and interception models."""

from __future__ import annotations

from dataclasses import dataclass, field
from time import time
from typing import Any

from ..support.i18n import t
from .errors import CliExecutionError, ErrorCode

_SUPPORTED_NETWORK_EVENTS = {"request", "response"}
_SUPPORTED_RESOURCE_TYPES = {"request", "upload", "download"}
_SUPPORTED_INTERCEPT_ACTIONS = {"continue", "fail", "delay", "mock"}


def _now_ms() -> int:
    return int(time() * 1000)


@dataclass(slots=True)
class NetworkMatcher:
    """Structured matcher for network events."""

    url: str | None = None
    url_pattern: str | None = None
    method: str | None = None
    resource_type: str | None = None
    query: dict[str, Any] | None = None
    headers: dict[str, Any] | None = None
    body: Any = None
    status_code: int | None = None
    response_headers: dict[str, Any] | None = None
    response_body: Any = None

    @classmethod
    def from_input(cls, payload: Any, *, required: bool = False) -> "NetworkMatcher | None":
        if payload is None:
            if required:
                raise CliExecutionError(
                    error_code=ErrorCode.PLAN_ERROR,
                    message=t("error.network_matcher_required"),
                )
            return None
        if not isinstance(payload, dict):
            raise CliExecutionError(
                error_code=ErrorCode.PLAN_ERROR,
                message=t("error.network_matcher_object"),
            )
        resource_type = payload.get("resourceType")
        if resource_type is not None and resource_type not in _SUPPORTED_RESOURCE_TYPES:
            raise CliExecutionError(
                error_code=ErrorCode.PLAN_ERROR,
                message=t("error.network_resource_type_invalid"),
                details={"resource_type": resource_type, "supported_types": sorted(_SUPPORTED_RESOURCE_TYPES)},
            )
        status_code = payload.get("statusCode")
        if status_code is not None:
            try:
                status_code = int(status_code)
            except (TypeError, ValueError) as exc:
                raise CliExecutionError(
                    error_code=ErrorCode.PLAN_ERROR,
                    message=t("error.network_status_code_invalid"),
                ) from exc
        for field_name in ("query", "headers", "responseHeaders"):
            field_value = payload.get(field_name)
            if field_value is not None and not isinstance(field_value, dict):
                raise CliExecutionError(
                    error_code=ErrorCode.PLAN_ERROR,
                    message=t("error.network_matcher_field_object", field_name=field_name),
                )
        return cls(
            url=_optional_string(payload.get("url")),
            url_pattern=_optional_string(payload.get("urlPattern")),
            method=_normalize_method(payload.get("method")),
            resource_type=_optional_string(resource_type),
            query=dict(payload["query"]) if isinstance(payload.get("query"), dict) else None,
            headers=dict(payload["headers"]) if isinstance(payload.get("headers"), dict) else None,
            body=payload.get("body"),
            status_code=status_code,
            response_headers=dict(payload["responseHeaders"]) if isinstance(payload.get("responseHeaders"), dict) else None,
            response_body=payload.get("responseBody"),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "url": self.url,
            "urlPattern": self.url_pattern,
            "method": self.method,
            "resourceType": self.resource_type,
            "query": self.query,
            "headers": self.headers,
            "body": self.body,
            "statusCode": self.status_code,
            "responseHeaders": self.response_headers,
            "responseBody": self.response_body,
        }

    def matches(self, event: "NetworkEvent", *, event_kind: str | None = None) -> bool:
        request = event.request
        response = event.response or {}
        if event_kind == "response" and not event.response:
            return False
        if self.url is not None and request.get("url") != self.url:
            return False
        if self.url_pattern is not None and self.url_pattern not in str(request.get("url") or ""):
            return False
        if self.method is not None and str(request.get("method") or "").upper() != self.method:
            return False
        if self.resource_type is not None and request.get("resourceType") != self.resource_type:
            return False
        if self.query is not None and not _contains_subset(self.query, request.get("query")):
            return False
        if self.headers is not None and not _contains_subset(self.headers, request.get("headers")):
            return False
        if self.body is not None and not _contains_subset(self.body, request.get("body")):
            return False
        if self.status_code is not None and response.get("statusCode") != self.status_code:
            return False
        if self.response_headers is not None and not _contains_subset(self.response_headers, response.get("headers")):
            return False
        if self.response_body is not None and not _contains_subset(self.response_body, response.get("body")):
            return False
        return True


@dataclass(slots=True)
class NetworkListenConfig:
    """Listener registration config."""

    listener_id: str | None = None
    matcher: NetworkMatcher | None = None
    capture_responses: bool = False
    max_events: int | None = None

    @classmethod
    def from_input(cls, payload: Any) -> "NetworkListenConfig":
        if payload is None:
            payload = {}
        if not isinstance(payload, dict):
            raise CliExecutionError(error_code=ErrorCode.PLAN_ERROR, message=t("error.network_input_object"))
        max_events = payload.get("maxEvents")
        if max_events is not None:
            try:
                max_events = int(max_events)
            except (TypeError, ValueError) as exc:
                raise CliExecutionError(error_code=ErrorCode.PLAN_ERROR, message=t("error.network_max_events_invalid")) from exc
        return cls(
            listener_id=_optional_string(payload.get("listenerId")),
            matcher=NetworkMatcher.from_input(payload.get("matcher")),
            capture_responses=bool(payload.get("captureResponses", False)),
            max_events=max_events,
        )


@dataclass(slots=True)
class NetworkWaitConfig:
    """Wait config for request or response events."""

    listener_id: str | None = None
    matcher: NetworkMatcher | None = None
    event: str = "request"
    timeout_ms: int = 3000

    @classmethod
    def from_input(cls, payload: Any) -> "NetworkWaitConfig":
        if not isinstance(payload, dict):
            raise CliExecutionError(error_code=ErrorCode.PLAN_ERROR, message=t("error.network_input_object"))
        event = str(payload.get("event", "request")).strip() or "request"
        if event not in _SUPPORTED_NETWORK_EVENTS:
            raise CliExecutionError(
                error_code=ErrorCode.PLAN_ERROR,
                message=t("error.network_event_invalid"),
                details={"event": event, "supported_events": sorted(_SUPPORTED_NETWORK_EVENTS)},
            )
        timeout_ms = int(payload.get("timeoutMs", 3000))
        if payload.get("listenerId") is None and payload.get("matcher") is None:
            raise CliExecutionError(
                error_code=ErrorCode.PLAN_ERROR,
                message=t("error.network_wait_target_required"),
            )
        return cls(
            listener_id=_optional_string(payload.get("listenerId")),
            matcher=NetworkMatcher.from_input(payload.get("matcher")),
            event=event,
            timeout_ms=timeout_ms,
        )


@dataclass(slots=True)
class NetworkAssertConfig:
    """Assertion config over observed network events."""

    listener_id: str | None = None
    matcher: NetworkMatcher | None = None
    count: int | None = None
    min_count: int | None = None
    max_count: int | None = None
    within_ms: int | None = None
    ordered_after: str | None = None
    ordered_before: str | None = None

    @classmethod
    def from_input(cls, payload: Any) -> "NetworkAssertConfig":
        if payload is None:
            payload = {}
        if not isinstance(payload, dict):
            raise CliExecutionError(error_code=ErrorCode.PLAN_ERROR, message=t("error.network_input_object"))
        count = _optional_int(payload.get("count"))
        min_count = _optional_int(payload.get("minCount"))
        max_count = _optional_int(payload.get("maxCount"))
        within_ms = _optional_int(payload.get("withinMs"))
        if count is not None and (min_count is not None or max_count is not None):
            raise CliExecutionError(
                error_code=ErrorCode.PLAN_ERROR,
                message=t("error.network_assert_count_conflict"),
            )
        return cls(
            listener_id=_optional_string(payload.get("listenerId")),
            matcher=NetworkMatcher.from_input(payload.get("matcher")),
            count=count,
            min_count=min_count,
            max_count=max_count,
            within_ms=within_ms,
            ordered_after=_optional_string(payload.get("orderedAfter")),
            ordered_before=_optional_string(payload.get("orderedBefore")),
        )


@dataclass(slots=True)
class NetworkInterceptBehavior:
    """Behavior for a matched interception rule."""

    action: str
    delay_ms: int | None = None
    error_message: str | None = None
    error_code: str | None = None
    response: dict[str, Any] | None = None

    @classmethod
    def from_input(cls, payload: Any) -> "NetworkInterceptBehavior":
        if not isinstance(payload, dict):
            raise CliExecutionError(error_code=ErrorCode.PLAN_ERROR, message=t("error.network_intercept_behavior_object"))
        action = str(payload.get("action", "")).strip()
        if action not in _SUPPORTED_INTERCEPT_ACTIONS:
            raise CliExecutionError(
                error_code=ErrorCode.PLAN_ERROR,
                message=t("error.network_intercept_action_invalid"),
                details={"action": action, "supported_actions": sorted(_SUPPORTED_INTERCEPT_ACTIONS)},
            )
        delay_ms = _optional_int(payload.get("delayMs"))
        if action == "delay" and delay_ms is None:
            raise CliExecutionError(error_code=ErrorCode.PLAN_ERROR, message=t("error.network_delay_required"))
        response = payload.get("response")
        if action == "mock" and not isinstance(response, dict):
            raise CliExecutionError(error_code=ErrorCode.PLAN_ERROR, message=t("error.network_mock_response_object"))
        return cls(
            action=action,
            delay_ms=delay_ms,
            error_message=_optional_string(payload.get("errorMessage")),
            error_code=_optional_string(payload.get("errorCode")),
            response=dict(response) if isinstance(response, dict) else None,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "action": self.action,
            "delayMs": self.delay_ms,
            "errorMessage": self.error_message,
            "errorCode": self.error_code,
            "response": self.response,
        }


@dataclass(slots=True)
class NetworkInterceptConfig:
    """Registration config for interception rules."""

    rule_id: str | None
    matcher: NetworkMatcher
    behavior: NetworkInterceptBehavior

    @classmethod
    def from_input(cls, payload: Any) -> "NetworkInterceptConfig":
        if not isinstance(payload, dict):
            raise CliExecutionError(error_code=ErrorCode.PLAN_ERROR, message=t("error.network_input_object"))
        return cls(
            rule_id=_optional_string(payload.get("ruleId")),
            matcher=NetworkMatcher.from_input(payload.get("matcher"), required=True) or NetworkMatcher(),
            behavior=NetworkInterceptBehavior.from_input(payload.get("behavior")),
        )


@dataclass(slots=True)
class NetworkEvent:
    """Normalized event captured during a run."""

    event_id: str
    request_id: str
    event_type: str
    sequence: int
    timestamp_ms: int
    request: dict[str, Any]
    response: dict[str, Any] | None = None
    listener_ids: list[str] = field(default_factory=list)
    intercept_rule_id: str | None = None
    outcome: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "eventId": self.event_id,
            "requestId": self.request_id,
            "eventType": self.event_type,
            "sequence": self.sequence,
            "timestampMs": self.timestamp_ms,
            "request": self.request,
            "response": self.response,
            "listenerIds": list(self.listener_ids),
            "interceptRuleId": self.intercept_rule_id,
            "outcome": self.outcome,
        }


@dataclass(slots=True)
class NetworkListenerState:
    """Registered listener state."""

    listener_id: str
    matcher: NetworkMatcher | None
    capture_responses: bool = False
    max_events: int | None = None
    matched_event_ids: list[str] = field(default_factory=list)
    hit_count: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "listenerId": self.listener_id,
            "matcher": self.matcher.to_dict() if self.matcher is not None else None,
            "captureResponses": self.capture_responses,
            "maxEvents": self.max_events,
            "matchedEventIds": list(self.matched_event_ids),
            "hitCount": self.hit_count,
        }


@dataclass(slots=True)
class NetworkInterceptRuleState:
    """Registered interception rule."""

    rule_id: str
    matcher: NetworkMatcher
    behavior: NetworkInterceptBehavior
    hit_count: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "ruleId": self.rule_id,
            "matcher": self.matcher.to_dict(),
            "behavior": self.behavior.to_dict(),
            "hitCount": self.hit_count,
        }


@dataclass(slots=True)
class NetworkState:
    """Session-scoped network state."""

    listeners: dict[str, NetworkListenerState] = field(default_factory=dict)
    intercept_rules: dict[str, NetworkInterceptRuleState] = field(default_factory=dict)
    events: list[NetworkEvent] = field(default_factory=list)
    next_listener_index: int = 0
    next_rule_index: int = 0
    next_request_index: int = 0
    next_event_index: int = 0

    def allocate_listener_id(self) -> str:
        self.next_listener_index += 1
        return f"listener-{self.next_listener_index}"

    def allocate_rule_id(self) -> str:
        self.next_rule_index += 1
        return f"rule-{self.next_rule_index}"

    def allocate_request_id(self) -> str:
        self.next_request_index += 1
        return f"request-{self.next_request_index}"

    def allocate_event_id(self, event_type: str) -> str:
        self.next_event_index += 1
        return f"{event_type}-{self.next_event_index}"

    def add_event(self, *, request: dict[str, Any], response: dict[str, Any] | None, listener_ids: list[str], intercept_rule_id: str | None, outcome: str | None) -> NetworkEvent:
        event_type = "response" if response is not None else "request"
        request_id = str(request.get("requestId") or self.allocate_request_id())
        request["requestId"] = request_id
        event = NetworkEvent(
            event_id=self.allocate_event_id(event_type),
            request_id=request_id,
            event_type=event_type,
            sequence=self.next_event_index,
            timestamp_ms=_now_ms(),
            request=request,
            response=response,
            listener_ids=list(listener_ids),
            intercept_rule_id=intercept_rule_id,
            outcome=outcome,
        )
        self.events.append(event)
        for listener_id in listener_ids:
            listener = self.listeners.get(listener_id)
            if listener is None:
                continue
            listener.hit_count += 1
            if listener.max_events is None or len(listener.matched_event_ids) < listener.max_events:
                listener.matched_event_ids.append(event.event_id)
        return event

    def to_dict(self) -> dict[str, Any]:
        return {
            "listeners": {listener_id: listener.to_dict() for listener_id, listener in self.listeners.items()},
            "interceptRules": {rule_id: rule.to_dict() for rule_id, rule in self.intercept_rules.items()},
            "events": [event.to_dict() for event in self.events],
        }


def _optional_string(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _optional_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise CliExecutionError(error_code=ErrorCode.PLAN_ERROR, message=t("error.network_numeric_invalid")) from exc


def _normalize_method(value: Any) -> str | None:
    text = _optional_string(value)
    return text.upper() if text is not None else None


def _contains_subset(expected: Any, actual: Any) -> bool:
    if isinstance(expected, dict):
        if not isinstance(actual, dict):
            return False
        return all(key in actual and _contains_subset(value, actual[key]) for key, value in expected.items())
    if isinstance(expected, list):
        if not isinstance(actual, list) or len(expected) > len(actual):
            return False
        return all(_contains_subset(item, actual[index]) for index, item in enumerate(expected))
    return expected == actual
