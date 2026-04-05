"""Structured error model for the Python execution runtime."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class ErrorCode(str, Enum):
    """Structured runtime error codes."""

    ENVIRONMENT_ERROR = "ENVIRONMENT_ERROR"
    PLAN_ERROR = "PLAN_ERROR"
    SESSION_ERROR = "SESSION_ERROR"
    ACTION_ERROR = "ACTION_ERROR"
    ASSERTION_FAILED = "ASSERTION_FAILED"
    INTERNAL_ERROR = "INTERNAL_ERROR"


@dataclass
class CliExecutionError(Exception):
    """Structured execution error."""

    error_code: ErrorCode
    message: str
    details: dict[str, Any] = field(default_factory=dict)
    artifacts: list[str] = field(default_factory=list)

    def to_response(self) -> dict[str, Any]:
        return {
            "error_code": self.error_code.value,
            "message": self.message,
            "details": self.details,
            "artifacts": self.artifacts,
        }
