# Plan Authoring and Validation

Use this reference when the task is to draft, validate, or adjust a structured plan for `miniprogram-minium-cli`.

## Canonical sources

- `README.md`
- `docs/API_REFERENCE.md`
- `docs/API_REFERENCE.zh-CN.md`
- `examples/`

Helpful examples:

- `examples/placeholder-login.plan.json`
- `examples/demo-regression/*.plan.json`

## Core rules

- Use documented top-level fields only.
- Keep `kind` aligned with the supported plan kind.
- Provide exactly one execution input mode at runtime:
  - `--plan <file>`
  - `--plan-json <json>`
- Preserve supported step types only; do not invent planner-only or shell-only steps.

## Helpful workflow

1. Start from a documented example plan when possible.
2. Keep relative paths consistent with the selected input mode.
3. Validate that `metadata.draft` is runnable before execution.
4. If a field or step is undocumented, stop and confirm against the repository docs.
