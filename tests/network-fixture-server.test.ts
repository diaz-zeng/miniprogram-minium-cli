import * as assert from "node:assert/strict";
import { spawn, type ChildProcessByStdio } from "node:child_process";
import { type Readable } from "node:stream";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";

type FixtureServerProcess = ChildProcessByStdio<null, Readable, Readable>;

type ReadyMessage = {
  type: string;
  host: string;
  port: number;
  baseUrl: string;
};

function waitForReady(server: FixtureServerProcess): Promise<ReadyMessage> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`fixture server did not become ready. stderr=${stderr}`));
    }, 5000);

    const cleanup = () => {
      clearTimeout(timer);
      server.stdout.off("data", onStdout);
      server.stderr.off("data", onStderr);
      server.off("exit", onExit);
      server.off("error", onError);
    };

    const onStdout = (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      for (const line of stdout.split(/\r?\n/)) {
        if (line.trim().length === 0) {
          continue;
        }
        try {
          const message = JSON.parse(line) as ReadyMessage;
          if (message.type === "fixture-server.ready") {
            cleanup();
            resolve(message);
            return;
          }
        } catch (_error) {
          continue;
        }
      }
    };

    const onStderr = (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    };

    const onExit = (code: number | null) => {
      cleanup();
      reject(new Error(`fixture server exited before ready with code ${code}. stderr=${stderr}`));
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    server.stdout.on("data", onStdout);
    server.stderr.on("data", onStderr);
    server.on("exit", onExit);
    server.on("error", onError);
  });
}

async function stopServer(server: FixtureServerProcess): Promise<void> {
  if (server.exitCode !== null || server.killed) {
    return;
  }
  server.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => server.once("exit", () => resolve())),
    sleep(2000).then(() => undefined),
  ]);
}

test("demo network fixture server handles request, upload, and download routes", { timeout: 10000 }, async (t) => {
  const server = spawn(process.execPath, ["examples/demo-regression/network-fixture-server.mjs", "--port", "0"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => stopServer(server));

  const ready = await waitForReady(server);
  assert.equal(ready.host, "127.0.0.1");
  assert.ok(ready.port > 0);

  const healthResponse = await fetch(`${ready.baseUrl}/healthz`);
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), { ok: true });

  const loginResponse = await fetch(`${ready.baseUrl}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "demo-user" }),
  });
  assert.equal(loginResponse.status, 200);
  assert.equal((await loginResponse.json()).source, "local-fixture");

  const reviewsResponse = await fetch(`${ready.baseUrl}/api/reviews?tab=main`);
  assert.equal(reviewsResponse.status, 200);
  const reviewsBody = await reviewsResponse.json();
  assert.equal(reviewsBody.tab, "main");
  assert.equal(reviewsBody.reviews.length, 2);

  const uploadResponse = await fetch(`${ready.baseUrl}/upload`, {
    method: "POST",
    body: "fixture upload body",
  });
  assert.equal(uploadResponse.status, 200);
  assert.ok((await uploadResponse.json()).receivedBytes > 0);

  const downloadResponse = await fetch(`${ready.baseUrl}/reports/latest.bin`);
  assert.equal(downloadResponse.status, 200);
  assert.match(await downloadResponse.text(), /fixture report/);
});
