import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";

import { loadPlanFromFile, loadPlanFromJson, PLAN_KIND, PLAN_VERSION, validatePlan } from "../src/plan";

test("validatePlan rejects unsupported step type", () => {
  const validation = validatePlan({
    version: PLAN_VERSION,
    kind: PLAN_KIND,
    metadata: { draft: false, name: "demo" },
    execution: { mode: "serial", failFast: true },
    environment: {
      projectPath: "/tmp/demo-miniapp",
      artifactsDir: null,
      wechatDevtoolPath: null,
      testPort: 9420,
      language: "en",
    },
    steps: [
      {
        id: "step-1",
        type: "unknown.step",
        input: {},
      },
    ],
  });

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /unsupported/);
});

test("validatePlan rejects duplicate step ids", () => {
  const validation = validatePlan({
    version: PLAN_VERSION,
    kind: PLAN_KIND,
    metadata: { draft: false, name: "duplicate-step-id" },
    execution: { mode: "serial", failFast: true },
    environment: {
      projectPath: "/tmp/demo-miniapp",
      artifactsDir: null,
      wechatDevtoolPath: null,
      testPort: 9420,
      language: "en",
    },
    steps: [
      {
        id: "step-1",
        type: "session.start",
        input: { projectPath: "/tmp/demo-miniapp" },
      },
      {
        id: "step-1",
        type: "network.listen.start",
        input: { listenerId: "network-all" },
      },
    ],
  });

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /id must be unique/);
});

test("validatePlan accepts supported bridge step types", () => {
  const validation = validatePlan({
    version: PLAN_VERSION,
    kind: PLAN_KIND,
    metadata: { draft: false, name: "bridge-demo" },
    execution: { mode: "serial", failFast: true },
    environment: {
      projectPath: "/tmp/demo-miniapp",
      artifactsDir: null,
      wechatDevtoolPath: null,
      testPort: 9420,
      language: "en",
    },
    steps: [
      {
        id: "step-1",
        type: "session.start",
        input: { projectPath: "/tmp/demo-miniapp" },
      },
      {
        id: "step-2",
        type: "storage.set",
        input: { key: "demo-key", value: "demo-value" },
      },
      {
        id: "step-3",
        type: "navigation.navigateTo",
        input: { url: "/pages/bridge-lab/index" },
      },
      {
        id: "step-4",
        type: "file.stage",
        input: { filePath: "minium://user-data/bridge-demo.txt", content: "demo" },
      },
      {
        id: "step-5",
        type: "subscription.requestMessage",
        input: { tmplIds: ["tmpl-demo"] },
      },
    ],
  });

  assert.equal(validation.ok, true);
});

test("validatePlan rejects invalid file staging input", () => {
  const validation = validatePlan({
    version: PLAN_VERSION,
    kind: PLAN_KIND,
    metadata: { draft: false, name: "invalid-file-stage" },
    execution: { mode: "serial", failFast: true },
    environment: {
      projectPath: "/tmp/demo-miniapp",
      artifactsDir: null,
      wechatDevtoolPath: null,
      testPort: 9420,
      language: "en",
    },
    steps: [
      {
        id: "step-1",
        type: "file.stage",
        input: {
          filePath: "minium://user-data/missing-content.txt",
        },
      },
      {
        id: "step-2",
        type: "file.stage",
        input: {
          filePath: "minium://user-data/ambiguous-content.txt",
          content: "plain",
          contentBase64: "cGxhaW4=",
        },
      },
    ],
  });

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /file\.stage requires content or contentBase64/);
  assert.match(validation.errors.join("\n"), /file\.stage cannot combine content and contentBase64/);
});

test("validatePlan accepts supported network step types", () => {
  const validation = validatePlan({
    version: PLAN_VERSION,
    kind: PLAN_KIND,
    metadata: { draft: false, name: "network-demo" },
    execution: { mode: "serial", failFast: true },
    environment: {
      projectPath: "/tmp/demo-miniapp",
      artifactsDir: null,
      wechatDevtoolPath: null,
      testPort: 9420,
      language: "en",
    },
    steps: [
      {
        id: "step-1",
        type: "session.start",
        input: { projectPath: "/tmp/demo-miniapp" },
      },
      {
        id: "step-2",
        type: "network.listen.start",
        input: {
          listenerId: "home-requests",
          captureResponses: true,
          matcher: {
            urlPattern: "/api/",
            method: "POST",
            headers: { "x-demo": "1" },
          },
        },
      },
      {
        id: "step-3",
        type: "network.wait",
        input: {
          listenerId: "home-requests",
          event: "request",
          timeoutMs: 1500,
        },
      },
      {
        id: "step-4",
        type: "assert.networkRequest",
        input: {
          matcher: {
            url: "/api/orders",
            query: { id: "123" },
          },
          minCount: 1,
        },
      },
      {
        id: "step-5",
        type: "assert.networkResponse",
        input: {
          matcher: {
            url: "/api/orders",
            statusCode: 200,
          },
          count: 1,
        },
      },
      {
        id: "step-6",
        type: "network.intercept.add",
        input: {
          ruleId: "orders-mock",
          matcher: {
            url: "/api/orders",
            method: "GET",
          },
          behavior: {
            action: "mock",
            response: {
              statusCode: 200,
              headers: { "content-type": "application/json" },
              body: { ok: true },
            },
          },
        },
      },
      {
        id: "step-7",
        type: "network.intercept.remove",
        input: { ruleId: "orders-mock" },
      },
      {
        id: "step-8",
        type: "network.listen.stop",
        input: { listenerId: "home-requests" },
      },
      {
        id: "step-9",
        type: "network.intercept.clear",
        input: {},
      },
    ],
  });

  assert.equal(validation.ok, true);
});

test("validatePlan rejects invalid network matcher shapes", () => {
  const validation = validatePlan({
    version: PLAN_VERSION,
    kind: PLAN_KIND,
    metadata: { draft: false, name: "invalid-network-matcher" },
    execution: { mode: "serial", failFast: true },
    environment: {
      projectPath: "/tmp/demo-miniapp",
      artifactsDir: null,
      wechatDevtoolPath: null,
      testPort: 9420,
      language: "en",
    },
    steps: [
      {
        id: "step-1",
        type: "network.wait",
        input: {
          matcher: "not-an-object",
        },
      },
    ],
  });

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /network\.wait matcher must be an object/);
});

test("validatePlan rejects invalid intercept behavior and conflicting assertion counts", () => {
  const validation = validatePlan({
    version: PLAN_VERSION,
    kind: PLAN_KIND,
    metadata: { draft: false, name: "invalid-network-intercept" },
    execution: { mode: "serial", failFast: true },
    environment: {
      projectPath: "/tmp/demo-miniapp",
      artifactsDir: null,
      wechatDevtoolPath: null,
      testPort: 9420,
      language: "en",
    },
    steps: [
      {
        id: "step-1",
        type: "assert.networkRequest",
        input: {
          count: 1,
          minCount: 1,
        },
      },
      {
        id: "step-2",
        type: "network.intercept.add",
        input: {
          matcher: {
            urlPattern: "/api/",
          },
          behavior: {
            action: "delay",
          },
        },
      },
    ],
  });

  assert.equal(validation.ok, false);
  assert.match(validation.errors.join("\n"), /cannot combine count with minCount or maxCount/);
  assert.match(validation.errors.join("\n"), /behavior\.delayMs must be numeric/);
});

test("loadPlanFromFile resolves relative environment paths from the plan directory", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "minium-cli-plan-relative-"));
  const nestedDir = path.join(tempDir, "plans");
  const planPath = path.join(nestedDir, "demo.plan.json");
  fs.mkdirSync(nestedDir, { recursive: true });
  fs.writeFileSync(
    planPath,
    JSON.stringify(
      {
        version: PLAN_VERSION,
        kind: PLAN_KIND,
        metadata: { draft: false, name: "demo-relative" },
        execution: { mode: "serial", failFast: true },
        environment: {
          projectPath: "../demo-miniapp",
          artifactsDir: "../.minium-cli/runs",
          wechatDevtoolPath: "../bin/wechat-devtool",
          testPort: 9420,
          language: "en-US",
          autoScreenshot: "on-success",
          runtimeMode: "auto",
        },
        steps: [
          {
            id: "step-1",
            type: "session.start",
            input: {
              projectPath: "../demo-miniapp",
            },
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  const loaded = loadPlanFromFile(planPath);
  assert.equal(loaded.plan.environment.projectPath, path.join(tempDir, "demo-miniapp"));
  assert.equal(loaded.plan.environment.artifactsDir, path.join(tempDir, ".minium-cli", "runs"));
  assert.equal(loaded.plan.environment.wechatDevtoolPath, path.join(tempDir, "bin", "wechat-devtool"));
  assert.equal(loaded.plan.environment.autoScreenshot, "on-success");
  assert.equal(loaded.plan.steps[0]?.input.projectPath, path.join(tempDir, "demo-miniapp"));
});

test("bundled demo regression plans load successfully", () => {
  const planDir = path.join(process.cwd(), "examples", "demo-regression");
  const planFiles = fs
    .readdirSync(planDir)
    .filter((fileName) => fileName.endsWith(".plan.json"))
    .sort();

  assert.ok(planFiles.length >= 8);
  for (const fileName of planFiles) {
    const loaded = loadPlanFromFile(path.join(planDir, fileName));
    assert.match(String(loaded.plan.environment.projectPath), /examples\/demo-miniapp$/);
  }
});

test("loadPlanFromJson resolves relative paths from the provided base directory", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "minium-cli-inline-plan-"));
  const raw = JSON.stringify({
    version: PLAN_VERSION,
    kind: PLAN_KIND,
    metadata: { draft: false, name: "inline-relative" },
    execution: { mode: "serial", failFast: true },
    environment: {
      projectPath: "./examples/demo-miniapp",
      artifactsDir: "./.minium-cli/runs",
      wechatDevtoolPath: "./bin/wechat-devtool",
      testPort: 9420,
      language: "en-US",
      autoScreenshot: "off",
      runtimeMode: "auto",
    },
    steps: [
      {
        id: "step-1",
        type: "session.start",
        input: {
          projectPath: "./examples/demo-miniapp",
        },
      },
    ],
  });

  const loaded = loadPlanFromJson(raw, { baseDir: tempDir });
  assert.equal(loaded.path, "<inline-json>");
  assert.equal(loaded.plan.environment.projectPath, path.join(tempDir, "examples", "demo-miniapp"));
  assert.equal(loaded.plan.environment.artifactsDir, path.join(tempDir, ".minium-cli", "runs"));
  assert.equal(loaded.plan.environment.wechatDevtoolPath, path.join(tempDir, "bin", "wechat-devtool"));
  assert.equal(loaded.plan.steps[0]?.input.projectPath, path.join(tempDir, "examples", "demo-miniapp"));
});
