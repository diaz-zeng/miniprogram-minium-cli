import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";

import {
  buildUvDownloadUrl,
  buildUvEnv,
  buildUvRunArgs,
  DEFAULT_PYTHON_REQUEST,
  ensureManagedRuntimeLayout,
  ensureUv,
  getCacheBaseDir,
  getManagedRuntimeLayout,
  getRequestedPythonVersion,
  getUvTarget,
  isSupportedPythonVersion,
  parsePythonVersion,
} from "../src/runtime";

test("getCacheBaseDir honors explicit cache env", () => {
  const dir = getCacheBaseDir({
    env: {
      MINIPROGRAM_MINIUM_CLI_CACHE_DIR: "/tmp/custom-cache",
    },
    platform: "linux",
    homeDir: "/Users/demo",
  });
  assert.equal(dir, "/tmp/custom-cache");
});

test("getManagedRuntimeLayout builds windows-friendly paths", () => {
  const layout = getManagedRuntimeLayout({
    env: {
      LOCALAPPDATA: "C:\\Users\\demo\\AppData\\Local",
    },
    platform: "win32",
    homeDir: "C:\\Users\\demo",
  });

  assert.match(layout.cacheBaseDir, /miniprogram-minium-cli$/);
  assert.match(layout.managedUvBinary, /uv\.exe$/);
  assert.match(layout.uvProjectEnv, /project-venv$/);
});

test("getCacheBaseDir uses XDG cache on linux and ~/.cache on macOS", () => {
  const linuxDir = getCacheBaseDir({
    env: {
      XDG_CACHE_HOME: "/tmp/xdg-cache",
    },
    platform: "linux",
    homeDir: "/Users/demo",
  });
  const macDir = getCacheBaseDir({
    env: {},
    platform: "darwin",
    homeDir: "/Users/demo",
  });

  assert.equal(linuxDir, "/tmp/xdg-cache/miniprogram-minium-cli");
  assert.equal(macDir, "/Users/demo/.cache/miniprogram-minium-cli");
});

test("buildUvEnv keeps runtime private and does not mutate the source env", () => {
  const sourceEnv: NodeJS.ProcessEnv = {
    PATH: "/usr/bin:/bin",
    HOME: "/Users/demo",
  };
  const snapshot = { ...sourceEnv };
  const layout = getManagedRuntimeLayout({
    env: {
      MINIPROGRAM_MINIUM_CLI_CACHE_DIR: "/tmp/private-cache",
    },
    platform: "linux",
    homeDir: "/Users/demo",
  });

  const uvEnv = buildUvEnv(layout, sourceEnv);

  assert.equal(uvEnv.PATH, "/usr/bin:/bin");
  assert.equal(uvEnv.UV_CACHE_DIR, "/tmp/private-cache/uv-cache");
  assert.equal(uvEnv.UV_PYTHON_INSTALL_DIR, "/tmp/private-cache/uv-data/python");
  assert.equal(uvEnv.UV_PROJECT_ENVIRONMENT, "/tmp/private-cache/project-venv");
  assert.equal(uvEnv.UV_SYSTEM_CERTS, "1");
  assert.deepEqual(sourceEnv, snapshot);
});

test("ensureManagedRuntimeLayout falls back to a workspace cache when the default cache is not writable", () => {
  const tempCwd = fs.mkdtempSync(path.join(os.tmpdir(), "minium-cli-runtime-"));
  const mkdirCalls: string[] = [];
  const originalMkdirSync = fs.mkdirSync;

  (fs as unknown as { mkdirSync: typeof fs.mkdirSync }).mkdirSync = ((target: fs.PathLike, options?: fs.MakeDirectoryOptions) => {
    const normalized = String(target);
    mkdirCalls.push(normalized);
    if (normalized.startsWith("/root/.cache/miniprogram-minium-cli")) {
      const error = new Error("permission denied") as NodeJS.ErrnoException;
      error.code = "EACCES";
      throw error;
    }
    return originalMkdirSync(target, options);
  }) as typeof fs.mkdirSync;

  try {
    const layout = ensureManagedRuntimeLayout({
      env: {},
      platform: "linux",
      homeDir: "/root",
      cwd: tempCwd,
    });

    assert.equal(layout.cacheBaseDir, path.join(tempCwd, ".minium-cli", "cache"));
    assert.ok(mkdirCalls.some((entry) => entry.startsWith("/root/.cache/miniprogram-minium-cli")));
    assert.ok(fs.existsSync(layout.uvInstallDir));
    assert.ok(fs.existsSync(layout.uvCacheDir));
  } finally {
    (fs as unknown as { mkdirSync: typeof fs.mkdirSync }).mkdirSync = originalMkdirSync;
    fs.rmSync(tempCwd, { recursive: true, force: true });
  }
});

test("parsePythonVersion extracts semantic version", () => {
  assert.deepEqual(parsePythonVersion("3.14"), [3, 14, 0]);
  assert.deepEqual(parsePythonVersion("Python 3.11.9"), [3, 11, 9]);
});

test("isSupportedPythonVersion rejects python 3.9 and accepts python 3.11+", () => {
  assert.equal(isSupportedPythonVersion([3, 9, 6]), false);
  assert.equal(isSupportedPythonVersion([3, 11, 0]), true);
  assert.equal(isSupportedPythonVersion([3, 14, 0]), true);
});

test("getRequestedPythonVersion uses default 3.14", () => {
  assert.equal(getRequestedPythonVersion({}), DEFAULT_PYTHON_REQUEST);
});

test("getRequestedPythonVersion rejects versions below 3.11", () => {
  assert.throws(() =>
    getRequestedPythonVersion({
      MINIPROGRAM_MINIUM_CLI_PYTHON_VERSION: "3.9",
    }),
  );
});

test("getUvTarget resolves darwin arm64 target", () => {
  const target = getUvTarget({ platform: "darwin", arch: "arm64" });
  assert.deepEqual(target, {
    triple: "aarch64-apple-darwin",
    archiveExt: "tar.gz",
  });
});

test("buildUvDownloadUrl uses latest by default and honors explicit version", () => {
  const latestUrl = buildUvDownloadUrl("x86_64-unknown-linux-gnu", "tar.gz", {});
  assert.match(latestUrl, /releases\/latest\/download/);

  const fixedUrl = buildUvDownloadUrl("x86_64-unknown-linux-gnu", "tar.gz", {
    MINIPROGRAM_MINIUM_CLI_UV_VERSION: "0.6.9",
  });
  assert.match(fixedUrl, /download\/0\.6\.9\//);
});

test("buildUvRunArgs builds a managed-python command", () => {
  const args = buildUvRunArgs(
    {
      pythonProjectRoot: "/tmp/python-project",
    },
    "3.14",
    ["-m", "miniprogram_minium_cli"],
  );

  assert.deepEqual(args, [
    "run",
    "--project",
    "/tmp/python-project",
    "--managed-python",
    "--python",
    "3.14",
    "python",
    "-m",
    "miniprogram_minium_cli",
  ]);
});

test("ensureUv deduplicates concurrent managed uv installs", async () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "minium-cli-uv-cache-"));
  const downloadCalls: string[] = [];
  const env = {
    MINIPROGRAM_MINIUM_CLI_CACHE_DIR: cacheDir,
  };

  try {
    const options = {
      env,
      platform: "linux" as const,
      arch: "x64" as const,
      downloadImplementation: async (url: string, targetPath: string) => {
        downloadCalls.push(url);
        await fs.promises.writeFile(targetPath, "fake-archive", "utf8");
        await new Promise((resolve) => setTimeout(resolve, 25));
      },
      extractArchiveImplementation: (archivePath: string, extractDir: string) => {
        void archivePath;
        const extractedRoot = path.join(extractDir, "uv-x86_64-unknown-linux-gnu");
        fs.mkdirSync(extractedRoot, { recursive: true });
        fs.writeFileSync(path.join(extractedRoot, "uv"), "#!/bin/sh\nexit 0\n", "utf8");
        fs.writeFileSync(path.join(extractedRoot, "uvx"), "#!/bin/sh\nexit 0\n", "utf8");
      },
    };

    const [first, second] = await Promise.all([ensureUv(options), ensureUv(options)]);

    assert.equal(first, second);
    assert.equal(downloadCalls.length, 1);
    assert.ok(fs.existsSync(first));
    assert.ok(fs.existsSync(path.join(cacheDir, "uv-bin", "uvx")));
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});
