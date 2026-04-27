"""Network observation and interception service layer."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import time
from typing import Any

from ..adapters.minium.runtime import MiniumRuntimeAdapter
from ..support.i18n import t
from .errors import CliExecutionError, ErrorCode
from .network_models import (
    NetworkAssertConfig,
    NetworkEvent,
    NetworkInterceptConfig,
    NetworkInterceptRuleState,
    NetworkListenConfig,
    NetworkListenerState,
    NetworkRuntimeEvent,
    NetworkState,
    NetworkWaitConfig,
)
from .session_repository import SessionRepository

_REQUEST_ID_KEYS = {"requestId", "firstRequestId", "lastRequestId"}
_REQUEST_ID_ARRAY_KEYS = {"requestIds", "matchedRequestIds", "removedRequestIds", "sampleRequestIds"}
_EVENT_ID_KEYS = {"eventId", "firstEventId", "lastEventId"}
_EVENT_ID_ARRAY_KEYS = {"eventIds", "matchedEventIds", "removedEventIds"}
_LISTENER_ID_KEYS = {"listenerId"}
_LISTENER_ID_ARRAY_KEYS = {"listenerIds", "removedListenerIds"}
_INTERCEPT_ID_KEYS = {"interceptId"}
_INTERCEPT_ID_ARRAY_KEYS = {"interceptIds", "removedInterceptIds"}


def _now_ms() -> int:
    return int(time.time() * 1000)


def _isoformat_from_ms(timestamp_ms: int | None) -> str | None:
    if timestamp_ms is None:
        return None
    return datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc).isoformat()


def _dedupe_strings(values: list[str]) -> list[str]:
    return list(dict.fromkeys([value for value in values if value]))


@dataclass(slots=True)
class _NetworkArtifactBuilder:
    """Build a run-level network artifact from session-scoped state."""

    event_buffer: list[tuple[int, int, str, dict[str, Any]]] = field(default_factory=list)
    intercepts: dict[str, dict[str, Any]] = field(default_factory=dict)
    listeners: dict[str, dict[str, Any]] = field(default_factory=dict)
    requests: dict[str, dict[str, Any]] = field(default_factory=dict)
    session_ids: list[str] = field(default_factory=list)

    def add_session(self, session_id: str, network_state: NetworkState) -> None:
        self.session_ids.append(session_id)
        observed_events = sorted(network_state.events, key=lambda item: item.sequence)
        runtime_events = sorted(network_state.runtime_events, key=lambda item: item.sequence)

        for event in observed_events:
            self._upsert_request_record(session_id, event)

        for listener in network_state.listener_history.values():
            canonical_listener_id = self._canonical_id(session_id, listener.listener_id)
            event_ids = [self._canonical_id(session_id, event_id) for event_id in _dedupe_strings(listener.event_ids)]
            self.listeners[canonical_listener_id] = {
                "active": listener.active,
                "captureResponses": listener.capture_responses,
                "eventIds": event_ids,
                "firstEventId": event_ids[0] if event_ids else None,
                "hitCount": listener.total_hit_count,
                "lastEventId": event_ids[-1] if event_ids else None,
                "matcher": listener.matcher.to_dict() if listener.matcher is not None else None,
                "sessionId": session_id,
                "startedAt": _isoformat_from_ms(listener.started_at_ms),
                "stoppedAt": _isoformat_from_ms(listener.stopped_at_ms),
            }

        for intercept in network_state.intercept_history.values():
            canonical_intercept_id = self._canonical_id(session_id, intercept.rule_id)
            event_ids = [self._canonical_id(session_id, event_id) for event_id in _dedupe_strings(intercept.event_ids)]
            self.intercepts[canonical_intercept_id] = {
                "active": intercept.active,
                "addedAt": _isoformat_from_ms(intercept.added_at_ms),
                "behavior": intercept.behavior.to_dict(),
                "eventIds": event_ids,
                "firstEventId": event_ids[0] if event_ids else None,
                "hitCount": intercept.total_hit_count,
                "lastEventId": event_ids[-1] if event_ids else None,
                "matcher": intercept.matcher.to_dict(),
                "removedAt": _isoformat_from_ms(intercept.removed_at_ms),
                "sessionId": session_id,
            }

        for event in observed_events:
            event_type = "response.observed" if event.response is not None else "request.observed"
            request_id = self._canonical_id(session_id, event.request_id)
            listener_ids = [self._canonical_id(session_id, listener_id) for listener_id in event.listener_ids]
            intercept_id = self._canonical_id(session_id, event.intercept_rule_id)
            payload = {
                "data": {
                    "listenerIds": listener_ids,
                    "outcome": event.outcome,
                    "resourceType": event.request.get("resourceType"),
                },
                "eventId": self._canonical_id(session_id, event.event_id),
                "interceptId": intercept_id,
                "listenerId": listener_ids[0] if len(listener_ids) == 1 else None,
                "requestId": request_id,
                "sessionId": session_id,
                "stepId": None,
                "summary": self._observed_event_summary(event),
                "time": _isoformat_from_ms(event.timestamp_ms),
                "type": event_type,
            }
            if event.response is not None:
                payload["data"]["statusCode"] = event.response.get("statusCode")
            self.event_buffer.append((event.timestamp_ms, event.sequence, payload["eventId"], payload))

        for event in runtime_events:
            payload = {
                "data": self._canonicalize_event_data(session_id, event.data),
                "eventId": self._canonical_id(session_id, event.event_id),
                "interceptId": self._canonical_id(session_id, event.intercept_id),
                "listenerId": self._canonical_id(session_id, event.listener_id),
                "requestId": self._canonical_id(session_id, event.request_id),
                "sessionId": session_id,
                "stepId": event.step_id,
                "summary": event.summary,
                "time": _isoformat_from_ms(event.timestamp_ms),
                "type": event.event_type,
            }
            self.event_buffer.append((event.timestamp_ms, event.sequence, payload["eventId"], payload))

    def build(self) -> dict[str, Any]:
        events = [
            payload
            for _, _, _, payload in sorted(
                self.event_buffer,
                key=lambda item: (item[0], item[1], item[2]),
            )
        ]
        return {
            "schemaVersion": 1,
            "events": events,
            "requests": self.requests,
            "listeners": self.listeners,
            "intercepts": self.intercepts,
            "meta": {
                "eventCount": len(events),
                "requestCount": len(self.requests),
                "listenerCount": len(self.listeners),
                "interceptCount": len(self.intercepts),
                "sessionCount": len(self.session_ids),
                "sessionIds": list(self.session_ids),
            },
        }

    def _upsert_request_record(self, session_id: str, event: NetworkEvent) -> None:
        request_id = self._canonical_id(session_id, event.request_id)
        listener_ids = [self._canonical_id(session_id, listener_id) for listener_id in event.listener_ids]
        intercept_id = self._canonical_id(session_id, event.intercept_rule_id)
        event_id = self._canonical_id(session_id, event.event_id)
        record = self.requests.get(request_id)
        if record is None:
            record = {
                "body": event.request.get("body"),
                "eventIds": [],
                "firstEventId": None,
                "headers": event.request.get("headers"),
                "interceptIds": [],
                "lastEventId": None,
                "listenerIds": [],
                "method": event.request.get("method"),
                "outcome": event.outcome,
                "pagePath": event.request.get("pagePath"),
                "query": event.request.get("query"),
                "requestId": request_id,
                "resourceType": event.request.get("resourceType"),
                "responseBody": None,
                "responseHeaders": None,
                "sessionId": session_id,
                "statusCode": None,
                "url": event.request.get("url"),
            }
            self.requests[request_id] = record

        record["eventIds"] = _dedupe_strings(list(record["eventIds"]) + [event_id])
        record["firstEventId"] = record["eventIds"][0] if record["eventIds"] else None
        record["lastEventId"] = record["eventIds"][-1] if record["eventIds"] else None
        record["listenerIds"] = _dedupe_strings(list(record["listenerIds"]) + listener_ids)
        if intercept_id is not None:
            record["interceptIds"] = _dedupe_strings(list(record["interceptIds"]) + [intercept_id])
        if event.outcome is not None:
            record["outcome"] = event.outcome
        if event.response is not None:
            record["statusCode"] = event.response.get("statusCode")
            record["responseHeaders"] = event.response.get("headers")
            record["responseBody"] = event.response.get("body")

    @staticmethod
    def _canonical_id(session_id: str, local_id: str | None) -> str | None:
        if local_id is None:
            return None
        normalized = str(local_id).strip()
        if not normalized:
            return None
        return f"{session_id}/{normalized}"

    @classmethod
    def _canonicalize_event_data(cls, session_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        canonicalized: dict[str, Any] = {}
        for key, value in payload.items():
            if key in _REQUEST_ID_KEYS:
                canonicalized[key] = cls._canonical_id(session_id, value)
                continue
            if key in _REQUEST_ID_ARRAY_KEYS and isinstance(value, list):
                canonicalized[key] = [cls._canonical_id(session_id, item) for item in value if cls._canonical_id(session_id, item)]
                continue
            if key in _EVENT_ID_KEYS:
                canonicalized[key] = cls._canonical_id(session_id, value)
                continue
            if key in _EVENT_ID_ARRAY_KEYS and isinstance(value, list):
                canonicalized[key] = [cls._canonical_id(session_id, item) for item in value if cls._canonical_id(session_id, item)]
                continue
            if key in _LISTENER_ID_KEYS:
                canonicalized[key] = cls._canonical_id(session_id, value)
                continue
            if key in _LISTENER_ID_ARRAY_KEYS and isinstance(value, list):
                canonicalized[key] = [cls._canonical_id(session_id, item) for item in value if cls._canonical_id(session_id, item)]
                continue
            if key in _INTERCEPT_ID_KEYS:
                canonicalized[key] = cls._canonical_id(session_id, value)
                continue
            if key in _INTERCEPT_ID_ARRAY_KEYS and isinstance(value, list):
                canonicalized[key] = [cls._canonical_id(session_id, item) for item in value if cls._canonical_id(session_id, item)]
                continue
            canonicalized[key] = value
        return canonicalized

    @staticmethod
    def _observed_event_summary(event: NetworkEvent) -> str:
        method = str(event.request.get("method") or "GET")
        url = str(event.request.get("url") or "")
        if event.response is None:
            return f"Observed request {method} {url}"
        status_code = event.response.get("statusCode")
        return f"Observed response {status_code} for {method} {url}"


@dataclass(slots=True)
class NetworkService:
    """Service layer for network controls."""

    repository: SessionRepository
    runtime_adapter: MiniumRuntimeAdapter

    def start_listener(self, session_id: str, config: NetworkListenConfig, *, step_id: str | None = None) -> dict[str, Any]:
        session = self._require_session(session_id)
        listener_id = config.listener_id or session.network_state.allocate_listener_id()
        listener = session.network_state.listener_history.get(listener_id)
        if listener is None:
            listener = NetworkListenerState(
                listener_id=listener_id,
                matcher=config.matcher,
                capture_responses=config.capture_responses,
                max_events=config.max_events,
                last_clear_sequence=session.network_state.next_event_index,
            )
            session.network_state.listener_history[listener_id] = listener
        else:
            listener.matcher = config.matcher
            listener.capture_responses = config.capture_responses
            listener.max_events = config.max_events
            listener.matched_event_ids.clear()
            listener.hit_count = 0
            listener.active = True
            listener.started_at_ms = _now_ms()
            listener.stopped_at_ms = None
            listener.last_clear_sequence = session.network_state.next_event_index
        session.network_state.listeners[listener_id] = listener
        self.runtime_adapter.start_network_listener(session.metadata, session.network_state, listener)
        session.network_state.record_runtime_event(
            event_type="listener.started",
            summary=f"Listener {listener_id} started",
            listener_id=listener_id,
            step_id=step_id,
        )
        self.repository.update(session)
        return {
            "session_id": session_id,
            "listener_id": listener_id,
            "matcher": config.matcher.to_dict() if config.matcher is not None else None,
            "capture_responses": config.capture_responses,
            "max_events": config.max_events,
            "matched_event_ids": list(listener.matched_event_ids),
            "matched_count": listener.hit_count,
        }

    def stop_listener(self, session_id: str, listener_id: str, *, step_id: str | None = None) -> dict[str, Any]:
        session = self._require_session(session_id)
        listener = session.network_state.listeners.pop(listener_id, None)
        if listener is None:
            raise CliExecutionError(
                error_code=ErrorCode.ACTION_ERROR,
                message=t("error.network_listener_missing"),
                details={"listener_id": listener_id},
            )
        listener.active = False
        listener.stopped_at_ms = _now_ms()
        self.runtime_adapter.stop_network_listener(session.metadata, session.network_state, listener_id)
        session.network_state.record_runtime_event(
            event_type="listener.stopped",
            summary=f"Listener {listener_id} stopped",
            listener_id=listener_id,
            step_id=step_id,
        )
        self.repository.update(session)
        return {
            "session_id": session_id,
            "listener_id": listener_id,
            "removed": True,
            "matched_event_ids": list(listener.matched_event_ids),
            "matched_count": listener.hit_count,
        }

    def clear_listener_events(
        self,
        session_id: str,
        listener_id: str | None = None,
        *,
        step_id: str | None = None,
    ) -> dict[str, Any]:
        session = self._require_session(session_id)
        related_listener_ids = [listener_id] if listener_id is not None else list(session.network_state.listener_history.keys())
        cleared_count = self.runtime_adapter.clear_network_events(session.metadata, session.network_state, listener_id)
        session.network_state.record_runtime_event(
            event_type="listener.cleared",
            summary=f"Cleared network listener buffer{f' for {listener_id}' if listener_id else ''}",
            listener_id=listener_id,
            step_id=step_id,
            data={
                "clearedEventCount": cleared_count,
                "listenerIds": related_listener_ids,
            },
            related_listener_ids=related_listener_ids,
        )
        self.repository.update(session)
        return {
            "session_id": session_id,
            "listener_id": listener_id,
            "cleared_event_count": cleared_count,
            "remaining_event_count": session.network_state.count_visible_events(listener_id),
        }

    def wait_for_event(self, session_id: str, config: NetworkWaitConfig, *, step_id: str | None = None) -> dict[str, Any]:
        session = self._require_session(session_id)
        self._ensure_matcher_observation_ready(
            session.metadata,
            session.network_state,
            config.listener_id,
            config.matcher,
        )
        deadline = time.time() + max(config.timeout_ms / 1000, 0.001)
        while True:
            matched = self._select_events(
                session.network_state,
                listener_id=config.listener_id,
                matcher=config.matcher,
                event_type=config.event,
            )
            if matched:
                event = matched[-1]
                session.network_state.record_runtime_event(
                    event_type="step.network.wait.matched",
                    summary=f"Step {step_id or 'network.wait'} matched a {config.event} event",
                    request_id=event.request_id,
                    listener_id=config.listener_id,
                    intercept_id=event.intercept_rule_id,
                    step_id=step_id,
                    data={
                        "event": config.event,
                        "matchedCount": len(matched),
                        "matchedEventIds": [item.event_id for item in matched],
                        "matchedRequestIds": _dedupe_strings([item.request_id for item in matched]),
                    },
                    related_listener_ids=_dedupe_strings([config.listener_id or "", *event.listener_ids]),
                    related_intercept_ids=[event.intercept_rule_id] if event.intercept_rule_id else [],
                )
                self.repository.update(session)
                return {
                    "session_id": session_id,
                    "event": event.to_dict(),
                    "matched_event_ids": [item.event_id for item in matched],
                    "matched_count": len(matched),
                }
            if time.time() >= deadline:
                session.network_state.record_runtime_event(
                    event_type="step.network.wait.failed",
                    summary=f"Step {step_id or 'network.wait'} timed out waiting for a {config.event} event",
                    listener_id=config.listener_id,
                    step_id=step_id,
                    data={
                        "event": config.event,
                        "listenerId": config.listener_id,
                        "matcher": config.matcher.to_dict() if config.matcher is not None else None,
                        "timeoutMs": config.timeout_ms,
                    },
                    related_listener_ids=[config.listener_id] if config.listener_id else [],
                )
                self.repository.update(session)
                raise CliExecutionError(
                    error_code=ErrorCode.ACTION_ERROR,
                    message=t("error.network_wait_timed_out"),
                    details={
                        "listener_id": config.listener_id,
                        "event": config.event,
                        "timeout_ms": config.timeout_ms,
                    },
                )
            time.sleep(0.01)

    def assert_request(self, session_id: str, config: NetworkAssertConfig, *, step_id: str | None = None) -> dict[str, Any]:
        return self._assert_events(session_id, config, event_type="request", step_id=step_id)

    def assert_response(self, session_id: str, config: NetworkAssertConfig, *, step_id: str | None = None) -> dict[str, Any]:
        return self._assert_events(session_id, config, event_type="response", step_id=step_id)

    def add_intercept_rule(self, session_id: str, config: NetworkInterceptConfig, *, step_id: str | None = None) -> dict[str, Any]:
        session = self._require_session(session_id)
        rule_id = config.rule_id or session.network_state.allocate_rule_id()
        rule = session.network_state.intercept_history.get(rule_id)
        if rule is None:
            rule = NetworkInterceptRuleState(rule_id=rule_id, matcher=config.matcher, behavior=config.behavior)
            session.network_state.intercept_history[rule_id] = rule
        else:
            rule.matcher = config.matcher
            rule.behavior = config.behavior
            rule.hit_count = 0
            rule.active = True
            rule.added_at_ms = _now_ms()
            rule.removed_at_ms = None
        session.network_state.intercept_rules[rule_id] = rule
        self.runtime_adapter.add_network_intercept_rule(session.metadata, session.network_state, rule)
        session.network_state.record_runtime_event(
            event_type="intercept.added",
            summary=f"Intercept {rule_id} added",
            intercept_id=rule_id,
            step_id=step_id,
        )
        self.repository.update(session)
        return {
            "session_id": session_id,
            "rule_id": rule_id,
            "matcher": config.matcher.to_dict(),
            "behavior": config.behavior.to_dict(),
            "hit_count": rule.hit_count,
        }

    def remove_intercept_rule(self, session_id: str, rule_id: str, *, step_id: str | None = None) -> dict[str, Any]:
        session = self._require_session(session_id)
        rule = session.network_state.intercept_rules.pop(rule_id, None)
        if rule is None:
            raise CliExecutionError(
                error_code=ErrorCode.ACTION_ERROR,
                message=t("error.network_rule_missing"),
                details={"rule_id": rule_id},
            )
        rule.active = False
        rule.removed_at_ms = _now_ms()
        self.runtime_adapter.remove_network_intercept_rule(session.metadata, session.network_state, rule_id)
        session.network_state.record_runtime_event(
            event_type="intercept.removed",
            summary=f"Intercept {rule_id} removed",
            intercept_id=rule_id,
            step_id=step_id,
        )
        self.repository.update(session)
        return {
            "session_id": session_id,
            "rule_id": rule_id,
            "removed": True,
            "hit_count": rule.hit_count,
        }

    def clear_intercept_rules(self, session_id: str, *, step_id: str | None = None) -> dict[str, Any]:
        session = self._require_session(session_id)
        cleared_rule_ids = list(session.network_state.intercept_rules.keys())
        cleared_rule_count = len(cleared_rule_ids)
        removed_at_ms = _now_ms()
        for rule_id in cleared_rule_ids:
            rule = session.network_state.intercept_rules.get(rule_id)
            if rule is None:
                continue
            rule.active = False
            rule.removed_at_ms = removed_at_ms
        session.network_state.intercept_rules.clear()
        self.runtime_adapter.clear_network_intercept_rules(session.metadata, session.network_state)
        session.network_state.record_runtime_event(
            event_type="intercept.cleared",
            summary="Cleared intercept rules",
            step_id=step_id,
            data={
                "clearedRuleCount": cleared_rule_count,
                "interceptIds": cleared_rule_ids,
            },
            related_intercept_ids=cleared_rule_ids,
        )
        self.repository.update(session)
        return {
            "session_id": session_id,
            "cleared_rule_count": cleared_rule_count,
        }

    def snapshot_session(self, session_id: str) -> dict[str, Any]:
        session = self._require_session(session_id)
        return {
            "sessionId": session_id,
            "networkState": session.network_state.clone(),
        }

    def export_state(self, extra_sessions: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        builder = _NetworkArtifactBuilder()
        for snapshot in list(extra_sessions or []):
            session_id = snapshot.get("sessionId")
            network_state = snapshot.get("networkState")
            if not isinstance(session_id, str) or not isinstance(network_state, NetworkState):
                continue
            builder.add_session(session_id, network_state)
        for session_id in self.repository.list_ids():
            session = self.repository.get(session_id)
            if session is None:
                continue
            builder.add_session(session_id, session.network_state.clone())
        return builder.build()

    def collect_step_network_evidence(
        self,
        session_id: str,
        *,
        step_id: str,
        output: dict[str, Any] | None = None,
        input_data: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        session = self.repository.get(session_id)
        if session is None:
            return []
        evidence: list[dict[str, Any]] = []
        state = session.network_state
        step_events = [event for event in state.runtime_events if event.step_id == step_id]
        for event in step_events:
            evidence.append(self._build_evidence_item(session_id, runtime_event=event))
        if evidence:
            return self._dedupe_evidence(evidence)

        input_data = input_data or {}
        output = output or {}
        listener_id = input_data.get("listenerId") or output.get("listener_id")
        intercept_id = input_data.get("ruleId") or output.get("rule_id")
        event_ids = []
        if isinstance(output.get("matched_event_ids"), list):
            event_ids.extend([str(item) for item in output["matched_event_ids"] if str(item).strip()])
        event_payload = output.get("event")
        if isinstance(event_payload, dict) and event_payload.get("eventId"):
            event_ids.append(str(event_payload["eventId"]))
        for event_id in _dedupe_strings(event_ids):
            if not self._has_network_event_id(state, event_id):
                continue
            evidence.append(
                {
                    "eventId": self._canonical_id(session_id, event_id),
                    "summary": f"Referenced by step {step_id}",
                }
            )
        if listener_id and self._has_listener_id(state, str(listener_id)):
            evidence.append(
                {
                    "listenerId": self._canonical_id(session_id, str(listener_id)),
                    "summary": f"Referenced listener for step {step_id}",
                }
            )
        if intercept_id and self._has_intercept_id(state, str(intercept_id)):
            evidence.append(
                {
                    "interceptId": self._canonical_id(session_id, str(intercept_id)),
                    "summary": f"Referenced intercept for step {step_id}",
                }
            )
        return self._dedupe_evidence(evidence)

    def _assert_events(
        self,
        session_id: str,
        config: NetworkAssertConfig,
        *,
        event_type: str,
        step_id: str | None = None,
    ) -> dict[str, Any]:
        session = self._require_session(session_id)
        self._ensure_matcher_observation_ready(
            session.metadata,
            session.network_state,
            config.listener_id,
            config.matcher,
        )
        matched = self._select_events(
            session.network_state,
            listener_id=config.listener_id,
            matcher=config.matcher,
            event_type=event_type,
        )
        try:
            self._validate_assertion(session.network_state, matched, config, event_type)
        except CliExecutionError:
            session.network_state.record_runtime_event(
                event_type=f"step.assert.network{'Request' if event_type == 'request' else 'Response'}.failed",
                summary=f"Step {step_id or 'network.assert'} failed {event_type} assertion",
                listener_id=config.listener_id,
                step_id=step_id,
                data={
                    "event": event_type,
                    "listenerId": config.listener_id,
                    "matchedCount": len(matched),
                    "matchedEventIds": [event.event_id for event in matched],
                    "matchedRequestIds": _dedupe_strings([event.request_id for event in matched]),
                    "matcher": config.matcher.to_dict() if config.matcher is not None else None,
                },
                related_listener_ids=[config.listener_id] if config.listener_id else [],
            )
            self.repository.update(session)
            raise

        session.network_state.record_runtime_event(
            event_type=f"step.assert.network{'Request' if event_type == 'request' else 'Response'}.matched",
            summary=f"Step {step_id or 'network.assert'} matched {len(matched)} {event_type} event(s)",
            request_id=matched[-1].request_id if matched else None,
            listener_id=config.listener_id,
            intercept_id=matched[-1].intercept_rule_id if matched and matched[-1].intercept_rule_id else None,
            step_id=step_id,
            data={
                "event": event_type,
                "matchedCount": len(matched),
                "matchedEventIds": [event.event_id for event in matched],
                "matchedRequestIds": _dedupe_strings([event.request_id for event in matched]),
                "firstEventId": matched[0].event_id if matched else None,
                "lastEventId": matched[-1].event_id if matched else None,
                "matcher": config.matcher.to_dict() if config.matcher is not None else None,
            },
            related_listener_ids=[config.listener_id] if config.listener_id else [],
            related_intercept_ids=_dedupe_strings(
                [event.intercept_rule_id for event in matched if event.intercept_rule_id]
            ),
        )
        self.repository.update(session)
        return {
            "session_id": session_id,
            "matched_event_ids": [event.event_id for event in matched],
            "matched_count": len(matched),
            "first_event_id": matched[0].event_id if matched else None,
            "last_event_id": matched[-1].event_id if matched else None,
            "matcher": config.matcher.to_dict() if config.matcher is not None else None,
        }

    def _validate_assertion(
        self,
        network_state: NetworkState,
        matched: list[NetworkEvent],
        config: NetworkAssertConfig,
        event_type: str,
    ) -> None:
        matched_count = len(matched)
        if config.count is not None and matched_count != config.count:
            self._raise_assertion_failure(config, event_type, matched_count)
        if config.min_count is not None and matched_count < config.min_count:
            self._raise_assertion_failure(config, event_type, matched_count)
        if config.max_count is not None and matched_count > config.max_count:
            self._raise_assertion_failure(config, event_type, matched_count)
        if config.within_ms is not None and len(matched) >= 2:
            duration = matched[-1].timestamp_ms - matched[0].timestamp_ms
            if duration > config.within_ms:
                self._raise_assertion_failure(config, event_type, matched_count)
        if config.ordered_after is not None:
            ordered_after_sequence = self._resolve_event_sequence(network_state, config.ordered_after)
            if ordered_after_sequence is None or not matched or matched[0].sequence <= ordered_after_sequence:
                self._raise_assertion_failure(config, event_type, matched_count)
        if config.ordered_before is not None:
            ordered_before_sequence = self._resolve_event_sequence(network_state, config.ordered_before)
            if ordered_before_sequence is None or not matched or matched[-1].sequence >= ordered_before_sequence:
                self._raise_assertion_failure(config, event_type, matched_count)
        if all(
            value is None
            for value in (
                config.count,
                config.min_count,
                config.max_count,
                config.within_ms,
                config.ordered_after,
                config.ordered_before,
            )
        ) and matched_count == 0:
            self._raise_assertion_failure(config, event_type, matched_count)

    def _raise_assertion_failure(self, config: NetworkAssertConfig, event_type: str, matched_count: int) -> None:
        raise CliExecutionError(
            error_code=ErrorCode.ASSERTION_FAILED,
            message=t("error.network_assertion_failed"),
            details={
                "event_type": event_type,
                "matched_count": matched_count,
                "matcher": config.matcher.to_dict() if config.matcher is not None else None,
                "listener_id": config.listener_id,
            },
        )

    @staticmethod
    def _select_events(
        network_state: NetworkState,
        *,
        listener_id: str | None,
        matcher,
        event_type: str,
    ) -> list[NetworkEvent]:
        selected = [event for event in network_state.events if event.event_type == event_type]
        if listener_id is not None:
            listener = network_state.listener_history.get(listener_id)
            clear_sequence = listener.last_clear_sequence if listener is not None else 0
            selected = [
                event
                for event in selected
                if listener_id in event.listener_ids and event.sequence > clear_sequence
            ]
        if matcher is not None:
            selected = [event for event in selected if matcher.matches(event, event_kind=event_type)]
        return selected

    @staticmethod
    def _resolve_event_sequence(network_state: NetworkState, event_id: str) -> int | None:
        for event in network_state.events:
            if event.event_id == event_id:
                return event.sequence
        return None

    def _require_session(self, session_id: str):
        session = self.repository.get(session_id)
        if session is None:
            raise CliExecutionError(
                error_code=ErrorCode.SESSION_ERROR,
                message=t("error.invalid_session"),
                details={"session_id": session_id},
            )
        return session

    def _ensure_matcher_observation_ready(
        self,
        session_metadata: dict[str, Any],
        network_state: NetworkState,
        listener_id: str | None,
        matcher: Any,
    ) -> None:
        if listener_id is not None or matcher is None:
            return
        self.runtime_adapter.ensure_network_observation(session_metadata, network_state)

    @staticmethod
    def _canonical_id(session_id: str, local_id: str | None) -> str | None:
        if local_id is None:
            return None
        normalized = str(local_id).strip()
        if not normalized:
            return None
        return f"{session_id}/{normalized}"

    @staticmethod
    def _has_network_event_id(network_state: NetworkState, event_id: str) -> bool:
        normalized = str(event_id).strip()
        if not normalized:
            return False
        return any(event.event_id == normalized for event in network_state.events) or any(
            event.event_id == normalized for event in network_state.runtime_events
        )

    @staticmethod
    def _has_listener_id(network_state: NetworkState, listener_id: str) -> bool:
        normalized = str(listener_id).strip()
        return bool(normalized and normalized in network_state.listener_history)

    @staticmethod
    def _has_intercept_id(network_state: NetworkState, intercept_id: str) -> bool:
        normalized = str(intercept_id).strip()
        return bool(normalized and normalized in network_state.intercept_history)

    def _build_evidence_item(self, session_id: str, *, runtime_event: NetworkRuntimeEvent) -> dict[str, Any]:
        request_id = self._canonical_id(session_id, runtime_event.request_id)
        listener_id = self._canonical_id(session_id, runtime_event.listener_id)
        intercept_id = self._canonical_id(session_id, runtime_event.intercept_id)
        data = runtime_event.data or {}
        if request_id is None and isinstance(data.get("requestId"), str):
            request_id = self._canonical_id(session_id, data.get("requestId"))
        if listener_id is None and isinstance(data.get("listenerId"), str):
            listener_id = self._canonical_id(session_id, data.get("listenerId"))
        if intercept_id is None and isinstance(data.get("interceptId"), str):
            intercept_id = self._canonical_id(session_id, data.get("interceptId"))
        return {
            "eventId": self._canonical_id(session_id, runtime_event.event_id),
            "requestId": request_id,
            "listenerId": listener_id,
            "interceptId": intercept_id,
            "summary": runtime_event.summary,
        }

    @staticmethod
    def _dedupe_evidence(evidence: list[dict[str, Any]]) -> list[dict[str, Any]]:
        seen: set[tuple[Any, ...]] = set()
        deduped: list[dict[str, Any]] = []
        for item in evidence:
            key = (
                item.get("eventId"),
                item.get("requestId"),
                item.get("listenerId"),
                item.get("interceptId"),
                item.get("summary"),
            )
            if key in seen:
                continue
            seen.add(key)
            deduped.append(item)
        return deduped
