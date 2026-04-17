export type CliLanguage = "en-US" | "zh-CN";

type MessageKey =
  | "help.title"
  | "help.usage"
  | "help.commands"
  | "help.exec"
  | "help.prepareRuntime"
  | "help.install"
  | "cli.unknownArgument"
  | "cli.unknownCommand"
  | "cli.execPlanRequired"
  | "cli.execPlanMutuallyExclusive"
  | "cli.installSkillsRequired"
  | "cli.flagValueRequired"
  | "cli.autoScreenshotModeInvalid"
  | "cli.runtimeWarmupCompleted"
  | "cli.runtimeUv"
  | "cli.runtimeRequestedPython"
  | "cli.runtimeResolvedPython"
  | "cli.runtimeInterpreterPath"
  | "cli.installCompleted"
  | "cli.installTargetRoot"
  | "cli.installSkill"
  | "cli.runId"
  | "cli.statusLine"
  | "cli.stepsDuration"
  | "cli.artifacts"
  | "cli.screenshots"
  | "cli.summary"
  | "cli.result"
  | "cli.comparison"
  | "cli.networkSummary"
  | "cli.networkArtifact"
  | "cli.failure"
  | "cli.noBundledSkills";

const messages: Record<CliLanguage, Record<MessageKey, string>> = {
  "en-US": {
    "help.title": "miniprogram-minium-cli",
    "help.usage": "Usage:",
    "help.commands": "Commands:",
    "help.exec": "Execute a structured plan file or an inline JSON plan string.",
    "help.prepareRuntime": "Warm up uv, the managed Python runtime, and the project environment.",
    "help.install": "Install bundled skills into the default local skills directory or a custom path for other coding agents.",
    "cli.unknownArgument": "Unknown argument: {token}",
    "cli.unknownCommand": "Unknown command: {command}",
    "cli.execPlanRequired": "`exec` requires either `--plan <file>` or `--plan-json <json>`.",
    "cli.execPlanMutuallyExclusive": "`--plan` and `--plan-json` cannot be used together.",
    "cli.installSkillsRequired": "`install` currently requires `--skills`.",
    "cli.flagValueRequired": "{flag} requires a value.",
    "cli.autoScreenshotModeInvalid": "Unsupported auto screenshot mode: {mode}. Use off, on-success, or always.",
    "cli.runtimeWarmupCompleted": "Runtime warm-up completed.",
    "cli.runtimeUv": "uv: {path}",
    "cli.runtimeRequestedPython": "Requested Python version: {version}",
    "cli.runtimeResolvedPython": "Resolved Python version: {version}",
    "cli.runtimeInterpreterPath": "Interpreter path: {path}",
    "cli.installCompleted": "Bundled skills installed.",
    "cli.installTargetRoot": "Target skills directory: {path}",
    "cli.installSkill": "Installed skill: {name} -> {path}",
    "cli.runId": "Run ID: {runId}",
    "cli.statusLine": "Status: {status} | passed: {passed} | failed: {failed} | skipped: {skipped}",
    "cli.stepsDuration": "Steps: {steps} | duration: {duration}ms",
    "cli.artifacts": "Artifacts: {path}",
    "cli.screenshots": "Screenshots: {count}",
    "cli.summary": "Summary: {path}",
    "cli.result": "Result: {path}",
    "cli.comparison": "Comparison: {path}",
    "cli.networkSummary": "Network: {events} events across {sessions} sessions",
    "cli.networkArtifact": "Network log: {path}",
    "cli.failure": "Failure: {code} - {message}",
    "cli.noBundledSkills": "No bundled skills are available in this package.",
  },
  "zh-CN": {
    "help.title": "miniprogram-minium-cli",
    "help.usage": "用法：",
    "help.commands": "命令：",
    "help.exec": "执行结构化计划文件，或直接执行内联 JSON 计划字符串。",
    "help.prepareRuntime": "预热 uv、托管 Python 运行时和项目环境。",
    "help.install": "将随包附带的 skills 安装到默认本地 skills 目录，或通过自定义路径提供给其他 coding agent。",
    "cli.unknownArgument": "未知参数：{token}",
    "cli.unknownCommand": "未知命令：{command}",
    "cli.execPlanRequired": "`exec` 需要 `--plan <file>` 或 `--plan-json <json>` 之一。",
    "cli.execPlanMutuallyExclusive": "`--plan` 和 `--plan-json` 不能同时使用。",
    "cli.installSkillsRequired": "`install` 当前需要显式提供 `--skills`。",
    "cli.flagValueRequired": "{flag} 需要提供取值。",
    "cli.autoScreenshotModeInvalid": "不支持的自动截图模式：{mode}。可选值为 off、on-success 或 always。",
    "cli.runtimeWarmupCompleted": "运行时预热完成。",
    "cli.runtimeUv": "uv：{path}",
    "cli.runtimeRequestedPython": "请求的 Python 版本：{version}",
    "cli.runtimeResolvedPython": "实际解析的 Python 版本：{version}",
    "cli.runtimeInterpreterPath": "解释器路径：{path}",
    "cli.installCompleted": "随包 skill 安装完成。",
    "cli.installTargetRoot": "目标 skills 目录：{path}",
    "cli.installSkill": "已安装 skill：{name} -> {path}",
    "cli.runId": "运行 ID：{runId}",
    "cli.statusLine": "状态：{status} | 成功：{passed} | 失败：{failed} | 跳过：{skipped}",
    "cli.stepsDuration": "步骤：{steps} | 耗时：{duration}ms",
    "cli.artifacts": "产物目录：{path}",
    "cli.screenshots": "截图数量：{count}",
    "cli.summary": "摘要文件：{path}",
    "cli.result": "结果文件：{path}",
    "cli.comparison": "对比文件：{path}",
    "cli.networkSummary": "网络摘要：{events} 个事件，覆盖 {sessions} 个会话",
    "cli.networkArtifact": "网络日志：{path}",
    "cli.failure": "失败：{code} - {message}",
    "cli.noBundledSkills": "当前包中没有可安装的随包 skill。",
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
