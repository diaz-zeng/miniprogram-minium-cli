import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as net from "node:net";
import { test } from "node:test";

import type { Plan } from "../src/plan";
import { executePlanWithPython } from "../src/runtime";

function createArtifactsDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
}

function createBasePlan(artifactsDir: string): Plan {
  return {
    version: 1,
    kind: "miniapp-test-plan",
    metadata: {
      name: "smoke-plan",
      draft: false,
    },
    environment: {
      projectPath: ".",
      artifactsDir,
      wechatDevtoolPath: null,
      testPort: 9420,
      language: "en-US",
      runtimeMode: "placeholder",
    },
    execution: {
      mode: "serial",
      failFast: true,
    },
    steps: [],
  };
}

async function getAvailablePort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to resolve a dynamic port.")));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

test("placeholder gesture smoke flow passes end-to-end", async () => {
  const artifactsDir = createArtifactsDir("minium-cli-gesture");
  const plan: Plan = {
    ...createBasePlan(artifactsDir),
    metadata: {
      name: "gesture-smoke",
      draft: false,
    },
    steps: [
      { id: "step-1", type: "session.start", input: { projectPath: "." } },
      { id: "step-2", type: "gesture.touchStart", input: { pointerId: 0, locator: { type: "id", value: "login-button" } } },
      { id: "step-3", type: "gesture.touchTap", input: { pointerId: 1, x: 210, y: 260 } },
      { id: "step-4", type: "gesture.touchMove", input: { pointerId: 0, x: 200, y: 300 } },
      { id: "step-5", type: "gesture.touchEnd", input: { pointerId: 0 } },
      { id: "step-6", type: "session.close", input: {} },
    ],
  };

  const execution = await executePlanWithPython(plan);
  assert.equal(execution.response.ok, true);
  const result = execution.response.result as Record<string, unknown>;
  const summary = result.summary as Record<string, unknown>;
  const stepResults = result.stepResults as Array<Record<string, unknown>>;
  const artifacts = result.artifacts as Record<string, unknown>;

  assert.equal(summary.status, "passed");
  assert.equal(summary.failedCount, 0);
  assert.equal(stepResults.length, 6);
  assert.equal(stepResults[1]?.type, "gesture.touchStart");
  assert.deepEqual(
    (stepResults[4]?.output as Record<string, unknown>).active_pointers,
    [],
  );
  assert.ok(fs.existsSync(String(artifacts.comparisonPath)));
});

test("auto screenshot on-success records screenshot artifacts for successful steps", async () => {
  const artifactsDir = createArtifactsDir("minium-cli-auto-screenshot");
  const plan: Plan = {
    ...createBasePlan(artifactsDir),
    metadata: {
      name: "auto-screenshot-smoke",
      draft: false,
    },
    environment: {
      projectPath: ".",
      artifactsDir,
      wechatDevtoolPath: null,
      testPort: 9420,
      language: "en-US",
      runtimeMode: "placeholder",
      autoScreenshot: "on-success",
    },
    steps: [
      { id: "step-1", type: "session.start", input: { projectPath: "." } },
      { id: "step-2", type: "page.read", input: {} },
      { id: "step-3", type: "session.close", input: {} },
    ],
  };

  const execution = await executePlanWithPython(plan);
  assert.equal(execution.response.ok, true);
  const result = execution.response.result as Record<string, unknown>;
  const summary = result.summary as Record<string, unknown>;
  const artifacts = result.artifacts as Record<string, unknown>;
  const screenshotPaths = artifacts.screenshotPaths as string[];
  const stepResults = result.stepResults as Array<Record<string, unknown>>;

  assert.equal(summary.status, "passed");
  assert.ok(Array.isArray(screenshotPaths));
  assert.ok(screenshotPaths.length >= 2);
  for (const screenshotPath of screenshotPaths) {
    assert.ok(fs.existsSync(screenshotPath));
  }
  assert.equal(
    typeof (stepResults[0]?.output as Record<string, unknown>).auto_screenshot_artifact_path,
    "string",
  );
});

test("failed placeholder assertion produces skipped steps and evidence", async () => {
  const artifactsDir = createArtifactsDir("minium-cli-failure");
  const plan: Plan = {
    ...createBasePlan(artifactsDir),
    metadata: {
      name: "failure-smoke",
      draft: false,
    },
    steps: [
      { id: "step-1", type: "session.start", input: { projectPath: "." } },
      { id: "step-2", type: "assert.pagePath", input: { expectedPath: "pages/home/index" } },
      { id: "step-3", type: "page.read", input: {} },
    ],
  };

  const execution = await executePlanWithPython(plan);
  assert.equal(execution.response.ok, true);
  const result = execution.response.result as Record<string, unknown>;
  const summary = result.summary as Record<string, unknown>;
  const stepResults = result.stepResults as Array<Record<string, unknown>>;
  const failure = summary.failure as Record<string, unknown>;
  const artifacts = result.artifacts as Record<string, unknown>;

  assert.equal(summary.status, "failed");
  assert.equal(summary.failedCount, 1);
  assert.equal(summary.skippedCount, 1);
  assert.equal(stepResults[2]?.status, "skipped");
  assert.equal(failure.error_code, "ASSERTION_FAILED");
  assert.ok(Array.isArray(failure.artifacts));
  assert.ok(fs.existsSync(String((failure.artifacts as string[])[0])));
  assert.ok(fs.existsSync(String(artifacts.summaryPath)));
  assert.ok(fs.existsSync(String(artifacts.resultPath)));
  assert.ok(fs.existsSync(String(artifacts.comparisonPath)));
});

test("placeholder bridge actions pass end-to-end and expose structured outputs", async () => {
  const artifactsDir = createArtifactsDir("minium-cli-bridge");
  const plan: Plan = {
    ...createBasePlan(artifactsDir),
    metadata: {
      name: "bridge-smoke",
      draft: false,
    },
    steps: [
      { id: "step-1", type: "session.start", input: { projectPath: "." } },
      { id: "step-2", type: "storage.set", input: { key: "bridge-key", value: "bridge-value" } },
      { id: "step-3", type: "storage.get", input: { key: "bridge-key" } },
      { id: "step-4", type: "clipboard.set", input: { text: "clipboard-demo" } },
      { id: "step-5", type: "clipboard.get", input: {} },
      { id: "step-6", type: "navigation.navigateTo", input: { url: "/pages/bridge-lab/index" } },
      { id: "step-7", type: "app.getLaunchOptions", input: {} },
      { id: "step-8", type: "session.close", input: {} },
    ],
  };

  const execution = await executePlanWithPython(plan);
  assert.equal(execution.response.ok, true);
  const result = execution.response.result as Record<string, unknown>;
  const summary = result.summary as Record<string, unknown>;
  const stepResults = result.stepResults as Array<Record<string, unknown>>;

  assert.equal(summary.status, "passed");
  assert.equal(summary.failedCount, 0);
  assert.equal(summary.skippedCount, 0);
  assert.equal(stepResults[2]?.status, "passed");
  assert.equal(
    (((stepResults[2]?.output as Record<string, unknown>).result as Record<string, unknown>).value),
    "bridge-value",
  );
  assert.equal(
    (((stepResults[4]?.output as Record<string, unknown>).result as Record<string, unknown>).text),
    "clipboard-demo",
  );
  assert.equal(
    (((stepResults[5]?.output as Record<string, unknown>).result as Record<string, unknown>).pagePath),
    "pages/bridge-lab/index",
  );
});

test("placeholder network observation and interception steps pass end-to-end", async () => {
  const artifactsDir = createArtifactsDir("minium-cli-network");
  const plan: Plan = {
    ...createBasePlan(artifactsDir),
    metadata: {
      name: "network-smoke",
      draft: false,
    },
    steps: [
      { id: "step-1", type: "session.start", input: { projectPath: "." } },
      { id: "step-2", type: "network.listen.start", input: { listenerId: "network-all", captureResponses: true } },
      { id: "step-3", type: "element.click", input: { locator: { type: "id", value: "login-button" } } },
      { id: "step-4", type: "network.wait", input: { listenerId: "network-all", event: "request", timeoutMs: 100 } },
      { id: "step-5", type: "assert.networkRequest", input: { listenerId: "network-all", matcher: { url: "/api/login", method: "POST" }, count: 1 } },
      {
        id: "step-6",
        type: "network.intercept.add",
        input: {
          ruleId: "reviews-mock",
          matcher: { url: "/api/reviews", method: "GET" },
          behavior: {
            action: "mock",
            response: {
              statusCode: 503,
              headers: { "content-type": "application/json" },
              body: { ok: false, source: "mock" },
            },
          },
        },
      },
      { id: "step-7", type: "element.click", input: { locator: { type: "id", value: "home-to-review-board-button" } } },
      {
        id: "step-8",
        type: "network.wait",
        input: {
          listenerId: "network-all",
          event: "response",
          matcher: { url: "/api/reviews", statusCode: 503 },
          timeoutMs: 100,
        },
      },
      {
        id: "step-9",
        type: "assert.networkResponse",
        input: {
          listenerId: "network-all",
          matcher: { url: "/api/reviews", statusCode: 503, responseBody: { ok: false } },
          count: 1,
        },
      },
      { id: "step-10", type: "network.intercept.clear", input: {} },
      { id: "step-11", type: "session.close", input: {} },
    ],
  };

  const execution = await executePlanWithPython(plan);
  assert.equal(execution.response.ok, true);
  const result = execution.response.result as Record<string, unknown>;
  const summary = result.summary as Record<string, unknown>;
  const stepResults = result.stepResults as Array<Record<string, unknown>>;
  const artifacts = result.artifacts as Record<string, unknown>;
  const network = result.network as Record<string, unknown>;

  assert.equal(summary.status, "passed");
  assert.equal(summary.networkEventCount, 4);
  assert.ok(fs.existsSync(String(artifacts.networkPath)));
  assert.equal(network.eventCount, 4);
  assert.equal(
    (stepResults[4]?.output as Record<string, unknown>).matched_count,
    1,
  );
  assert.equal(
    (stepResults[8]?.output as Record<string, unknown>).matched_count,
    1,
  );
});

test("placeholder network ordered assertions compare event sequence instead of event id text", async () => {
  const artifactsDir = createArtifactsDir("minium-cli-network-order");
  const plan: Plan = {
    ...createBasePlan(artifactsDir),
    metadata: {
      name: "network-order-smoke",
      draft: false,
    },
    steps: [
      {
        id: "step-1",
        type: "session.start",
        input: {
          projectPath: ".",
          initialPagePath: "/pages/home/index",
        },
      },
      { id: "step-2", type: "network.listen.start", input: { listenerId: "home-network", captureResponses: true } },
      { id: "step-3", type: "element.click", input: { locator: { type: "id", value: "network-login-request-button" } } },
      {
        id: "step-4",
        type: "network.wait",
        input: {
          listenerId: "home-network",
          event: "response",
          timeoutMs: 100,
          matcher: { url: "https://service.invalid/api/login", method: "POST", statusCode: 200 },
        },
      },
      { id: "step-5", type: "element.click", input: { locator: { type: "id", value: "network-reviews-request-button" } } },
      {
        id: "step-6",
        type: "assert.networkRequest",
        input: {
          listenerId: "home-network",
          matcher: { url: "https://service.invalid/api/reviews", method: "GET" },
          count: 1,
          orderedAfter: "response-2",
        },
      },
      { id: "step-7", type: "session.close", input: {} },
    ],
  };

  const execution = await executePlanWithPython(plan);
  assert.equal(execution.response.ok, true);
  const result = execution.response.result as Record<string, unknown>;
  const summary = result.summary as Record<string, unknown>;
  const stepResults = result.stepResults as Array<Record<string, unknown>>;

  assert.equal(summary.status, "passed");
  assert.equal(stepResults[5]?.status, "passed");
  assert.deepEqual(
    (stepResults[5]?.output as Record<string, unknown>).matched_event_ids,
    ["request-3"],
  );
});

test("placeholder network wait timeout returns a structured action error", async () => {
  const artifactsDir = createArtifactsDir("minium-cli-network-timeout");
  const plan: Plan = {
    ...createBasePlan(artifactsDir),
    metadata: {
      name: "network-timeout",
      draft: false,
    },
    steps: [
      { id: "step-1", type: "session.start", input: { projectPath: "." } },
      { id: "step-2", type: "network.listen.start", input: { listenerId: "network-all", captureResponses: true } },
      {
        id: "step-3",
        type: "network.wait",
        input: {
          listenerId: "network-all",
          event: "response",
          timeoutMs: 20,
          matcher: { url: "/api/never-happens" },
        },
      },
      { id: "step-4", type: "session.close", input: {} },
    ],
  };

  const execution = await executePlanWithPython(plan);
  assert.equal(execution.response.ok, true);
  const result = execution.response.result as Record<string, unknown>;
  const summary = result.summary as Record<string, unknown>;
  const stepResults = result.stepResults as Array<Record<string, unknown>>;
  const failure = summary.failure as Record<string, unknown>;

  assert.equal(summary.status, "failed");
  assert.equal(failure.error_code, "ACTION_ERROR");
  assert.equal(stepResults[2]?.status, "failed");
  assert.equal(
    ((stepResults[2]?.error as Record<string, unknown>).error_code),
    "ACTION_ERROR",
  );
});

test("placeholder network listen clear preserves events still referenced by other listeners", async () => {
  const artifactsDir = createArtifactsDir("minium-cli-network-clear-shared");
  const plan: Plan = {
    ...createBasePlan(artifactsDir),
    metadata: {
      name: "network-clear-shared",
      draft: false,
    },
    steps: [
      { id: "step-1", type: "session.start", input: { projectPath: "." } },
      { id: "step-2", type: "network.listen.start", input: { listenerId: "network-all", captureResponses: true } },
      {
        id: "step-3",
        type: "network.listen.start",
        input: {
          listenerId: "login-only",
          matcher: { url: "/api/login", method: "POST" },
        },
      },
      { id: "step-4", type: "element.click", input: { locator: { type: "id", value: "login-button" } } },
      { id: "step-5", type: "network.listen.clear", input: { listenerId: "login-only" } },
      {
        id: "step-6",
        type: "assert.networkRequest",
        input: {
          listenerId: "network-all",
          matcher: { url: "/api/login", method: "POST" },
          count: 1,
        },
      },
      { id: "step-7", type: "session.close", input: {} },
    ],
  };

  const execution = await executePlanWithPython(plan);
  assert.equal(execution.response.ok, true);
  const result = execution.response.result as Record<string, unknown>;
  const summary = result.summary as Record<string, unknown>;
  const stepResults = result.stepResults as Array<Record<string, unknown>>;

  assert.equal(summary.status, "passed");
  assert.equal(
    (stepResults[4]?.output as Record<string, unknown>).cleared_event_count,
    0,
  );
  assert.equal(
    (stepResults[4]?.output as Record<string, unknown>).remaining_event_count,
    2,
  );
  assert.equal(
    (stepResults[5]?.output as Record<string, unknown>).matched_count,
    1,
  );
});

test("placeholder navigation.back respects page history after UI-driven transitions", async () => {
  const artifactsDir = createArtifactsDir("minium-cli-nav-stack");
  const plan: Plan = {
    ...createBasePlan(artifactsDir),
    metadata: {
      name: "nav-stack-smoke",
      draft: false,
    },
    steps: [
      { id: "step-1", type: "session.start", input: { projectPath: "." } },
      { id: "step-2", type: "element.click", input: { locator: { type: "id", value: "login-button" } } },
      { id: "step-3", type: "element.click", input: { locator: { type: "id", value: "home-to-bridge-lab-button" } } },
      { id: "step-4", type: "navigation.back", input: {} },
      { id: "step-5", type: "assert.pagePath", input: { expectedPath: "pages/home/index" } },
      { id: "step-6", type: "session.close", input: {} },
    ],
  };

  const execution = await executePlanWithPython(plan);
  assert.equal(execution.response.ok, true);
  const result = execution.response.result as Record<string, unknown>;
  const summary = result.summary as Record<string, unknown>;
  const stepResults = result.stepResults as Array<Record<string, unknown>>;

  assert.equal(summary.status, "passed");
  assert.equal(stepResults[3]?.status, "passed");
  assert.equal(
    (((stepResults[3]?.output as Record<string, unknown>).result as Record<string, unknown>).pagePath),
    "pages/home/index",
  );
});

test("touristappid restricted bridge actions are skipped with a structured reason", async () => {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "minium-cli-tourist-"));
  const projectPath = path.join(workspaceDir, "miniapp");
  const artifactsDir = path.join(workspaceDir, "artifacts");

  fs.mkdirSync(projectPath, { recursive: true });
  fs.writeFileSync(
    path.join(projectPath, "project.config.json"),
    JSON.stringify({ appid: "touristappid" }, null, 2),
    "utf8",
  );

  const plan: Plan = {
    ...createBasePlan(artifactsDir),
    metadata: {
      name: "tourist-skip-smoke",
      draft: false,
    },
    environment: {
      projectPath,
      artifactsDir,
      wechatDevtoolPath: null,
      testPort: 9420,
      language: "en-US",
      runtimeMode: "placeholder",
    },
    steps: [
      { id: "step-1", type: "session.start", input: { projectPath } },
      {
        id: "step-2",
        type: "settings.authorize",
        input: {
          scope: "scope.userLocation",
          requiresDeveloperAppId: true,
          skipReason: "Authorization flows require a developer-owned AppID.",
        },
      },
      {
        id: "step-3",
        type: "subscription.requestMessage",
        input: {
          tmplIds: ["tmpl-demo"],
          requiresDeveloperAppId: true,
        },
      },
      { id: "step-4", type: "session.close", input: {} },
    ],
  };

  const execution = await executePlanWithPython(plan);
  assert.equal(execution.response.ok, true);
  const result = execution.response.result as Record<string, unknown>;
  const summary = result.summary as Record<string, unknown>;
  const stepResults = result.stepResults as Array<Record<string, unknown>>;
  const skipped = summary.skipped as Array<Record<string, unknown>>;

  assert.equal(summary.status, "passed");
  assert.equal(summary.failedCount, 0);
  assert.equal(summary.skippedCount, 2);
  assert.equal(stepResults[1]?.status, "skipped");
  assert.equal(stepResults[2]?.status, "skipped");
  assert.equal(
    (stepResults[1]?.output as Record<string, unknown>).skip_reason,
    "Authorization flows require a developer-owned AppID.",
  );
  assert.equal(Array.isArray(skipped), true);
  assert.equal(skipped.length, 2);
});

test("real runtime session preparation launches automation target before attaching", async () => {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "minium-cli-real-"));
  const fakeModuleDir = path.join(workspaceDir, "fake-python");
  const projectPath = path.join(workspaceDir, "miniapp");
  const devtoolPath = path.join(workspaceDir, "wechat-devtool");
  const artifactsDir = path.join(workspaceDir, "artifacts");
  const testPort = await getAvailablePort();

  fs.mkdirSync(fakeModuleDir, { recursive: true });
  fs.mkdirSync(projectPath, { recursive: true });
  fs.writeFileSync(path.join(projectPath, "project.config.json"), "{}\n", "utf8");
  fs.writeFileSync(
    path.join(fakeModuleDir, "minium.py"),
    [
      "class _Page:",
      "    def __init__(self):",
      "        self.path = '/pages/home/index'",
      "        self.renderer = 'webview'",
      "",
      "class _App:",
      "    def __init__(self):",
      "        self._page = _Page()",
      "",
      "    def get_current_page(self):",
      "        return self._page",
      "",
      "    def navigate_to(self, _path):",
      "        return None",
      "",
      "class Minium:",
      "    def __init__(self, conf):",
      "        self.conf = conf",
      "        self.app = _App()",
      "",
      "    def shutdown(self):",
      "        return None",
      "",
    ].join("\n"),
    "utf8",
  );
  fs.writeFileSync(
    devtoolPath,
    [
      "#!/bin/sh",
      "PORT=\"\"",
      "while [ \"$#\" -gt 0 ]; do",
      "  if [ \"$1\" = \"--auto-port\" ]; then",
      "    PORT=\"$2\"",
      "    shift 2",
      "  else",
      "    shift",
      "  fi",
      "done",
      "node -e \"const net=require('net'); const port=Number(process.argv[1]); const server=net.createServer(()=>{}); server.listen(port,'127.0.0.1',()=>{}); setTimeout(()=>server.close(()=>process.exit(0)), 15000);\" \"$PORT\" >/dev/null 2>&1 &",
      "exit 0",
      "",
    ].join("\n"),
    { encoding: "utf8", mode: 0o755 },
  );

  const plan: Plan = {
    ...createBasePlan(artifactsDir),
    metadata: {
      name: "real-runtime-smoke",
      draft: false,
    },
    environment: {
      projectPath,
      artifactsDir,
      wechatDevtoolPath: devtoolPath,
      testPort,
      language: "en-US",
      runtimeMode: "real",
    },
    steps: [
      { id: "step-1", type: "session.start", input: { projectPath } },
      { id: "step-2", type: "page.read", input: {} },
      { id: "step-3", type: "session.close", input: {} },
    ],
  };

  const execution = await executePlanWithPython(plan, {
    env: {
      ...process.env,
      PYTHONPATH: process.env.PYTHONPATH
        ? `${fakeModuleDir}${path.delimiter}${process.env.PYTHONPATH}`
        : fakeModuleDir,
    },
  });

  assert.equal(execution.response.ok, true);
  const result = execution.response.result as Record<string, unknown>;
  const summary = result.summary as Record<string, unknown>;
  const stepResults = result.stepResults as Array<Record<string, unknown>>;
  const sessionOutput = stepResults[0]?.output as Record<string, unknown>;

  assert.equal(summary.status, "passed");
  assert.equal(sessionOutput.runtime_backend, "minium");
  assert.equal(sessionOutput.test_port, testPort);
  assert.equal(sessionOutput.current_page_path, "pages/home/index");
});

test("real runtime multi-touch gestures dispatch through element targets", async () => {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "minium-cli-real-gesture-"));
  const fakeModuleDir = path.join(workspaceDir, "fake-python");
  const projectPath = path.join(workspaceDir, "miniapp");
  const devtoolPath = path.join(workspaceDir, "wechat-devtool");
  const artifactsDir = path.join(workspaceDir, "artifacts");
  const testPort = await getAvailablePort();

  fs.mkdirSync(fakeModuleDir, { recursive: true });
  fs.mkdirSync(projectPath, { recursive: true });
  fs.writeFileSync(path.join(projectPath, "project.config.json"), "{}\n", "utf8");
  fs.writeFileSync(
    path.join(fakeModuleDir, "minium.py"),
    [
      "class _Selector:",
      "    def __init__(self, value):",
      "        self._value = value",
      "",
      "    def full_selector(self):",
      "        return self._value",
      "",
      "class _StatusElement:",
      "    def __init__(self, page, element_id, reader):",
      "        self._page = page",
      "        self.id = element_id",
      "        self.element_id = element_id",
      "        self._tag_name = 'text'",
      "        self.selector = _Selector(f'//*[@id=\"{element_id}\"]')",
      "        self.rect = {'left': 0, 'top': 0, 'width': 120, 'height': 24}",
      "        self._reader = reader",
      "",
      "    @property",
      "    def inner_text(self):",
      "        return self._reader()",
      "",
      "class _GestureTarget:",
      "    def __init__(self, page):",
      "        self._page = page",
      "        self.id = 'gesture-target'",
      "        self.element_id = 'gesture-target'",
      "        self._tag_name = 'view'",
      "        self.selector = _Selector('//*[@id=\"gesture-target\"]')",
      "        self.rect = {'left': 40, 'top': 60, 'width': 200, 'height': 200}",
      "",
      "    def dispatch_event(self, event_type, touches=None, change_touches=None, detail=None, **_kwargs):",
      "        active_count = len(touches or [])",
      "        if event_type == 'touchstart':",
      "            if active_count >= 2:",
      "                self._page.status_text = 'Gesture status: two-finger-pan-zoom'",
      "            else:",
      "                self._page.status_text = 'Gesture status: single-finger-active'",
      "            self._page.active_text = f'Active touches: {active_count}'",
      "            return",
      "        if event_type == 'touchmove':",
      "            if active_count >= 2:",
      "                self._page.status_text = 'Gesture status: two-finger-pan-zoom'",
      "            self._page.active_text = f'Active touches: {active_count}'",
      "            return",
      "        if event_type == 'touchend':",
      "            self._page.active_text = f'Active touches: {active_count}'",
      "            return",
      "        if event_type == 'tap':",
      "            self._page.status_text = 'Gesture status: tap'",
      "",
      "class _Page:",
      "    def __init__(self):",
      "        self.path = '/pages/gesture/index'",
      "        self.renderer = 'webview'",
      "        self.status_text = 'Gesture status: idle'",
      "        self.active_text = 'Active touches: 0'",
      "        self._gesture_target = _GestureTarget(self)",
      "        self._status_element = _StatusElement(self, 'gesture-status-text', lambda: self.status_text)",
      "        self._active_element = _StatusElement(self, 'gesture-active-text', lambda: self.active_text)",
      "",
      "    def get_elements(self, selector, max_timeout=0, index=0):",
      "        _ = max_timeout",
      "        matches = []",
      "        if selector == '#gesture-target':",
      "            matches = [self._gesture_target]",
      "        elif selector == '#gesture-status-text':",
      "            matches = [self._status_element]",
      "        elif selector == '#gesture-active-text':",
      "            matches = [self._active_element]",
      "        if index >= len(matches):",
      "            return []",
      "        return [matches[index]]",
      "",
      "    def get_elements_by_xpath(self, _xpath, max_timeout=0):",
      "        _ = max_timeout",
      "        return []",
      "",
      "class _App:",
      "    def __init__(self):",
      "        self._page = _Page()",
      "",
      "    def get_current_page(self):",
      "        return self._page",
      "",
      "    def navigate_to(self, path):",
      "        self._page.path = path",
      "",
      "class Minium:",
      "    def __init__(self, conf):",
      "        self.conf = conf",
      "        self.app = _App()",
      "",
      "    def shutdown(self):",
      "        return None",
      "",
    ].join("\n"),
    "utf8",
  );
  fs.writeFileSync(
    devtoolPath,
    [
      "#!/bin/sh",
      "PORT=\"\"",
      "while [ \"$#\" -gt 0 ]; do",
      "  if [ \"$1\" = \"--auto-port\" ]; then",
      "    PORT=\"$2\"",
      "    shift 2",
      "  else",
      "    shift",
      "  fi",
      "done",
      "node -e \"const net=require('net'); const port=Number(process.argv[1]); const server=net.createServer(()=>{}); server.listen(port,'127.0.0.1',()=>{}); setTimeout(()=>server.close(()=>process.exit(0)), 15000);\" \"$PORT\" >/dev/null 2>&1 &",
      "exit 0",
      "",
    ].join("\n"),
    { encoding: "utf8", mode: 0o755 },
  );

  const plan: Plan = {
    ...createBasePlan(artifactsDir),
    metadata: {
      name: "real-runtime-gesture",
      draft: false,
    },
    environment: {
      projectPath,
      artifactsDir,
      wechatDevtoolPath: devtoolPath,
      testPort,
      language: "en-US",
      runtimeMode: "real",
    },
    steps: [
      { id: "step-1", type: "session.start", input: { projectPath, initialPagePath: "/pages/gesture/index" } },
      { id: "step-2", type: "gesture.touchStart", input: { pointerId: 0, locator: { type: "id", value: "gesture-target" } } },
      { id: "step-3", type: "gesture.touchStart", input: { pointerId: 1, locator: { type: "id", value: "gesture-target" } } },
      { id: "step-4", type: "assert.elementText", input: { locator: { type: "id", value: "gesture-status-text" }, expectedText: "Gesture status: two-finger-pan-zoom" } },
      { id: "step-5", type: "assert.elementText", input: { locator: { type: "id", value: "gesture-active-text" }, expectedText: "Active touches: 2" } },
      { id: "step-6", type: "gesture.touchEnd", input: { pointerId: 0 } },
      { id: "step-7", type: "gesture.touchEnd", input: { pointerId: 1 } },
      { id: "step-8", type: "assert.elementText", input: { locator: { type: "id", value: "gesture-active-text" }, expectedText: "Active touches: 0" } },
      { id: "step-9", type: "session.close", input: {} },
    ],
  };

  const execution = await executePlanWithPython(plan, {
    env: {
      ...process.env,
      PYTHONPATH: process.env.PYTHONPATH
        ? `${fakeModuleDir}${path.delimiter}${process.env.PYTHONPATH}`
        : fakeModuleDir,
    },
  });

  assert.equal(execution.response.ok, true);
  const result = execution.response.result as Record<string, unknown>;
  const summary = result.summary as Record<string, unknown>;
  const stepResults = result.stepResults as Array<Record<string, unknown>>;

  assert.equal(summary.status, "passed");
  assert.equal(stepResults[1]?.status, "passed");
  assert.equal(stepResults[2]?.status, "passed");
  assert.equal(stepResults[7]?.status, "passed");
});

test("real async bridge calls preserve millisecond timeout precision", async () => {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "minium-cli-real-async-"));
  const fakeModuleDir = path.join(workspaceDir, "fake-python");
  const projectPath = path.join(workspaceDir, "miniapp");
  const devtoolPath = path.join(workspaceDir, "wechat-devtool");
  const artifactsDir = path.join(workspaceDir, "artifacts");
  const testPort = await getAvailablePort();

  fs.mkdirSync(fakeModuleDir, { recursive: true });
  fs.mkdirSync(projectPath, { recursive: true });
  fs.writeFileSync(path.join(projectPath, "project.config.json"), "{}\n", "utf8");
  fs.writeFileSync(
    path.join(fakeModuleDir, "minium.py"),
    [
      "class _Page:",
      "    def __init__(self):",
      "        self.path = '/pages/bridge-lab/index'",
      "        self.renderer = 'webview'",
      "",
      "class _App:",
      "    def __init__(self):",
      "        self._page = _Page()",
      "",
      "    def get_current_page(self):",
      "        return self._page",
      "",
      "    def navigate_to(self, path):",
      "        self._page.path = path",
      "        return self._page",
      "",
      "    def call_wx_method_async(self, method, payload):",
      "        self.last_method = method",
      "        self.last_payload = payload",
      "        return 'async-message-id'",
      "",
      "    def get_async_response(self, message_id, timeout=0):",
      "        if message_id != 'async-message-id':",
      "            return None",
      "        if timeout < 1.5:",
      "            return None",
      "        return {'result': {'result': {'confirm': True, 'cancel': False}}}",
      "",
      "class Minium:",
      "    def __init__(self, conf):",
      "        self.conf = conf",
      "        self.app = _App()",
      "",
      "    def shutdown(self):",
      "        return None",
      "",
    ].join("\n"),
    "utf8",
  );
  fs.writeFileSync(
    devtoolPath,
    [
      "#!/bin/sh",
      "PORT=\"\"",
      "while [ \"$#\" -gt 0 ]; do",
      "  if [ \"$1\" = \"--auto-port\" ]; then",
      "    PORT=\"$2\"",
      "    shift 2",
      "  else",
      "    shift",
      "  fi",
      "done",
      "node -e \"const net=require('net'); const port=Number(process.argv[1]); const server=net.createServer(()=>{}); server.listen(port,'127.0.0.1',()=>{}); setTimeout(()=>server.close(()=>process.exit(0)), 15000);\" \"$PORT\" >/dev/null 2>&1 &",
      "exit 0",
      "",
    ].join("\n"),
    { encoding: "utf8", mode: 0o755 },
  );

  const plan: Plan = {
    ...createBasePlan(artifactsDir),
    metadata: {
      name: "real-async-timeout-precision",
      draft: false,
    },
    environment: {
      projectPath,
      artifactsDir,
      wechatDevtoolPath: devtoolPath,
      testPort,
      language: "en-US",
      runtimeMode: "real",
    },
    steps: [
      { id: "step-1", type: "session.start", input: { projectPath, initialPagePath: "/pages/bridge-lab/index" } },
      {
        id: "step-2",
        type: "ui.showModal",
        input: {
          title: "Bridge confirmation",
          content: "Keep timeout precision.",
          timeoutMs: 1500,
        },
      },
      { id: "step-3", type: "session.close", input: {} },
    ],
  };

  const execution = await executePlanWithPython(plan, {
    env: {
      ...process.env,
      PYTHONPATH: process.env.PYTHONPATH
        ? `${fakeModuleDir}${path.delimiter}${process.env.PYTHONPATH}`
        : fakeModuleDir,
    },
  });

  assert.equal(execution.response.ok, true);
  const result = execution.response.result as Record<string, unknown>;
  const summary = result.summary as Record<string, unknown>;
  const stepResults = result.stepResults as Array<Record<string, unknown>>;

  assert.equal(summary.status, "passed");
  assert.equal(stepResults[1]?.status, "passed");
  assert.equal(
    (((stepResults[1]?.output as Record<string, unknown>).result as Record<string, unknown>).confirm),
    true,
  );
});

test("real runtime network hooks drive observation, mocking, and cleanup", async () => {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "minium-cli-real-network-"));
  const fakeModuleDir = path.join(workspaceDir, "fake-python");
  const projectPath = path.join(workspaceDir, "miniapp");
  const devtoolPath = path.join(workspaceDir, "wechat-devtool");
  const artifactsDir = path.join(workspaceDir, "artifacts");
  const cleanupLogPath = path.join(workspaceDir, "network-cleanup-log.json");
  const testPort = await getAvailablePort();

  fs.mkdirSync(fakeModuleDir, { recursive: true });
  fs.mkdirSync(projectPath, { recursive: true });
  fs.writeFileSync(path.join(projectPath, "project.config.json"), "{}\n", "utf8");
  fs.writeFileSync(
    path.join(fakeModuleDir, "minium.py"),
    [
      "import json",
      "import re",
      "from pathlib import Path",
      "",
      `LOG_PATH = Path(${JSON.stringify(cleanupLogPath)})`,
      "",
      "def _append(event, payload):",
      "    records = []",
      "    if LOG_PATH.exists():",
      "        records = json.loads(LOG_PATH.read_text(encoding='utf-8') or '[]')",
      "    records.append({'event': event, **payload})",
      "    LOG_PATH.write_text(json.dumps(records), encoding='utf-8')",
      "",
      "def _match_rule(expected, actual):",
      "    if type(expected) is not type(actual):",
      "        return False",
      "    if isinstance(expected, str):",
      "        if expected == actual:",
      "            return True",
      "        if expected == '*':",
      "            expected = '.*'",
      "        try:",
      "            return re.search(expected, actual) is not None",
      "        except re.error:",
      "            return False",
      "    if isinstance(expected, list):",
      "        if len(expected) != len(actual):",
      "            return False",
      "        return all(_match_rule(item, actual[index]) for index, item in enumerate(expected))",
      "    if isinstance(expected, dict):",
      "        for key, value in expected.items():",
      "            if key in {'success', 'fail', '_miniMockType'}:",
      "                continue",
      "            if key not in actual or not _match_rule(value, actual[key]):",
      "                return False",
      "        return True",
      "    return expected == actual",
      "",
      "class _Page:",
      "    def __init__(self):",
      "        self.path = '/pages/bridge-lab/index'",
      "        self.renderer = 'webview'",
      "        self.plugin_appid = ''",
      "",
      "class _App:",
      "    def __init__(self):",
      "        self._page = _Page()",
      "        self._hooks = {}",
      "        self._mock_rules = {'request': [], 'uploadFile': [], 'downloadFile': []}",
      "        self._pending = {}",
      "        self._message_index = 0",
      "",
      "    def get_current_page(self):",
      "        return self._page",
      "",
      "    def navigate_to(self, path):",
      "        self._page.path = path",
      "        return self._page",
      "",
      "    def hook_wx_method(self, method, before=None, after=None, callback=None, with_id=False):",
      "        _ = after, with_id",
      "        hook_id = len(self._hooks.get(method, [])) + 1",
      "        self._hooks.setdefault(method, []).append({'id': hook_id, 'before': before, 'callback': callback})",
      "        _append('hook', {'method': method, 'hookId': hook_id})",
      "        return hook_id",
      "",
      "    def release_hook_wx_method(self, method, hook_id=None):",
      "        hooks = list(self._hooks.get(method, []))",
      "        if hook_id is None:",
      "            self._hooks[method] = []",
      "        else:",
      "            self._hooks[method] = [item for item in hooks if item['id'] != hook_id]",
      "        _append('release', {'method': method, 'hookId': hook_id})",
      "",
      "    def _mock_network(self, interface, rule, success=None, fail=None, reverse=False):",
      "        entry = {'rule': dict(rule), 'success': success, 'fail': fail}",
      "        if reverse:",
      "            self._mock_rules.setdefault(interface, []).insert(0, entry)",
      "        else:",
      "            self._mock_rules.setdefault(interface, []).append(entry)",
      "        _append('mock', {'method': interface, 'rule': entry['rule']})",
      "",
      "    def _restore_network(self, interface):",
      "        self._mock_rules[interface] = []",
      "        _append('restore', {'method': interface})",
      "",
      "    def call_wx_method_async(self, method, payload):",
      "        self._message_index += 1",
      "        message_id = f'async-{self._message_index}'",
      "        options = dict(payload or {})",
      "        if method == 'uploadFile':",
      "            options.setdefault('method', 'POST')",
      "        elif method == 'downloadFile':",
      "            options.setdefault('method', 'GET')",
      "        for hook in list(self._hooks.get(method, [])):",
      "            callback = hook.get('before')",
      "            if callable(callback):",
      "                callback([options, message_id])",
      "        response = self._default_response(method)",
      "        for entry in self._mock_rules.get(method, []):",
      "            if options.get('__miniumCliRuleToken') and options.get('__miniumCliRuleToken') == entry['rule'].get('__miniumCliRuleToken'):",
      "                response = entry['success'] if entry.get('success') is not None else entry['fail']",
      "                break",
      "            if _match_rule(entry['rule'], options):",
      "                response = entry['success'] if entry.get('success') is not None else entry['fail']",
      "                break",
      "        self._pending[message_id] = {'method': method, 'response': response}",
      "        return message_id",
      "",
      "    def get_async_response(self, message_id, timeout=0):",
      "        _ = timeout",
      "        pending = self._pending.pop(message_id, None)",
      "        if pending is None:",
      "            return None",
      "        for hook in list(self._hooks.get(pending['method'], [])):",
      "            callback = hook.get('callback')",
      "            if callable(callback):",
      "                callback([pending['response'], message_id])",
      "        return {'result': {'result': pending['response']}}",
      "",
      "    @staticmethod",
      "    def _default_response(method):",
      "        if method == 'uploadFile':",
      "            return {'statusCode': 200, 'data': '{\"ok\":true}', 'errMsg': 'uploadFile:ok'}",
      "        if method == 'downloadFile':",
      "            return {'statusCode': 200, 'tempFilePath': '/tmp/real-download.bin', 'errMsg': 'downloadFile:ok'}",
      "        return {'statusCode': 200}",
      "",
      "class Minium:",
      "    def __init__(self, conf):",
      "        self.conf = conf",
      "        self.app = _App()",
      "",
      "    def shutdown(self):",
      "        _append('shutdown', {})",
      "        return None",
      "",
    ].join("\n"),
    "utf8",
  );
  fs.writeFileSync(
    devtoolPath,
    [
      "#!/bin/sh",
      "PORT=\"\"",
      "while [ \"$#\" -gt 0 ]; do",
      "  if [ \"$1\" = \"--auto-port\" ]; then",
      "    PORT=\"$2\"",
      "    shift 2",
      "  else",
      "    shift",
      "  fi",
      "done",
      "node -e \"const net=require('net'); const port=Number(process.argv[1]); const server=net.createServer(()=>{}); server.listen(port,'127.0.0.1',()=>{}); setTimeout(()=>server.close(()=>process.exit(0)), 15000);\" \"$PORT\" >/dev/null 2>&1 &",
      "exit 0",
      "",
    ].join("\n"),
    { encoding: "utf8", mode: 0o755 },
  );

  const plan: Plan = {
    ...createBasePlan(artifactsDir),
    metadata: {
      name: "real-network-hooks",
      draft: false,
    },
    environment: {
      projectPath,
      artifactsDir,
      wechatDevtoolPath: devtoolPath,
      testPort,
      language: "en-US",
      runtimeMode: "real",
    },
    steps: [
      { id: "step-1", type: "session.start", input: { projectPath, initialPagePath: "/pages/bridge-lab/index" } },
      { id: "step-2", type: "network.listen.start", input: { listenerId: "real-network", captureResponses: true } },
      {
        id: "step-3",
        type: "network.intercept.add",
        input: {
          ruleId: "download-mock",
          matcher: {
            resourceType: "download",
            url: "https://service.invalid/reports/latest.bin",
            method: "GET",
          },
          behavior: {
            action: "mock",
            response: {
              statusCode: 206,
              headers: { "x-source": "real-test" },
              body: { tempFilePath: "/tmp/real-mock.bin" },
            },
          },
        },
      },
      {
        id: "step-4",
        type: "file.upload",
        input: {
          url: "https://service.invalid/upload",
          filePath: "/tmp/bridge-demo.png",
          name: "artifact",
        },
      },
      {
        id: "step-5",
        type: "file.download",
        input: {
          url: "https://service.invalid/reports/latest.bin",
        },
      },
      {
        id: "step-6",
        type: "assert.networkRequest",
        input: {
          listenerId: "real-network",
          matcher: {
            resourceType: "upload",
            method: "POST",
            url: "https://service.invalid/upload",
          },
          count: 1,
        },
      },
      {
        id: "step-7",
        type: "assert.networkResponse",
        input: {
          listenerId: "real-network",
          matcher: {
            resourceType: "download",
            method: "GET",
            url: "https://service.invalid/reports/latest.bin",
            statusCode: 206,
            responseBody: {
              tempFilePath: "/tmp/real-mock.bin",
            },
          },
          count: 1,
        },
      },
      { id: "step-8", type: "session.close", input: {} },
    ],
  };

  const execution = await executePlanWithPython(plan, {
    env: {
      ...process.env,
      PYTHONPATH: process.env.PYTHONPATH
        ? `${fakeModuleDir}${path.delimiter}${process.env.PYTHONPATH}`
        : fakeModuleDir,
    },
  });

  assert.equal(execution.response.ok, true);
  const result = execution.response.result as Record<string, unknown>;
  const summary = result.summary as Record<string, unknown>;
  const network = result.network as Record<string, unknown>;
  const cleanupLog = JSON.parse(fs.readFileSync(cleanupLogPath, "utf8")) as Array<Record<string, unknown>>;
  const releaseMethods = cleanupLog
    .filter((entry) => entry.event === "release")
    .map((entry) => entry.method)
    .sort();
  const restoreMethods = cleanupLog
    .filter((entry) => entry.event === "restore")
    .map((entry) => entry.method);

  assert.equal(summary.status, "passed");
  assert.equal(summary.networkEventCount, 4);
  assert.equal(network.eventCount, 4);
  assert.deepEqual(releaseMethods, ["downloadFile", "request", "uploadFile"]);
  assert.ok(restoreMethods.includes("downloadFile"));
});

test("real runtime matcher-only network waits observe traffic without explicit listeners", async () => {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "minium-cli-real-network-matcher-"));
  const fakeModuleDir = path.join(workspaceDir, "fake-python");
  const projectPath = path.join(workspaceDir, "miniapp");
  const devtoolPath = path.join(workspaceDir, "wechat-devtool");
  const artifactsDir = path.join(workspaceDir, "artifacts");
  const testPort = await getAvailablePort();

  fs.mkdirSync(fakeModuleDir, { recursive: true });
  fs.mkdirSync(projectPath, { recursive: true });
  fs.writeFileSync(path.join(projectPath, "project.config.json"), "{}\n", "utf8");
  fs.writeFileSync(
    path.join(fakeModuleDir, "minium.py"),
    [
      "class _Page:",
      "    def __init__(self):",
      "        self.path = '/pages/bridge-lab/index'",
      "        self.renderer = 'webview'",
      "        self.plugin_appid = ''",
      "",
      "class _App:",
      "    def __init__(self):",
      "        self._page = _Page()",
      "        self._hooks = {}",
      "        self._pending = {}",
      "        self._message_index = 0",
      "",
      "    def get_current_page(self):",
      "        return self._page",
      "",
      "    def navigate_to(self, path):",
      "        self._page.path = path",
      "        return self._page",
      "",
      "    def hook_wx_method(self, method, before=None, after=None, callback=None, with_id=False):",
      "        _ = after, with_id",
      "        hook_id = len(self._hooks.get(method, [])) + 1",
      "        self._hooks.setdefault(method, []).append({'id': hook_id, 'before': before, 'callback': callback})",
      "        return hook_id",
      "",
      "    def release_hook_wx_method(self, method, hook_id=None):",
      "        hooks = list(self._hooks.get(method, []))",
      "        if hook_id is None:",
      "            self._hooks[method] = []",
      "        else:",
      "            self._hooks[method] = [item for item in hooks if item['id'] != hook_id]",
      "",
      "    def call_wx_method_async(self, method, payload):",
      "        self._message_index += 1",
      "        message_id = f'async-{self._message_index}'",
      "        options = dict(payload or {})",
      "        if method == 'uploadFile':",
      "            options.setdefault('method', 'POST')",
      "        elif method == 'downloadFile':",
      "            options.setdefault('method', 'GET')",
      "        for hook in list(self._hooks.get(method, [])):",
      "            before = hook.get('before')",
      "            if callable(before):",
      "                before([options, message_id])",
      "        if method == 'uploadFile':",
      "            response = {'statusCode': 200, 'data': '{\"ok\":true}', 'errMsg': 'uploadFile:ok'}",
      "        else:",
      "            response = {'statusCode': 200, 'tempFilePath': '/tmp/matcher-only.bin', 'errMsg': 'downloadFile:ok'}",
      "        self._pending[message_id] = {'method': method, 'response': response}",
      "        return message_id",
      "",
      "    def get_async_response(self, message_id, timeout=0):",
      "        _ = timeout",
      "        pending = self._pending.pop(message_id, None)",
      "        if pending is None:",
      "            return None",
      "        for hook in list(self._hooks.get(pending['method'], [])):",
      "            callback = hook.get('callback')",
      "            if callable(callback):",
      "                callback([pending['response'], message_id])",
      "        return {'result': {'result': pending['response']}}",
      "",
      "class Minium:",
      "    def __init__(self, conf):",
      "        self.conf = conf",
      "        self.app = _App()",
      "",
      "    def shutdown(self):",
      "        return None",
      "",
    ].join("\n"),
    "utf8",
  );
  fs.writeFileSync(
    devtoolPath,
    [
      "#!/bin/sh",
      "PORT=\"\"",
      "while [ \"$#\" -gt 0 ]; do",
      "  if [ \"$1\" = \"--auto-port\" ]; then",
      "    PORT=\"$2\"",
      "    shift 2",
      "  else",
      "    shift",
      "  fi",
      "done",
      "node -e \"const net=require('net'); const port=Number(process.argv[1]); const server=net.createServer(()=>{}); server.listen(port,'127.0.0.1',()=>{}); setTimeout(()=>server.close(()=>process.exit(0)), 15000);\" \"$PORT\" >/dev/null 2>&1 &",
      "exit 0",
      "",
    ].join("\n"),
    { encoding: "utf8", mode: 0o755 },
  );

  const plan: Plan = {
    ...createBasePlan(artifactsDir),
    metadata: {
      name: "real-network-matcher-only",
      draft: false,
    },
    environment: {
      projectPath,
      artifactsDir,
      wechatDevtoolPath: devtoolPath,
      testPort,
      language: "en-US",
      runtimeMode: "real",
    },
    steps: [
      { id: "step-1", type: "session.start", input: { projectPath, initialPagePath: "/pages/bridge-lab/index" } },
      {
        id: "step-2",
        type: "file.upload",
        input: {
          url: "https://service.invalid/upload",
          filePath: "/tmp/bridge-demo.png",
          name: "artifact",
        },
      },
      {
        id: "step-3",
        type: "network.wait",
        input: {
          event: "request",
          matcher: {
            resourceType: "upload",
            method: "POST",
            url: "https://service.invalid/upload",
          },
          timeoutMs: 100,
        },
      },
      {
        id: "step-4",
        type: "assert.networkResponse",
        input: {
          matcher: {
            resourceType: "upload",
            method: "POST",
            url: "https://service.invalid/upload",
            statusCode: 200,
          },
          count: 1,
        },
      },
      { id: "step-5", type: "session.close", input: {} },
    ],
  };

  const execution = await executePlanWithPython(plan, {
    env: {
      ...process.env,
      PYTHONPATH: process.env.PYTHONPATH
        ? `${fakeModuleDir}${path.delimiter}${process.env.PYTHONPATH}`
        : fakeModuleDir,
    },
  });

  assert.equal(execution.response.ok, true);
  const result = execution.response.result as Record<string, unknown>;
  const summary = result.summary as Record<string, unknown>;
  const stepResults = result.stepResults as Array<Record<string, unknown>>;

  assert.equal(summary.status, "passed");
  assert.equal(
    (stepResults[2]?.output as Record<string, unknown>).matched_count,
    1,
  );
  assert.equal(
    (stepResults[3]?.output as Record<string, unknown>).matched_count,
    1,
  );
});

test("localized runtime failures keep structured fields stable", async () => {
  const artifactsDir = createArtifactsDir("minium-cli-zh-failure");
  const plan: Plan = {
    ...createBasePlan(artifactsDir),
    environment: {
      projectPath: ".",
      artifactsDir,
      wechatDevtoolPath: null,
      testPort: 9420,
      language: "zh-CN",
      runtimeMode: "placeholder",
    },
    steps: [
      { id: "step-1", type: "session.start", input: { projectPath: "." } },
      { id: "step-2", type: "assert.pagePath", input: { expectedPath: "pages/home/index" } },
    ],
  };

  const execution = await executePlanWithPython(plan);
  assert.equal(execution.response.ok, true);
  const result = execution.response.result as Record<string, unknown>;
  const summary = result.summary as Record<string, unknown>;
  const failure = summary.failure as Record<string, unknown>;

  assert.equal(failure.error_code, "ASSERTION_FAILED");
  assert.match(String(failure.message), /页面路径断言失败/);
  assert.equal((failure.details as Record<string, unknown>).expected_value, "pages/home/index");
});
