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
