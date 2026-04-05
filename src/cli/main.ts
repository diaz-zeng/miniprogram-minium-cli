import * as path from "node:path";

import { resolveCliLanguage, t, type CliLanguage } from "../i18n";
import {
  AUTO_SCREENSHOT_MODES,
  loadPlanFromFile,
  loadPlanFromJson,
  PlanValidationError,
  type Plan,
  type AutoScreenshotMode,
} from "../plan";
import {
  executePlanWithPython,
  prepareManagedRuntime,
  RuntimeLaunchError,
  type ExecutePlanResponse,
} from "../runtime";
import { installBundledSkills, SkillInstallError } from "../skills";

export interface CliIo {
  stdout: { write(chunk: string): void };
  stderr: { write(chunk: string): void };
}

interface ExecOptions {
  planPath?: string;
  planJson?: string;
  json: boolean;
  projectPath?: string;
  artifactsDir?: string;
  wechatDevtoolPath?: string;
  testPort?: string;
  autoScreenshot?: AutoScreenshotMode;
  runtimeMode?: string;
}

interface PrepareRuntimeOptions {
  json: boolean;
}

interface InstallOptions {
  skills: boolean;
  path?: string;
  json: boolean;
}

type ParsedArgv =
  | { command: "help"; options: Record<string, never> }
  | { command: "exec"; options: ExecOptions }
  | { command: "prepare-runtime"; options: PrepareRuntimeOptions }
  | { command: "install"; options: InstallOptions };

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

function getDefaultLanguage(): CliLanguage {
  return resolveCliLanguage();
}

export function parseArgv(argv: string[]): ParsedArgv {
  const args = [...argv];
  const command = args.shift();

  if (!command || command === "help" || command === "--help" || command === "-h") {
    return { command: "help", options: {} };
  }

  if (command === "exec") {
    const options: Partial<ExecOptions> = {
      json: false,
    };
    while (args.length > 0) {
      const token = args.shift() as string;
      switch (token) {
        case "--plan":
          options.planPath = shiftRequiredValue(args, token);
          break;
        case "--plan-json":
          options.planJson = shiftRequiredValue(args, token);
          break;
        case "--project-path":
          options.projectPath = shiftRequiredValue(args, token);
          break;
        case "--artifacts-dir":
          options.artifactsDir = shiftRequiredValue(args, token);
          break;
        case "--wechat-devtool-path":
          options.wechatDevtoolPath = shiftRequiredValue(args, token);
          break;
        case "--test-port":
          options.testPort = shiftRequiredValue(args, token);
          break;
        case "--auto-screenshot":
          options.autoScreenshot = parseAutoScreenshotMode(shiftRequiredValue(args, token));
          break;
        case "--runtime-mode":
          options.runtimeMode = shiftRequiredValue(args, token);
          break;
        case "--json":
          options.json = true;
          break;
        default:
          throw new CliUsageError(t(getDefaultLanguage(), "cli.unknownArgument", { token }));
      }
    }
    if (!options.planPath && !options.planJson) {
      throw new CliUsageError(t(getDefaultLanguage(), "cli.execPlanRequired"));
    }
    if (options.planPath && options.planJson) {
      throw new CliUsageError(t(getDefaultLanguage(), "cli.execPlanMutuallyExclusive"));
    }
    return {
      command,
      options: options as ExecOptions,
    };
  }

  if (command === "prepare-runtime") {
    const options: PrepareRuntimeOptions = {
      json: false,
    };
    while (args.length > 0) {
      const token = args.shift() as string;
      switch (token) {
        case "--json":
          options.json = true;
          break;
        default:
          throw new CliUsageError(t(getDefaultLanguage(), "cli.unknownArgument", { token }));
      }
    }
    return {
      command,
      options,
    };
  }

  if (command === "install") {
    const options: InstallOptions = {
      skills: false,
      json: false,
    };
    while (args.length > 0) {
      const token = args.shift() as string;
      switch (token) {
        case "--skills":
          options.skills = true;
          break;
        case "--path":
          options.path = shiftRequiredValue(args, token);
          break;
        case "--json":
          options.json = true;
          break;
        default:
          throw new CliUsageError(t(getDefaultLanguage(), "cli.unknownArgument", { token }));
      }
    }
    if (!options.skills) {
      throw new CliUsageError(t(getDefaultLanguage(), "cli.installSkillsRequired"));
    }
    return {
      command,
      options,
    };
  }

  throw new CliUsageError(t(getDefaultLanguage(), "cli.unknownCommand", { command }));
}

function shiftRequiredValue(args: string[], flagName: string): string {
  const value = args.shift();
  if (!value || value.startsWith("--")) {
    throw new CliUsageError(t(getDefaultLanguage(), "cli.flagValueRequired", { flag: flagName }));
  }
  return value;
}

function parseAutoScreenshotMode(raw: string): AutoScreenshotMode {
  const normalized = String(raw).trim().toLowerCase() as AutoScreenshotMode;
  if (!AUTO_SCREENSHOT_MODES.includes(normalized)) {
    throw new CliUsageError(t(getDefaultLanguage(), "cli.autoScreenshotModeInvalid", { mode: raw }));
  }
  return normalized;
}

export function formatHelp(language: CliLanguage = getDefaultLanguage()): string {
  return [
    t(language, "help.title"),
    "",
    t(language, "help.usage"),
    "  miniprogram-minium-cli exec (--plan <file> | --plan-json <json>) [--project-path <path>] [--wechat-devtool-path <path>] [--runtime-mode <mode>] [--auto-screenshot <mode>] [--json]",
    "  miniprogram-minium-cli prepare-runtime [--json]",
    "  miniprogram-minium-cli install --skills [--path <path>] [--json]",
    "",
    t(language, "help.commands"),
    `  exec            ${t(language, "help.exec")}`,
    `  prepare-runtime ${t(language, "help.prepareRuntime")}`,
    `  install         ${t(language, "help.install")}`,
  ].join("\n");
}

export async function main(
  argv: string[],
  io: CliIo = { stdout: process.stdout, stderr: process.stderr },
): Promise<number> {
  try {
    const language = getDefaultLanguage();
    const parsed = parseArgv(argv);
    if (parsed.command === "help") {
      io.stdout.write(`${formatHelp(language)}\n`);
      return 0;
    }

    if (parsed.command === "exec") {
      return handleExec(parsed.options, io);
    }
    if (parsed.command === "prepare-runtime") {
      return handlePrepareRuntime(parsed.options, io);
    }
    if (parsed.command === "install") {
      return handleInstall(parsed.options, io);
    }
    throw new CliUsageError(
      t(language, "cli.unknownCommand", { command: String((parsed as { command: string }).command) }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof PlanValidationError && error.details.length > 0) {
      io.stderr.write(`${message}\n- ${error.details.join("\n- ")}\n`);
      return 3;
    }
    if (error instanceof CliUsageError) {
      io.stderr.write(`${message}\n\n${formatHelp()}\n`);
      return 2;
    }
    if (error instanceof RuntimeLaunchError) {
      io.stderr.write(`${message}\n`);
      if (error.details && Object.keys(error.details).length > 0) {
        io.stderr.write(`${JSON.stringify(error.details, null, 2)}\n`);
      }
      return 4;
    }
    if (error instanceof SkillInstallError) {
      io.stderr.write(`${message}\n`);
      return 4;
    }
    throw error;
  }
}

async function handleExec(options: ExecOptions, io: CliIo): Promise<number> {
  const loaded = options.planPath
    ? loadPlanFromFile(options.planPath)
    : loadPlanFromJson(String(options.planJson), { baseDir: process.cwd() });
  return executeAndReport(applyExecOverrides(loaded.plan, options), io, options.json);
}

function applyExecOverrides(plan: Plan, options: ExecOptions): Plan {
  const environment = { ...plan.environment };

  if (options.projectPath) {
    environment.projectPath = path.resolve(options.projectPath);
  }
  if (options.artifactsDir) {
    environment.artifactsDir = path.resolve(options.artifactsDir);
  }
  if (options.wechatDevtoolPath) {
    environment.wechatDevtoolPath = path.resolve(options.wechatDevtoolPath);
  }
  if (options.testPort) {
    environment.testPort = Number(options.testPort);
  }
  if (options.runtimeMode) {
    environment.runtimeMode = options.runtimeMode;
  }
  if (options.autoScreenshot) {
    environment.autoScreenshot = options.autoScreenshot;
  }

  const steps = plan.steps.map((step) => {
    if (step.type !== "session.start" || !options.projectPath) {
      return step;
    }
    return {
      ...step,
      input: {
        ...step.input,
        projectPath: path.resolve(options.projectPath),
      },
    };
  });

  return {
    ...plan,
    environment,
    steps,
  };
}

async function handlePrepareRuntime(options: PrepareRuntimeOptions, io: CliIo): Promise<number> {
  const prepared = await prepareManagedRuntime();
  const language = getDefaultLanguage();
  if (options.json) {
    io.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          uvBin: prepared.uvBin,
          pythonRequest: prepared.pythonRequest,
          details: prepared.details,
          cacheBaseDir: prepared.layout.cacheBaseDir,
        },
        null,
        2,
      )}\n`,
    );
  } else {
    io.stdout.write(`${t(language, "cli.runtimeWarmupCompleted")}\n`);
    io.stdout.write(`${t(language, "cli.runtimeUv", { path: prepared.uvBin })}\n`);
    io.stdout.write(`${t(language, "cli.runtimeRequestedPython", { version: prepared.pythonRequest })}\n`);
    if (prepared.details?.pythonVersion) {
      io.stdout.write(`${t(language, "cli.runtimeResolvedPython", { version: prepared.details.pythonVersion })}\n`);
    }
    if (prepared.details?.executable) {
      io.stdout.write(`${t(language, "cli.runtimeInterpreterPath", { path: prepared.details.executable })}\n`);
    }
  }
  return 0;
}

async function handleInstall(options: InstallOptions, io: CliIo): Promise<number> {
  const language = getDefaultLanguage();
  const installed = await installBundledSkills({
    targetRoot: options.path,
  });
  if (installed.installed.length === 0) {
    throw new SkillInstallError(t(language, "cli.noBundledSkills"));
  }

  if (options.json) {
    io.stdout.write(`${JSON.stringify({ ok: true, ...installed }, null, 2)}\n`);
    return 0;
  }

  io.stdout.write(`${t(language, "cli.installCompleted")}\n`);
  io.stdout.write(`${t(language, "cli.installTargetRoot", { path: installed.targetRoot })}\n`);
  for (const skill of installed.installed) {
    io.stdout.write(`${t(language, "cli.installSkill", { name: skill.name, path: skill.targetDir })}\n`);
  }
  return 0;
}

async function executeAndReport(plan: Plan, io: CliIo, jsonMode: boolean): Promise<number> {
  const execution = await executePlanWithPython(plan);
  const exitCode = deriveExecutionExitCode(execution.response);
  const language = resolveCliLanguage(plan.environment.language);
  if (jsonMode) {
    io.stdout.write(`${JSON.stringify(execution.response, null, 2)}\n`);
  } else {
    const response = execution.response as ExecutePlanResponse;
    const summary = (response.result?.summary ?? {}) as Record<string, unknown>;
    const artifacts = (response.result?.artifacts ?? {}) as Record<string, unknown>;
    io.stdout.write(`${t(language, "cli.runId", { runId: String(summary.runId || "unknown") })}\n`);
    io.stdout.write(
      `${t(language, "cli.statusLine", {
        status: String(summary.status || "unknown"),
        passed: String(summary.successCount ?? 0),
        failed: String(summary.failedCount ?? 0),
        skipped: String(summary.skippedCount ?? 0),
      })}\n`,
    );
    io.stdout.write(
      `${t(language, "cli.stepsDuration", {
        steps: String(summary.stepCount ?? 0),
        duration: String(summary.durationMs ?? 0),
      })}\n`,
    );
    if (typeof artifacts.runDir === "string") {
      io.stdout.write(`${t(language, "cli.artifacts", { path: artifacts.runDir })}\n`);
    }
    if (Array.isArray(artifacts.screenshotPaths)) {
      io.stdout.write(`${t(language, "cli.screenshots", { count: String(artifacts.screenshotPaths.length) })}\n`);
    }
    if (typeof artifacts.summaryPath === "string") {
      io.stdout.write(`${t(language, "cli.summary", { path: artifacts.summaryPath })}\n`);
    }
    if (typeof artifacts.resultPath === "string") {
      io.stdout.write(`${t(language, "cli.result", { path: artifacts.resultPath })}\n`);
    }
    if (typeof artifacts.comparisonPath === "string") {
      io.stdout.write(`${t(language, "cli.comparison", { path: artifacts.comparisonPath })}\n`);
    }
    const failure = summary.failure;
    if (failure && typeof failure === "object") {
      const typedFailure = failure as Record<string, unknown>;
      io.stdout.write(`${t(language, "cli.failure", {
        code: String(typedFailure.error_code || "UNKNOWN"),
        message: String(typedFailure.message || "Unknown error"),
      })}\n`);
    }
  }
  return exitCode;
}

export function deriveExecutionExitCode(response: ExecutePlanResponse): number {
  if (!response.ok) {
    const error = (response.error ?? {}) as Record<string, unknown>;
    switch (error.error_code) {
      case "ACTION_ERROR":
      case "ASSERTION_FAILED":
        return 1;
      case "ENVIRONMENT_ERROR":
      case "SESSION_ERROR":
        return 2;
      case "PLAN_ERROR":
        return 3;
      default:
        return 4;
    }
  }

  const summary = (response.result?.summary ?? {}) as Record<string, unknown>;
  if (summary.status === "passed") {
    return 0;
  }
  if (summary.status === "failed") {
    return 1;
  }
  return 4;
}
