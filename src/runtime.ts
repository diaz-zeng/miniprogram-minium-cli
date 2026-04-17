import { spawnSync, type SpawnSyncOptionsWithStringEncoding, type SpawnSyncReturns } from "node:child_process";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as https from "node:https";
import * as os from "node:os";
import * as path from "node:path";

import type { Plan } from "./plan";

export const APP_DIRNAME = "miniprogram-minium-cli";
export const PROTOCOL_VERSION = 1;
export const MINIMUM_PYTHON_VERSION = Object.freeze([3, 11, 0] as const);
export const DEFAULT_PYTHON_REQUEST = "3.14";

export interface RuntimeLayout {
  cacheBaseDir: string;
  uvInstallDir: string;
  uvDataDir: string;
  uvCacheDir: string;
  uvProjectEnv: string;
  uvPythonInstallDir: string;
  pythonProjectRoot: string;
  managedUvBinary: string;
}

export interface ManagedRuntimeDetails {
  pythonVersion: string | null;
  executable: string | null;
  raw?: string;
}

export interface RuntimeContext {
  layout: RuntimeLayout;
  uvBin: string;
  pythonRequest: string;
  env: NodeJS.ProcessEnv;
}

export interface ExecutePlanResponse {
  protocolVersion: number;
  ok: boolean;
  result?: Record<string, unknown>;
  error?: Record<string, unknown>;
}

export interface ExecutePlanResult {
  runtime: {
    uvBin: string;
    pythonRequest: string;
    layout: RuntimeLayout;
  };
  response: ExecutePlanResponse;
}

function normalizeSpawnOutput(value: string | NodeJS.ArrayBufferView | null | undefined): string {
  if (typeof value === "string") {
    return value;
  }
  if (!value) {
    return "";
  }
  return Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString("utf8");
}

type SpawnImplementation = (
  command: string,
  args?: readonly string[],
  options?: SpawnSyncOptionsWithStringEncoding,
) => SpawnSyncReturns<string>;

type DownloadImplementation = (url: string, targetPath: string) => Promise<void>;
type ExtractArchiveImplementation = (
  archivePath: string,
  extractDir: string,
  archiveExt: string,
  options?: RuntimeOptions,
) => void;

export interface RuntimeOptions {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  arch?: NodeJS.Architecture;
  homeDir?: string;
  cwd?: string;
  spawnImplementation?: SpawnImplementation;
  downloadImplementation?: DownloadImplementation;
  extractArchiveImplementation?: ExtractArchiveImplementation;
}

const managedUvInstallPromises = new Map<string, Promise<void>>();

export class RuntimeLaunchError extends Error {
  readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "RuntimeLaunchError";
    this.details = details;
  }
}

export function getCacheBaseDir(options: RuntimeOptions = {}): string {
  const env = options.env || process.env;
  const platform = options.platform || process.platform;
  const homeDir = options.homeDir || os.homedir();

  if (env.MINIPROGRAM_MINIUM_CLI_CACHE_DIR) {
    return path.resolve(env.MINIPROGRAM_MINIUM_CLI_CACHE_DIR);
  }

  if (platform === "win32") {
    return path.join(
      env.LOCALAPPDATA || path.join(homeDir, "AppData", "Local"),
      APP_DIRNAME,
    );
  }

  if (env.XDG_CACHE_HOME) {
    return path.join(env.XDG_CACHE_HOME, APP_DIRNAME);
  }

  return path.join(homeDir, ".cache", APP_DIRNAME);
}

export function getManagedRuntimeLayout(options: RuntimeOptions = {}): RuntimeLayout {
  const cacheBaseDir = getCacheBaseDir(options);
  const platform = options.platform || process.platform;
  return {
    cacheBaseDir,
    uvInstallDir: path.join(cacheBaseDir, "uv-bin"),
    uvDataDir: path.join(cacheBaseDir, "uv-data"),
    uvCacheDir: path.join(cacheBaseDir, "uv-cache"),
    uvProjectEnv: path.join(cacheBaseDir, "project-venv"),
    uvPythonInstallDir: path.join(cacheBaseDir, "uv-data", "python"),
    pythonProjectRoot: path.resolve(__dirname, "..", "..", "python"),
    managedUvBinary: path.join(cacheBaseDir, "uv-bin", platform === "win32" ? "uv.exe" : "uv"),
  };
}

export function ensureManagedRuntimeLayout(options: RuntimeOptions = {}): RuntimeLayout {
  const preferredLayout = getManagedRuntimeLayout(options);
  try {
    createRuntimeDirs(preferredLayout);
    return preferredLayout;
  } catch (error) {
    if (!isPermissionLikeError(error)) {
      throw error;
    }

    const fallbackLayout = getManagedRuntimeLayout({
      ...options,
      env: {
        ...(options.env || process.env),
        MINIPROGRAM_MINIUM_CLI_CACHE_DIR: path.join(options.cwd || process.cwd(), ".minium-cli", "cache"),
      },
    });
    createRuntimeDirs(fallbackLayout);
    return fallbackLayout;
  }
}

export function createRuntimeDirs(layout: RuntimeLayout): void {
  for (const dir of [layout.cacheBaseDir, layout.uvInstallDir, layout.uvDataDir, layout.uvCacheDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function isPermissionLikeError(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (((error as NodeJS.ErrnoException).code === "EACCES") || ((error as NodeJS.ErrnoException).code === "EPERM")),
  );
}

export function parsePythonVersion(versionText: string): number[] | null {
  const match = String(versionText).match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) {
    return null;
  }
  return match.slice(1, 4).map((value, index) => {
    if (index === 2 && value === undefined) {
      return 0;
    }
    return Number(value || 0);
  });
}

export function isSupportedPythonVersion(version: number[] | null): boolean {
  if (!Array.isArray(version) || version.length < 2) {
    return false;
  }
  const [major, minor, patch = 0] = version;
  const [requiredMajor, requiredMinor, requiredPatch] = MINIMUM_PYTHON_VERSION;
  if (major !== requiredMajor) {
    return major > requiredMajor;
  }
  if (minor !== requiredMinor) {
    return minor > requiredMinor;
  }
  return patch >= requiredPatch;
}

export function getRequestedPythonVersion(env: NodeJS.ProcessEnv = process.env): string {
  const request = String(env.MINIPROGRAM_MINIUM_CLI_PYTHON_VERSION || DEFAULT_PYTHON_REQUEST).trim();
  const version = parsePythonVersion(request);
  if (!isSupportedPythonVersion(version)) {
    throw new RuntimeLaunchError(
      `Managed Python version requests must be >= ${MINIMUM_PYTHON_VERSION.join(".")}; received ${request}.`,
      {
        requested: request,
        minimumVersion: MINIMUM_PYTHON_VERSION.join("."),
      },
    );
  }
  return request;
}

export function findSystemUv(options: RuntimeOptions = {}): string | null {
  const spawnImplementation = options.spawnImplementation || spawnSync;
  const candidate = process.platform === "win32" ? "uv.exe" : "uv";
  const probe = spawnImplementation(candidate, ["--version"], { stdio: "ignore", encoding: "utf8" });
  return probe.status === 0 ? candidate : null;
}

export async function ensureUv(options: RuntimeOptions = {}): Promise<string> {
  const env = options.env || process.env;
  const layout = ensureManagedRuntimeLayout(options);

  if (env.MINIPROGRAM_MINIUM_CLI_USE_SYSTEM_UV === "1") {
    const systemUv = findSystemUv(options);
    if (systemUv) {
      return systemUv;
    }
  }

  if (fs.existsSync(layout.managedUvBinary)) {
    return layout.managedUvBinary;
  }

  let installPromise = managedUvInstallPromises.get(layout.managedUvBinary);
  if (!installPromise) {
    installPromise = installManagedUvBinary(layout, options).finally(() => {
      managedUvInstallPromises.delete(layout.managedUvBinary);
    });
    managedUvInstallPromises.set(layout.managedUvBinary, installPromise);
  }

  await installPromise;
  if (!fs.existsSync(layout.managedUvBinary)) {
    throw new RuntimeLaunchError("uv installation finished but no executable was found.", {
      target: layout.managedUvBinary,
    });
  }
  return layout.managedUvBinary;
}

async function installManagedUvBinary(layout: RuntimeLayout, options: RuntimeOptions = {}): Promise<void> {
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "minium-cli-uv-"));
  const { archiveExt, triple } = getUvTarget(options);
  const archivePath = path.join(tmpDir, `uv.${archiveExt}`);
  const extractDir = path.join(tmpDir, "extract");
  const installUrl = buildUvDownloadUrl(triple, archiveExt, options.env || process.env);

  try {
    fs.mkdirSync(extractDir, { recursive: true });
    await (options.downloadImplementation || downloadFile)(installUrl, archivePath);
    (options.extractArchiveImplementation || extractArchive)(archivePath, extractDir, archiveExt, options);
    const extractedRoot = path.join(extractDir, `uv-${triple}`);
    const uvSource = path.join(extractedRoot, process.platform === "win32" ? "uv.exe" : "uv");
    const uvxSource = path.join(extractedRoot, process.platform === "win32" ? "uvx.exe" : "uvx");

    await installBinaryAtomically(uvSource, layout.managedUvBinary);
    if (fs.existsSync(uvxSource)) {
      const uvxTarget = path.join(layout.uvInstallDir, process.platform === "win32" ? "uvx.exe" : "uvx");
      await installBinaryAtomically(uvxSource, uvxTarget);
    }
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  }
}

async function installBinaryAtomically(sourcePath: string, targetPath: string): Promise<void> {
  const stagedTarget = `${targetPath}.${process.pid}.${Date.now()}.tmp`;

  try {
    await fsp.copyFile(sourcePath, stagedTarget);
    if (process.platform !== "win32") {
      await fsp.chmod(stagedTarget, 0o755);
    }
    await fsp.rename(stagedTarget, targetPath);
  } catch (error) {
    await fsp.rm(stagedTarget, { force: true }).catch(() => undefined);
    throw error;
  }
}

export function getUvTarget(options: RuntimeOptions = {}): { triple: string; archiveExt: "tar.gz" | "zip" } {
  const platform = options.platform || process.platform;
  const arch = options.arch || process.arch;
  if (platform === "darwin" && arch === "arm64") {
    return { triple: "aarch64-apple-darwin", archiveExt: "tar.gz" };
  }
  if (platform === "darwin" && arch === "x64") {
    return { triple: "x86_64-apple-darwin", archiveExt: "tar.gz" };
  }
  if (platform === "linux" && arch === "arm64") {
    return { triple: "aarch64-unknown-linux-gnu", archiveExt: "tar.gz" };
  }
  if (platform === "linux" && arch === "x64") {
    return { triple: "x86_64-unknown-linux-gnu", archiveExt: "tar.gz" };
  }
  if (platform === "win32" && arch === "arm64") {
    return { triple: "aarch64-pc-windows-msvc", archiveExt: "zip" };
  }
  if (platform === "win32" && arch === "x64") {
    return { triple: "x86_64-pc-windows-msvc", archiveExt: "zip" };
  }
  throw new RuntimeLaunchError("Automatic uv provisioning is not supported on this platform yet.", {
    platform,
    arch,
  });
}

export function buildUvDownloadUrl(triple: string, archiveExt: string, env: NodeJS.ProcessEnv = process.env): string {
  const uvVersion = String(env.MINIPROGRAM_MINIUM_CLI_UV_VERSION || "").trim();
  const fileName = `uv-${triple}.${archiveExt}`;
  if (uvVersion) {
    return `https://github.com/astral-sh/uv/releases/download/${uvVersion}/${fileName}`;
  }
  return `https://github.com/astral-sh/uv/releases/latest/download/${fileName}`;
}

export async function downloadFile(url: string, targetPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        response.resume();
        downloadFile(response.headers.location, targetPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Download failed: ${url} -> HTTP ${response.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(targetPath);
      response.pipe(file);
      file.on("finish", () => file.close());
      file.on("close", () => resolve());
      file.on("error", reject);
    });
    request.on("error", reject);
  });
}

export function extractArchive(
  archivePath: string,
  extractDir: string,
  archiveExt: string,
  options: RuntimeOptions = {},
): void {
  if (archiveExt === "tar.gz") {
    runChecked("tar", ["-xzf", archivePath, "-C", extractDir], options);
    return;
  }

  if (archiveExt === "zip") {
    runChecked(
      "powershell",
      [
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `Expand-Archive -Path '${archivePath}' -DestinationPath '${extractDir}' -Force`,
      ],
      options,
    );
    return;
  }

  throw new RuntimeLaunchError(`Unsupported uv archive format: ${archiveExt}`);
}

export function runChecked(command: string, args: string[], options: RuntimeOptions = {}): void {
  const spawnImplementation = options.spawnImplementation || spawnSync;
  const result = spawnImplementation(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new RuntimeLaunchError(`${command} failed to execute.`, {
      command,
      args,
      status: result.status ?? null,
      stderr: normalizeSpawnOutput(result.stderr).trim(),
      stdout: normalizeSpawnOutput(result.stdout).trim(),
    });
  }
}

export async function createRuntimeContext(options: RuntimeOptions = {}): Promise<RuntimeContext> {
  const env = options.env || process.env;
  const layout = ensureManagedRuntimeLayout(options);
  const uvBin = await ensureUv(options);
  const pythonRequest = getRequestedPythonVersion(env);
  return {
    layout,
    uvBin,
    pythonRequest,
    env: buildUvEnv(layout, env),
  };
}

export function buildUvEnv(layout: RuntimeLayout, env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return {
    ...env,
    UV_CACHE_DIR: layout.uvCacheDir,
    UV_PYTHON_INSTALL_DIR: layout.uvPythonInstallDir,
    UV_PROJECT_ENVIRONMENT: layout.uvProjectEnv,
    UV_SYSTEM_CERTS: env.UV_SYSTEM_CERTS || "1",
  };
}

export function buildUvRunArgs(
  layout: Pick<RuntimeLayout, "pythonProjectRoot">,
  pythonRequest: string,
  pythonArgs: string[],
): string[] {
  return [
    "run",
    "--project",
    layout.pythonProjectRoot,
    "--managed-python",
    "--python",
    pythonRequest,
    "python",
    ...pythonArgs,
  ];
}

export async function prepareManagedRuntime(
  options: RuntimeOptions = {},
): Promise<RuntimeContext & { details: ManagedRuntimeDetails }> {
  const context = await createRuntimeContext(options);
  const result = spawnSync(
    context.uvBin,
    buildUvRunArgs(context.layout, context.pythonRequest, [
      "-c",
      [
        "import json",
        "import sys",
        "print(json.dumps({'pythonVersion': sys.version.split()[0], 'executable': sys.executable}))",
      ].join("; "),
    ]),
    {
      cwd: options.cwd || process.cwd(),
      env: context.env,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    },
  );

  if (result.error || result.status !== 0) {
    throw new RuntimeLaunchError("Failed to warm up the managed runtime.", {
      status: result.status ?? null,
      stderr: (result.stderr || "").trim(),
      stdout: (result.stdout || "").trim(),
      uvBin: context.uvBin,
      pythonRequest: context.pythonRequest,
    });
  }

  let details: ManagedRuntimeDetails;
  try {
    details = JSON.parse(normalizeSpawnOutput(result.stdout).trim()) as ManagedRuntimeDetails;
  } catch {
    details = {
      pythonVersion: null,
      executable: null,
      raw: normalizeSpawnOutput(result.stdout).trim(),
    };
  }

  return {
    ...context,
    details,
  };
}

export async function executePlanWithPython(plan: Plan, options: RuntimeOptions = {}): Promise<ExecutePlanResult> {
  const context = await createRuntimeContext(options);
  const request = {
    protocolVersion: PROTOCOL_VERSION,
    command: "execute_plan",
    payload: {
      plan,
    },
  };

  const result = spawnSync(
    context.uvBin,
    buildUvRunArgs(context.layout, context.pythonRequest, ["-m", "miniprogram_minium_cli"]),
    {
      cwd: options.cwd || process.cwd(),
      env: context.env,
      input: `${JSON.stringify(request)}\n`,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    },
  );

  if (result.error) {
    throw new RuntimeLaunchError("Failed to start the Python execution runtime.", {
      cause: result.error.message,
      uvBin: context.uvBin,
    });
  }

  if (result.status !== 0) {
    throw new RuntimeLaunchError("The Python execution runtime returned a non-zero exit code.", {
      status: result.status ?? null,
      stderr: (result.stderr || "").trim(),
      stdout: (result.stdout || "").trim(),
      uvBin: context.uvBin,
      pythonRequest: context.pythonRequest,
    });
  }

  let response: ExecutePlanResponse;
  try {
    response = JSON.parse(normalizeSpawnOutput(result.stdout)) as ExecutePlanResponse;
  } catch (error) {
    throw new RuntimeLaunchError("The Python execution runtime returned a non-JSON response.", {
      stdout: normalizeSpawnOutput(result.stdout).trim(),
      stderr: normalizeSpawnOutput(result.stderr).trim(),
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  if (response.protocolVersion !== PROTOCOL_VERSION) {
    throw new RuntimeLaunchError("The Python execution runtime protocol version does not match.", {
      expected: PROTOCOL_VERSION,
      actual: response.protocolVersion,
    });
  }

  return {
    runtime: {
      uvBin: context.uvBin,
      pythonRequest: context.pythonRequest,
      layout: context.layout,
    },
    response,
  };
}
