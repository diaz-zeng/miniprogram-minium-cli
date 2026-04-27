import * as assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import { buildUvRunArgs, createRuntimeContext } from "../src/runtime";

test("network service rolls back failed listener and intercept registration", async () => {
  const context = await createRuntimeContext();
  const script = String.raw`
from miniprogram_minium_cli.domain.errors import CliExecutionError, ErrorCode
from miniprogram_minium_cli.domain.network_models import (
    NetworkInterceptBehavior,
    NetworkInterceptConfig,
    NetworkListenConfig,
    NetworkMatcher,
)
from miniprogram_minium_cli.domain.network_service import NetworkService
from miniprogram_minium_cli.domain.session_repository import SessionRepository


class FailingAdapter:
    def start_network_listener(self, session_metadata, network_state, listener):
        raise CliExecutionError(ErrorCode.ENVIRONMENT_ERROR, "listener start failed")

    def add_network_intercept_rule(self, session_metadata, network_state, rule):
        raise CliExecutionError(ErrorCode.ENVIRONMENT_ERROR, "intercept add failed")


def expect_cli_error(callback):
    try:
        callback()
    except CliExecutionError:
        return
    raise AssertionError("Expected CliExecutionError")


repository = SessionRepository(timeout_seconds=60)
session = repository.create(metadata={})
service = NetworkService(repository=repository, runtime_adapter=FailingAdapter())

expect_cli_error(
    lambda: service.start_listener(
        session.session_id,
        NetworkListenConfig(listener_id="failed-listener"),
    )
)
state = repository.get(session.session_id).network_state
assert "failed-listener" not in state.listeners
assert "failed-listener" not in state.listener_history

expect_cli_error(
    lambda: service.add_intercept_rule(
        session.session_id,
        NetworkInterceptConfig(
            rule_id="failed-rule",
            matcher=NetworkMatcher(url="/api/fail"),
            behavior=NetworkInterceptBehavior(action="fail"),
        ),
    )
)
state = repository.get(session.session_id).network_state
assert "failed-rule" not in state.intercept_rules
assert "failed-rule" not in state.intercept_history
`;

  const result = spawnSync(
    context.uvBin,
    buildUvRunArgs(context.layout, context.pythonRequest, ["-c", script]),
    {
      cwd: process.cwd(),
      env: context.env,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
});
