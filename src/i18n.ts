export type CliLanguage = "en-US" | "zh-CN";

type MessageKey =
  | "help.title"
  | "help.usage"
  | "help.commands"
  | "help.exec"
  | "help.prepareRuntime"
  | "cli.unknownArgument"
  | "cli.unknownCommand"
  | "cli.execPlanRequired"
  | "cli.execPlanMutuallyExclusive"
  | "cli.flagValueRequired"
  | "cli.autoScreenshotModeInvalid"
  | "cli.runtimeWarmupCompleted"
  | "cli.runtimeUv"
  | "cli.runtimeRequestedPython"
  | "cli.runtimeResolvedPython"
  | "cli.runtimeInterpreterPath"
  | "cli.runId"
  | "cli.statusLine"
  | "cli.stepsDuration"
  | "cli.artifacts"
  | "cli.screenshots"
  | "cli.summary"
  | "cli.result"
  | "cli.comparison"
  | "cli.failure";

const messages: Record<CliLanguage, Record<MessageKey, string>> = {
  "en-US": {
    "help.title": "miniprogram-minium-cli",
    "help.usage": "Usage:",
    "help.commands": "Commands:",
    "help.exec": "Execute a structured plan file or an inline JSON plan string.",
    "help.prepareRuntime": "Warm up uv, the managed Python runtime, and the project environment.",
    "cli.unknownArgument": "Unknown argument: {token}",
    "cli.unknownCommand": "Unknown command: {command}",
    "cli.execPlanRequired": "`exec` requires either `--plan <file>` or `--plan-json <json>`.",
    "cli.execPlanMutuallyExclusive": "`--plan` and `--plan-json` cannot be used together.",
    "cli.flagValueRequired": "{flag} requires a value.",
    "cli.autoScreenshotModeInvalid": "Unsupported auto screenshot mode: {mode}. Use off, on-success, or always.",
    "cli.runtimeWarmupCompleted": "Runtime warm-up completed.",
    "cli.runtimeUv": "uv: {path}",
    "cli.runtimeRequestedPython": "Requested Python version: {version}",
    "cli.runtimeResolvedPython": "Resolved Python version: {version}",
    "cli.runtimeInterpreterPath": "Interpreter path: {path}",
    "cli.runId": "Run ID: {runId}",
    "cli.statusLine": "Status: {status} | passed: {passed} | failed: {failed} | skipped: {skipped}",
    "cli.stepsDuration": "Steps: {steps} | duration: {duration}ms",
    "cli.artifacts": "Artifacts: {path}",
    "cli.screenshots": "Screenshots: {count}",
    "cli.summary": "Summary: {path}",
    "cli.result": "Result: {path}",
    "cli.comparison": "Comparison: {path}",
    "cli.failure": "Failure: {code} - {message}",
  },
  "zh-CN": {
    "help.title": "miniprogram-minium-cli",
    "help.usage": "用法：",
    "help.commands": "命令：",
    "help.exec": "执行结构化计划文件，或直接执行内联 JSON 计划字符串。",
    "help.prepareRuntime": "预热 uv、托管 Python 运行时和项目环境。",
    "cli.unknownArgument": "未知参数：{token}",
    "cli.unknownCommand": "未知命令：{command}",
    "cli.execPlanRequired": "`exec` 需要 `--plan <file>` 或 `--plan-json <json>` 之一。",
    "cli.execPlanMutuallyExclusive": "`--plan` 和 `--plan-json` 不能同时使用。",
    "cli.flagValueRequired": "{flag} 需要提供取值。",
    "cli.autoScreenshotModeInvalid": "不支持的自动截图模式：{mode}。可选值为 off、on-success 或 always。",
    "cli.runtimeWarmupCompleted": "运行时预热完成。",
    "cli.runtimeUv": "uv：{path}",
    "cli.runtimeRequestedPython": "请求的 Python 版本：{version}",
    "cli.runtimeResolvedPython": "实际解析的 Python 版本：{version}",
    "cli.runtimeInterpreterPath": "解释器路径：{path}",
    "cli.runId": "运行 ID：{runId}",
    "cli.statusLine": "状态：{status} | 成功：{passed} | 失败：{failed} | 跳过：{skipped}",
    "cli.stepsDuration": "步骤：{steps} | 耗时：{duration}ms",
    "cli.artifacts": "产物目录：{path}",
    "cli.screenshots": "截图数量：{count}",
    "cli.summary": "摘要文件：{path}",
    "cli.result": "结果文件：{path}",
    "cli.comparison": "对比文件：{path}",
    "cli.failure": "失败：{code} - {message}",
  },
};

export function resolveCliLanguage(input?: string | null, env: NodeJS.ProcessEnv = process.env): CliLanguage {
  const candidate = String(input || env.MINIPROGRAM_MINIUM_CLI_LANGUAGE || "en-US").trim().toLowerCase();
  return candidate.startsWith("zh") ? "zh-CN" : "en-US";
}

export function t(language: CliLanguage, key: MessageKey, params: Record<string, string | number> = {}): string {
  const template = messages[language][key];
  return template.replace(/\{(\w+)\}/g, (_match, token: string) => String(params[token] ?? ""));
}
