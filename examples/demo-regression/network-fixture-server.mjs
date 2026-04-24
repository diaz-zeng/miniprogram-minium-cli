#!/usr/bin/env node
import { createServer } from "node:http";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 9781;

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || index + 1 >= process.argv.length) {
    return undefined;
  }
  return process.argv[index + 1];
}

function jsonResponse(response, statusCode, body, headers = {}) {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "*",
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    ...headers,
  });
  response.end(payload);
}

function binaryResponse(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, {
    "access-control-allow-origin": "*",
    "content-type": "application/octet-stream",
    "content-length": body.length,
    ...headers,
  });
  response.end(body);
}

function collectRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

const host = process.env.HOST || readArg("--host") || DEFAULT_HOST;
const requestedPort = Number(process.env.PORT || readArg("--port") || DEFAULT_PORT);

const server = createServer(async (request, response) => {
  const method = request.method || "GET";
  const requestUrl = new URL(request.url || "/", `http://${host}:${requestedPort}`);

  if (method === "OPTIONS") {
    response.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "*",
    });
    response.end();
    return;
  }

  if (requestUrl.pathname === "/healthz") {
    jsonResponse(response, 200, { ok: true });
    return;
  }

  if (requestUrl.pathname === "/api/login" && method === "POST") {
    const body = await collectRequestBody(request);
    jsonResponse(response, 200, {
      ok: true,
      token: "local-fixture-token",
      receivedBytes: body.length,
      source: "local-fixture",
    });
    return;
  }

  if (requestUrl.pathname === "/api/reviews" && method === "GET") {
    jsonResponse(response, 200, {
      ok: true,
      tab: requestUrl.searchParams.get("tab") || "main",
      reviews: [
        { id: "review-1", title: "Local fixture review", state: "ready" },
        { id: "review-2", title: "Network artifact check", state: "ready" },
      ],
      source: "local-fixture",
    });
    return;
  }

  if (requestUrl.pathname === "/upload" && method === "POST") {
    const body = await collectRequestBody(request);
    jsonResponse(response, 200, {
      ok: true,
      receivedBytes: body.length,
      source: "local-fixture",
    });
    return;
  }

  if (requestUrl.pathname === "/reports/latest.bin" && method === "GET") {
    const body = Buffer.from("miniprogram-minium-cli fixture report\n", "utf8");
    binaryResponse(response, 200, body, {
      "content-disposition": "attachment; filename=\"latest.bin\"",
    });
    return;
  }

  jsonResponse(response, 404, {
    ok: false,
    error: "not_found",
    path: requestUrl.pathname,
  });
});

server.on("error", (error) => {
  console.error(JSON.stringify({ type: "fixture-server.error", message: error.message }));
  process.exitCode = 1;
});

server.listen(requestedPort, host, () => {
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : requestedPort;
  console.log(JSON.stringify({ type: "fixture-server.ready", host, port, baseUrl: `http://${host}:${port}` }));
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
