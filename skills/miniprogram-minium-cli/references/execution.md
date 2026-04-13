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

## Bridge-backed execution example

```bash
miniprogram-minium-cli exec --plan ./examples/demo-regression/09-bridge-high-priority.exact.plan.json --json
```

Use the bundled bridge-focused plans when you need a known-good starting point for storage, navigation, app context, settings, clipboard, feedback UI, location, media, file, device, auth, or subscription APIs.

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

## Guardrails

- Use `exec` for structured plans only.
- Do not turn the CLI into an ad hoc command runner.
- Prefer documented overrides over editing plan meaning through unsupported flags.
- Keep bridge-backed API usage inside the documented step types instead of inventing raw method calls.
- When restricted bridge steps depend on a developer-owned AppID, expect `touristappid` runs to skip those steps rather than fail product validation.
