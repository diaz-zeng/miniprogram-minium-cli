"""会话仓库实现。"""

from __future__ import annotations

from datetime import timedelta
from threading import RLock
from uuid import uuid4

from .session_models import AcceptanceSession, utcnow


class SessionRepository:
    """基于内存的会话仓库。"""

    def __init__(self, timeout_seconds: int) -> None:
        self._timeout = timedelta(seconds=timeout_seconds)
        self._lock = RLock()
        self._sessions: dict[str, AcceptanceSession] = {}

    def create(self, metadata: dict | None = None) -> AcceptanceSession:
        """创建一个新会话。"""
        session = AcceptanceSession(
            session_id=uuid4().hex,
            metadata=metadata or {},
        )
        with self._lock:
            self._sessions[session.session_id] = session
        return session

    def get(self, session_id: str) -> AcceptanceSession | None:
        """获取一个未过期会话。"""
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None or self._is_expired(session):
                return None
            return session

    def update(self, session: AcceptanceSession) -> AcceptanceSession:
        """保存最新会话状态。"""
        session.touch()
        with self._lock:
            self._sessions[session.session_id] = session
        return session

    def delete(self, session_id: str) -> bool:
        """删除指定会话。"""
        with self._lock:
            return self._sessions.pop(session_id, None) is not None

    def list_ids(self) -> list[str]:
        """列出当前未过期会话。"""
        with self._lock:
            return [
                session_id
                for session_id, session in self._sessions.items()
                if not self._is_expired(session)
            ]

    def pop_expired(self) -> list[AcceptanceSession]:
        """移除并返回所有已过期会话。"""
        expired_sessions: list[AcceptanceSession] = []
        with self._lock:
            for session_id, session in list(self._sessions.items()):
                if self._is_expired(session):
                    expired = self._sessions.pop(session_id, None)
                    if expired is not None:
                        expired_sessions.append(expired)
        return expired_sessions

    def _is_expired(self, session: AcceptanceSession) -> bool:
        return utcnow() - session.last_active_at > self._timeout
