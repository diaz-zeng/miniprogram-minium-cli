import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";

import { deriveExecutionExitCode, formatHelp, main, parseArgv } from "../src/cli/main";
import { installBundledSkills, resolveDefaultSkillTargetRoot } from "../src/skills";

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

test("parseArgv parses install command", () => {
  const parsed = parseArgv(["install", "--skills", "--path", "./tmp/skills", "--json"]);
  assert.equal(parsed.command, "install");
  if (parsed.command !== "install") {
    return;
  }
  assert.equal(parsed.options.skills, true);
  assert.equal(parsed.options.path, "./tmp/skills");
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

test("main reports usage errors for install without --skills", async () => {
  let stderr = "";
  const exitCode = await main(["install"], {
    stdout: { write() {} },
    stderr: { write(chunk: string) { stderr += chunk; } },
  });

  assert.equal(exitCode, 2);
  assert.match(stderr, /requires `--skills`|需要显式提供 `--skills`/);
});

test("main installs bundled skills into a custom path", async () => {
  const targetRoot = await fs.mkdtemp(path.join(os.tmpdir(), "minium-cli-skills-"));
  let stdout = "";

  try {
    const exitCode = await main(["install", "--skills", "--path", targetRoot, "--json"], {
      stdout: { write(chunk: string) { stdout += chunk; } },
      stderr: { write() {} },
    });

    assert.equal(exitCode, 0);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.targetRoot, targetRoot);
    assert.ok(Array.isArray(parsed.installed));
    assert.ok(parsed.installed.some((entry: { name: string }) => entry.name === "miniprogram-minium-cli"));
    assert.ok(parsed.installed.some((entry: { name: string }) => entry.name === "interactive-classname-tagging"));
    await fs.access(path.join(targetRoot, "miniprogram-minium-cli", "SKILL.md"));
    await fs.access(path.join(targetRoot, "miniprogram-minium-cli", "references", "execution.md"));
    await fs.access(path.join(targetRoot, "interactive-classname-tagging", "SKILL.md"));
    await fs.access(path.join(targetRoot, "interactive-classname-tagging", "references", "naming-convention.md"));
  } finally {
    await fs.rm(targetRoot, { recursive: true, force: true });
  }
});

test("resolveDefaultSkillTargetRoot uses .agents/skills under the current working directory", () => {
  const targetRoot = resolveDefaultSkillTargetRoot("/Users/example/project");

  assert.equal(targetRoot, path.resolve("/Users/example/project", ".agents", "skills"));
});

test("installBundledSkills defaults into .agents/skills under cwd", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "minium-cli-cwd-"));

  try {
    const result = await installBundledSkills({ cwd });

    assert.equal(result.targetRoot, path.resolve(cwd, ".agents", "skills"));
    await fs.access(path.join(result.targetRoot, "miniprogram-minium-cli", "SKILL.md"));
    await fs.access(path.join(result.targetRoot, "interactive-classname-tagging", "SKILL.md"));
  } finally {
    await fs.rm(cwd, { recursive: true, force: true });
  }
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

test("main prints a network summary in text mode when network artifacts exist", async () => {
  const planJson = JSON.stringify({
    version: 1,
    kind: "miniapp-test-plan",
    metadata: { draft: false, name: "inline-network-summary" },
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
        type: "network.listen.start",
        input: {
          listenerId: "network-all",
          captureResponses: true,
        },
      },
      {
        id: "step-3",
        type: "element.click",
        input: {
          locator: {
            type: "id",
            value: "login-button",
          },
        },
      },
      {
        id: "step-4",
        type: "session.close",
        input: {},
      },
    ],
  });

  let stdout = "";
  const exitCode = await main(["exec", "--plan-json", planJson], {
    stdout: { write(chunk: string) { stdout += chunk; } },
    stderr: { write() {} },
  });

  assert.equal(exitCode, 0);
  assert.match(stdout, /Network: 3 events across 1 sessions/);
  assert.match(stdout, /Network log:/);
});
