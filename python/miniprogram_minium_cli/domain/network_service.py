"""Network observation and interception service layer."""

from __future__ import annotations

from dataclasses import dataclass
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
    NetworkState,
    NetworkWaitConfig,
)
from .session_repository import SessionRepository


@dataclass(slots=True)
class NetworkService:
    """Service layer for network controls."""

    repository: SessionRepository
    runtime_adapter: MiniumRuntimeAdapter

    def start_listener(self, session_id: str, config: NetworkListenConfig) -> dict[str, Any]:
        session = self._require_session(session_id)
        listener_id = config.listener_id or session.network_state.allocate_listener_id()
        listener = NetworkListenerState(
            listener_id=listener_id,
            matcher=config.matcher,
            capture_responses=config.capture_responses,
            max_events=config.max_events,
        )
        session.network_state.listeners[listener_id] = listener
        self.runtime_adapter.start_network_listener(session.metadata, session.network_state, listener)
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

    def stop_listener(self, session_id: str, listener_id: str) -> dict[str, Any]:
        session = self._require_session(session_id)
        listener = session.network_state.listeners.pop(listener_id, None)
        if listener is None:
            raise CliExecutionError(
                error_code=ErrorCode.ACTION_ERROR,
                message=t("error.network_listener_missing"),
                details={"listener_id": listener_id},
            )
        self.runtime_adapter.stop_network_listener(session.metadata, session.network_state, listener_id)
        self.repository.update(session)
        return {
            "session_id": session_id,
            "listener_id": listener_id,
            "removed": True,
            "matched_event_ids": list(listener.matched_event_ids),
            "matched_count": listener.hit_count,
        }

    def clear_listener_events(self, session_id: str, listener_id: str | None = None) -> dict[str, Any]:
        session = self._require_session(session_id)
        cleared_count = self.runtime_adapter.clear_network_events(session.metadata, session.network_state, listener_id)
        self.repository.update(session)
        return {
            "session_id": session_id,
            "listener_id": listener_id,
            "cleared_event_count": cleared_count,
            "remaining_event_count": len(session.network_state.events),
        }

    def wait_for_event(self, session_id: str, config: NetworkWaitConfig) -> dict[str, Any]:
        session = self._require_session(session_id)
        self._ensure_matcher_observation_ready(
            session.metadata,
            session.network_state,
            config.listener_id,
            config.matcher,
        )
        deadline = time.time() + max(config.timeout_ms / 1000, 0.001)
        while True:
            matched = self._select_events(session.network_state, listener_id=config.listener_id, matcher=config.matcher, event_type=config.event)
            if matched:
                event = matched[-1]
                self.repository.update(session)
                return {
                    "session_id": session_id,
                    "event": event.to_dict(),
                    "matched_event_ids": [item.event_id for item in matched],
                    "matched_count": len(matched),
                }
            if time.time() >= deadline:
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

    def assert_request(self, session_id: str, config: NetworkAssertConfig) -> dict[str, Any]:
        return self._assert_events(session_id, config, event_type="request")

    def assert_response(self, session_id: str, config: NetworkAssertConfig) -> dict[str, Any]:
        return self._assert_events(session_id, config, event_type="response")

    def add_intercept_rule(self, session_id: str, config: NetworkInterceptConfig) -> dict[str, Any]:
        session = self._require_session(session_id)
        rule_id = config.rule_id or session.network_state.allocate_rule_id()
        rule = NetworkInterceptRuleState(rule_id=rule_id, matcher=config.matcher, behavior=config.behavior)
        session.network_state.intercept_rules[rule_id] = rule
        self.runtime_adapter.add_network_intercept_rule(session.metadata, session.network_state, rule)
        self.repository.update(session)
        return {
            "session_id": session_id,
            "rule_id": rule_id,
            "matcher": config.matcher.to_dict(),
            "behavior": config.behavior.to_dict(),
            "hit_count": rule.hit_count,
        }

    def remove_intercept_rule(self, session_id: str, rule_id: str) -> dict[str, Any]:
        session = self._require_session(session_id)
        rule = session.network_state.intercept_rules.pop(rule_id, None)
        if rule is None:
            raise CliExecutionError(
                error_code=ErrorCode.ACTION_ERROR,
                message=t("error.network_rule_missing"),
                details={"rule_id": rule_id},
            )
        self.runtime_adapter.remove_network_intercept_rule(session.metadata, session.network_state, rule_id)
        self.repository.update(session)
        return {
            "session_id": session_id,
            "rule_id": rule_id,
            "removed": True,
            "hit_count": rule.hit_count,
        }

    def clear_intercept_rules(self, session_id: str) -> dict[str, Any]:
        session = self._require_session(session_id)
        cleared_rule_count = len(session.network_state.intercept_rules)
        session.network_state.intercept_rules.clear()
        self.runtime_adapter.clear_network_intercept_rules(session.metadata, session.network_state)
        self.repository.update(session)
        return {
            "session_id": session_id,
            "cleared_rule_count": cleared_rule_count,
        }

    def snapshot_session(self, session_id: str) -> dict[str, Any]:
        session = self._require_session(session_id)
        return {
            "sessionId": session_id,
            **session.network_state.to_dict(),
        }

    def export_state(self, extra_sessions: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        snapshots: list[dict[str, Any]] = list(extra_sessions or [])
        for session_id in self.repository.list_ids():
            session = self.repository.get(session_id)
            if session is None:
                continue
            snapshots.append(
                {
                    "sessionId": session_id,
                    **session.network_state.to_dict(),
                }
            )
        total_event_count = sum(len(item.get("events", [])) for item in snapshots)
        return {
            "sessionCount": len(snapshots),
            "eventCount": total_event_count,
            "sessions": snapshots,
        }

    def _assert_events(self, session_id: str, config: NetworkAssertConfig, *, event_type: str) -> dict[str, Any]:
        session = self._require_session(session_id)
        self._ensure_matcher_observation_ready(
            session.metadata,
            session.network_state,
            config.listener_id,
            config.matcher,
        )
        matched = self._select_events(session.network_state, listener_id=config.listener_id, matcher=config.matcher, event_type=event_type)
        self._validate_assertion(session.network_state, matched, config, event_type)
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
            for value in (config.count, config.min_count, config.max_count, config.within_ms, config.ordered_after, config.ordered_before)
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
    def _select_events(network_state: NetworkState, *, listener_id: str | None, matcher, event_type: str) -> list[NetworkEvent]:
        selected = [event for event in network_state.events if event.event_type == event_type]
        if listener_id is not None:
            selected = [event for event in selected if listener_id in event.listener_ids]
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
