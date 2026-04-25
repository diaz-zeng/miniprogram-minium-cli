# Plan Execution

Use this reference when the task is to execute a plan with `miniprogram-minium-cli`.

## File-based execution

```bash
miniprogram-minium-cli exec --plan ./path/to/plan.json
```

## Inline JSON execution

```bash
miniprogram-minium-cli exec --plan-json '{"version":1,"kind":"miniapp-test-plan", ... }'
```

## Choosing `--json`

Use plain `exec` by default when the run artifacts on disk are enough for the task.

- Prefer no `--json` when you only need to know whether the run passed, which step failed, or which run directory to inspect next.
- If the CLI outcome already matches the expected validation result, stop there instead of reading persisted files by default.
- If the CLI outcome is unexpected, read `summary.json`, `result.json`, `comparison.json`, `network.json`, or screenshots from the run directory incrementally instead of asking the CLI to print the full structured payload inline.
- Add `--json` only when the current caller must parse the structured execution result directly from stdout in the same shell invocation.

### Required

Use `--json` when:

- another script, agent, or CI step must parse the result directly from stdout in the same invocation
- the current command must immediately return fields such as `ok`, `summary.status`, `error.error_code`, `artifacts`, or `stepResults` without a second read from the run directory

### Recommended

Use `--json` when:

- you are validating the CLI's structured stdout behavior itself
- stdout is the machine-to-machine integration surface of the current workflow

### Usually avoid

Do not add `--json` by default when:

- the task only needs a pass or fail conclusion
- the observed outcome already matches the expectation
- the same facts can be read later from persisted run artifacts with lower token cost

## Bridge-backed execution example

```bash
miniprogram-minium-cli exec --plan ./examples/demo-regression/09-bridge-high-priority.exact.plan.json
```

Use the bundled bridge-focused plans when you need a known-good starting point for storage, navigation, app context, settings, clipboard, feedback UI, location, media, file, device, auth, or subscription APIs.

## Network execution examples

```bash
miniprogram-minium-cli exec --plan ./examples/demo-regression/12-network-observation.placeholder.plan.json
```

Use the placeholder network plans as fast synthetic baselines for request observation, filtered assertions, failure injection, mocked responses, or upload/download evidence. For real DevTools network acceptance, start the local fixture server and run `examples/demo-regression/15-network-local-server.real.plan.json`.

## Common overrides

```bash
miniprogram-minium-cli exec \
  --plan ./path/to/plan.json \
  --project-path ./examples/demo-miniapp \
  --wechat-devtool-path /path/to/wechat-devtools-cli \
  --runtime-mode real \
  --auto-screenshot always
```

## Structured result mode

```bash
miniprogram-minium-cli exec --plan ./path/to/plan.json --json
```

Use this mode only when the structured stdout payload is required immediately by the current caller. When the same facts can be read from persisted run artifacts, prefer plain `exec` to keep terminal output and token usage small.

## Guardrails

- Use `exec` for structured plans only.
- Do not turn the CLI into an ad hoc command runner.
- Prefer documented overrides over editing plan meaning through unsupported flags.
- Keep bridge-backed API usage inside the documented step types instead of inventing raw method calls.
- Keep network observation and interception inside the documented `network.*` and `assert.network*` step types instead of inventing custom runtime glue.
- When restricted bridge steps depend on a developer-owned AppID, expect `touristappid` runs to skip those steps rather than fail product validation.
- If the task can continue from run artifacts, do not spend extra context on `--json` output by default.
- If the CLI already proved the expected outcome, do not read run artifacts unless the caller asks for deeper evidence.
