"""Runtime config loading."""

from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path
from typing import Any

_AUTO_SCREENSHOT_MODES = {"off", "on-success", "always"}


@dataclass
class CliRuntimeConfig:
    """Execution runtime config derived from env and plan."""

    language: str
    runtime_mode: str
    project_path: Path | None
    wechat_devtool_path: Path | None
    artifacts_dir: Path
    session_timeout_seconds: int
    test_port: int
    auto_screenshot: str


def load_runtime_config(plan: dict[str, Any]) -> CliRuntimeConfig:
    environment = plan.get("environment", {})
    language = str(
        environment.get("language")
        or os.environ.get("MINIPROGRAM_MINIUM_CLI_LANGUAGE")
        or "en-US"
    )
    project_path_raw = environment.get("projectPath")
    runtime_mode = str(
        environment.get("runtimeMode")
        or os.environ.get("MINIPROGRAM_MINIUM_CLI_RUNTIME_MODE")
        or "auto"
    ).strip().lower()
    wechat_devtool_path_raw = environment.get("wechatDevtoolPath")
    artifacts_dir_raw = (
        environment.get("artifactsDir")
        or os.environ.get("MINIPROGRAM_MINIUM_CLI_ARTIFACTS_DIR")
        or Path.cwd() / ".minium-cli" / "runs"
    )
    session_timeout_seconds = int(
        environment.get("sessionTimeoutSeconds")
        or os.environ.get("MINIPROGRAM_MINIUM_CLI_SESSION_TIMEOUT_SECONDS")
        or 1800
    )
    test_port = int(environment.get("testPort", 9420))
    auto_screenshot = str(
        environment.get("autoScreenshot")
        or os.environ.get("MINIPROGRAM_MINIUM_CLI_AUTO_SCREENSHOT")
        or "off"
    ).strip().lower()
    if auto_screenshot not in _AUTO_SCREENSHOT_MODES:
        auto_screenshot = "off"

    return CliRuntimeConfig(
        language=language,
        runtime_mode=runtime_mode,
        project_path=Path(project_path_raw).expanduser().resolve()
        if project_path_raw
        else None,
        wechat_devtool_path=Path(wechat_devtool_path_raw).expanduser().resolve()
        if wechat_devtool_path_raw
        else None,
        artifacts_dir=Path(artifacts_dir_raw).expanduser().resolve(),
        session_timeout_seconds=session_timeout_seconds,
        test_port=test_port,
        auto_screenshot=auto_screenshot,
    )
