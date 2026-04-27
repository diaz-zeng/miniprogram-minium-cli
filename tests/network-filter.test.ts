import * as assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

async function loadFilterModule() {
  return import(pathToFileURL(path.join(
    process.cwd(),
    "skills/miniprogram-minium-cli/scripts/filter-network-artifact.mjs",
  )).href);
}

function createResultPayload() {
  return {
    artifacts: {
      networkPath: "/tmp/run/network.json",
    },
    stepResults: [
      {
        id: "step-a",
        type: "network.wait",
        status: "passed",
        details: {
          networkEvidence: [
            {
              artifactPath: "/tmp/run/network.json",
              eventId: "session-a/step-network-wait-matched-3",
              requestId: "session-a/request-1",
              listenerId: "session-a/home-network",
              summary: "Step step-a matched a response event",
            },
          ],
        },
      },
      {
        id: "step-b",
        type: "assert.networkRequest",
        status: "passed",
        details: {
          networkEvidence: [
            {
              artifactPath: "/tmp/run/network.json",
              eventId: "session-b/step-assert-networkRequest-matched-2",
              requestId: "session-b/request-1",
              listenerId: "session-b/review-network",
              summary: "Step step-b matched 1 request event",
            },
          ],
        },
      },
    ],
  };
}

function createNetworkPayload() {
  return {
    schemaVersion: 1,
    events: [
      {
        eventId: "session-a/listener-started-1",
        type: "listener.started",
        time: "2026-04-23T00:00:00+00:00",
        sessionId: "session-a",
        summary: "Listener home-network started",
        listenerId: "session-a/home-network",
        data: {},
      },
      {
        eventId: "session-a/request-2",
        type: "request.observed",
        time: "2026-04-23T00:00:01+00:00",
        sessionId: "session-a",
        summary: "Observed request POST https://service.invalid/api/login",
        requestId: "session-a/request-1",
        listenerId: "session-a/home-network",
        data: {
          listenerIds: ["session-a/home-network"],
        },
      },
      {
        eventId: "session-a/step-network-wait-matched-3",
        type: "step.network.wait.matched",
        time: "2026-04-23T00:00:02+00:00",
        sessionId: "session-a",
        summary: "Step step-a matched a response event",
        stepId: "step-a",
        requestId: "session-a/request-1",
        listenerId: "session-a/home-network",
        data: {
          matchedEventIds: ["session-a/request-2"],
          matchedRequestIds: ["session-a/request-1"],
        },
      },
      {
        eventId: "session-b/listener-started-1",
        type: "listener.started",
        time: "2026-04-23T00:00:03+00:00",
        sessionId: "session-b",
        summary: "Listener review-network started",
        listenerId: "session-b/review-network",
        data: {},
      },
      {
        eventId: "session-b/request-1",
        type: "request.observed",
        time: "2026-04-23T00:00:04+00:00",
        sessionId: "session-b",
        summary: "Observed request GET https://service.invalid/api/reviews",
        requestId: "session-b/request-1",
        listenerId: "session-b/review-network",
        data: {
          listenerIds: ["session-b/review-network"],
        },
      },
      {
        eventId: "session-b/step-assert-networkRequest-matched-2",
        type: "step.assert.networkRequest.matched",
        time: "2026-04-23T00:00:05+00:00",
        sessionId: "session-b",
        summary: "Step step-b matched 1 request event",
        stepId: "step-b",
        requestId: "session-b/request-1",
        listenerId: "session-b/review-network",
        data: {
          matchedEventIds: ["session-b/request-1"],
          matchedRequestIds: ["session-b/request-1"],
        },
      },
    ],
    requests: {
      "session-a/request-1": {
        url: "https://service.invalid/api/login",
        method: "POST",
        resourceType: "request",
        query: {},
        headers: {},
        body: { username: "demo" },
        pagePath: "/pages/home/index",
        statusCode: 200,
        responseHeaders: {},
        responseBody: { ok: true },
        outcome: "continue",
        listenerIds: ["session-a/home-network"],
        interceptIds: [],
        eventIds: ["session-a/request-2", "session-a/step-network-wait-matched-3"],
        firstEventId: "session-a/request-2",
        lastEventId: "session-a/step-network-wait-matched-3",
        sessionId: "session-a",
      },
      "session-b/request-1": {
        url: "https://service.invalid/api/reviews",
        method: "GET",
        resourceType: "request",
        query: {},
        headers: {},
        body: null,
        pagePath: "/pages/review/index",
        statusCode: 200,
        responseHeaders: {},
        responseBody: { ok: true },
        outcome: "continue",
        listenerIds: ["session-b/review-network"],
        interceptIds: [],
        eventIds: ["session-b/request-1", "session-b/step-assert-networkRequest-matched-2"],
        firstEventId: "session-b/request-1",
        lastEventId: "session-b/step-assert-networkRequest-matched-2",
        sessionId: "session-b",
      },
    },
    listeners: {
      "session-a/home-network": {
        matcher: null,
        captureResponses: true,
        active: true,
        startedAt: "2026-04-23T00:00:00+00:00",
        stoppedAt: null,
        hitCount: 2,
        eventIds: ["session-a/listener-started-1", "session-a/request-2", "session-a/step-network-wait-matched-3"],
        firstEventId: "session-a/listener-started-1",
        lastEventId: "session-a/step-network-wait-matched-3",
        sessionId: "session-a",
      },
      "session-b/review-network": {
        matcher: null,
        captureResponses: false,
        active: true,
        startedAt: "2026-04-23T00:00:03+00:00",
        stoppedAt: null,
        hitCount: 2,
        eventIds: ["session-b/listener-started-1", "session-b/request-1", "session-b/step-assert-networkRequest-matched-2"],
        firstEventId: "session-b/listener-started-1",
        lastEventId: "session-b/step-assert-networkRequest-matched-2",
        sessionId: "session-b",
      },
    },
    intercepts: {},
  };
}

test("filter helper selects every step with networkEvidence by default", async () => {
  const { buildFilteredNetworkArtifact } = await loadFilterModule();
  const filtered = buildFilteredNetworkArtifact({
    networkPath: "/tmp/run/network.json",
    networkPayload: createNetworkPayload(),
    resultPath: "/tmp/run/result.json",
    resultPayload: createResultPayload(),
  });

  assert.equal(filtered.schemaVersion, 1);
  assert.equal(filtered.meta.selectedStepIds.length, 2);
  assert.equal(Object.keys(filtered.requests).length, 2);
  assert.equal(Object.keys(filtered.listeners).length, 2);
  assert.equal(filtered.meta.selectedCounts.events >= 6, true);
});

test("filter helper narrows to the requested step id across sessions", async () => {
  const { buildFilteredNetworkArtifact } = await loadFilterModule();
  const filtered = buildFilteredNetworkArtifact({
    networkPath: "/tmp/run/network.json",
    networkPayload: createNetworkPayload(),
    requestedStepIds: ["step-a"],
    resultPath: "/tmp/run/result.json",
    resultPayload: createResultPayload(),
  });

  assert.deepEqual(filtered.meta.selectedStepIds, ["step-a"]);
  assert.deepEqual(Object.keys(filtered.requests), ["session-a/request-1"]);
  assert.deepEqual(Object.keys(filtered.listeners), ["session-a/home-network"]);
  assert.equal(filtered.events.every((event: Record<string, unknown>) => event.sessionId === "session-a"), true);
});

test("filter helper prefers the explicit network path override", async () => {
  const { resolveNetworkArtifactPath } = await loadFilterModule();
  const resolvedPath = await resolveNetworkArtifactPath(createResultPayload(), "./artifacts/network.json");
  assert.equal(resolvedPath, path.resolve(process.cwd(), "./artifacts/network.json"));
});

test("filter helper fails when result.json has no networkEvidence", async () => {
  const { buildFilteredNetworkArtifact } = await loadFilterModule();
  assert.throws(
    () => buildFilteredNetworkArtifact({
      networkPath: "/tmp/run/network.json",
      networkPayload: createNetworkPayload(),
      resultPath: "/tmp/run/result.json",
      resultPayload: {
        artifacts: { networkPath: "/tmp/run/network.json" },
        stepResults: [
          { id: "step-a", type: "network.wait", status: "passed" },
        ],
      },
    }),
    /networkEvidence/,
  );
});

test("filter helper rejects step ids that do not exist in result.json", async () => {
  const { buildFilteredNetworkArtifact } = await loadFilterModule();
  assert.throws(
    () => buildFilteredNetworkArtifact({
      networkPath: "/tmp/run/network.json",
      networkPayload: createNetworkPayload(),
      requestedStepIds: ["missing-step"],
      resultPath: "/tmp/run/result.json",
      resultPayload: createResultPayload(),
    }),
    /Could not find step/,
  );
});

test("filter helper CLI runs from paths that require file URL escaping", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "minium filter helper "));
  const scriptPath = path.join(tempDir, "filter network artifact.mjs");

  try {
    await fs.copyFile(
      path.join(process.cwd(), "skills/miniprogram-minium-cli/scripts/filter-network-artifact.mjs"),
      scriptPath,
    );

    const { stdout } = await execFile(process.execPath, [scriptPath, "--help"], {
      cwd: process.cwd(),
    });

    assert.match(stdout, /Usage:/);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
