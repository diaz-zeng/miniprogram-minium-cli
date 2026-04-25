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

Bridge-heavy examples:

- `examples/demo-regression/09-bridge-high-priority.exact.plan.json`
- `examples/demo-regression/10-bridge-medium.placeholder.plan.json`
- `examples/demo-regression/11-bridge-tourist-skip.exact.plan.json`

Network-focused examples:

- `examples/demo-regression/12-network-observation.placeholder.plan.json` for synthetic placeholder observation checks
- `examples/demo-regression/13-network-failure.placeholder.plan.json`
- `examples/demo-regression/14-network-transfer.placeholder.plan.json`
- `examples/demo-regression/15-network-local-server.real.plan.json` for real DevTools request, upload, and download acceptance

## Core rules

- Use documented top-level fields only.
- Keep `kind` aligned with the supported plan kind.
- Provide exactly one execution input mode at runtime:
  - `--plan <file>`
  - `--plan-json <json>`
- Preserve supported step types only; do not invent planner-only or shell-only steps.
- Distinguish between session/artifact steps, UI steps, bridge-backed steps, and assertion steps.
- Treat network steps as first-class structured plan steps instead of embedding request logic in ad hoc scripts.
- For bridge-backed steps, use the documented step families and input shapes from `docs/API_REFERENCE.md`.
- For network steps, prefer a shared matcher shape so listening, waiting, asserting, and interception all describe the same request in the same way.
- When a bridge step needs a developer-owned AppID, set `requiresDeveloperAppId: true` and include `skipReason`.

## Helpful workflow

1. Start from a documented example plan when possible.
2. Keep relative paths consistent with the selected input mode.
3. Use bridge-backed steps for direct miniapp capability calls instead of inventing raw `wx` methods.
4. Validate that `metadata.draft` is runnable before execution.
5. If a field or step is undocumented, stop and confirm against the repository docs.

For bridge-backed plans, also read [bridge-actions.md](bridge-actions.md).
