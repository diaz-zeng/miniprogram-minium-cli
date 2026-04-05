import * as assert from "node:assert/strict";
import { test } from "node:test";

import { deriveExecutionExitCode, formatHelp, main, parseArgv } from "../src/cli/main";

test("parseArgv parses exec command", () => {
  const parsed = parseArgv([
    "exec",
    "--plan",
    "./plan.json",
    "--project-path",
    "./examples/demo-miniapp",
    "--wechat-devtool-path",
    "/Applications/wechatwebdevtools.app/Contents/MacOS/cli",
    "--runtime-mode",
    "real",
    "--auto-screenshot",
    "always",
  ]);
  assert.equal(parsed.command, "exec");
  if (parsed.command !== "exec") {
    return;
  }
  assert.equal(parsed.options.planPath, "./plan.json");
  assert.equal(parsed.options.projectPath, "./examples/demo-miniapp");
  assert.equal(parsed.options.runtimeMode, "real");
  assert.equal(parsed.options.autoScreenshot, "always");
});

test("parseArgv parses exec command with inline json plan", () => {
  const parsed = parseArgv([
    "exec",
    "--plan-json",
    '{"version":1,"kind":"miniapp-test-plan"}',
    "--runtime-mode",
    "placeholder",
    "--json",
  ]);
  assert.equal(parsed.command, "exec");
  if (parsed.command !== "exec") {
    return;
  }
  assert.equal(parsed.options.planJson, '{"version":1,"kind":"miniapp-test-plan"}');
  assert.equal(parsed.options.runtimeMode, "placeholder");
  assert.equal(parsed.options.json, true);
});

test("parseArgv parses prepare-runtime command", () => {
  const parsed = parseArgv(["prepare-runtime", "--json"]);
  assert.equal(parsed.command, "prepare-runtime");
  if (parsed.command !== "prepare-runtime") {
    return;
  }
  assert.equal(parsed.options.json, true);
});

test("deriveExecutionExitCode maps structured runtime failures", () => {
  assert.equal(
    deriveExecutionExitCode({
      ok: false,
      protocolVersion: 1,
      error: {
        error_code: "ASSERTION_FAILED",
      },
    }),
    1,
  );
  assert.equal(
    deriveExecutionExitCode({
      ok: false,
      protocolVersion: 1,
      error: {
        error_code: "ENVIRONMENT_ERROR",
      },
    }),
    2,
  );
  assert.equal(
    deriveExecutionExitCode({
      ok: false,
      protocolVersion: 1,
      error: {
        error_code: "PLAN_ERROR",
      },
    }),
    3,
  );
});

test("deriveExecutionExitCode maps successful and failed summaries", () => {
  assert.equal(
    deriveExecutionExitCode({
      ok: true,
      protocolVersion: 1,
      result: {
        summary: {
          status: "passed",
        },
      },
    }),
    0,
  );
  assert.equal(
    deriveExecutionExitCode({
      ok: true,
      protocolVersion: 1,
      result: {
        summary: {
          status: "failed",
        },
      },
    }),
    1,
  );
});

test("formatHelp supports Chinese output", () => {
  const help = formatHelp("zh-CN");
  assert.match(help, /用法：/);
  assert.match(help, /命令：/);
  assert.doesNotMatch(help, /\brun\b/);
});

test("main reports usage errors for removed run command", async () => {
  let stderr = "";
  const exitCode = await main(["run", "check", "home"], {
    stdout: { write() {} },
    stderr: { write(chunk: string) { stderr += chunk; } },
  });

  assert.equal(exitCode, 2);
  assert.match(stderr, /Unknown command|未知命令/);
});

test("main executes an inline json plan", async () => {
  const planJson = JSON.stringify({
    version: 1,
    kind: "miniapp-test-plan",
    metadata: { draft: false, name: "inline-placeholder" },
    execution: { mode: "serial", failFast: true },
    environment: {
      projectPath: "./examples",
      artifactsDir: null,
      wechatDevtoolPath: null,
      testPort: 9420,
      language: "en-US",
      runtimeMode: "placeholder",
      autoScreenshot: "off",
    },
    steps: [
      {
        id: "step-1",
        type: "session.start",
        input: {
          projectPath: "./examples",
        },
      },
      {
        id: "step-2",
        type: "session.close",
        input: {},
      },
    ],
  });

  let stdout = "";
  const exitCode = await main(["exec", "--plan-json", planJson, "--json"], {
    stdout: { write(chunk: string) { stdout += chunk; } },
    stderr: { write() {} },
  });

  assert.equal(exitCode, 0);
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.result.summary.status, "passed");
});
