# Demo Regression Plans

These plans target the in-repository TaroJS demo miniapp at [../demo-miniapp](../demo-miniapp).

## Before You Run

1. Build the demo miniapp:

```bash
cd examples/demo-miniapp
npm install
npm run build:weapp
```

2. Run plans from the repository root and provide the WeChat DevTools CLI path:

```bash
miniprogram-minium-cli exec \
  --plan ./examples/demo-regression/01-login-to-home.exact.plan.json \
  --wechat-devtool-path /path/to/wechat-devtools-cli
```

The bundled plans use:

- relative `projectPath`, resolved from the plan file directory
- `runtimeMode: "auto"` so the same plan can be inspected without hardcoding a machine-specific DevTools path
- a mix of exact and fuzzy selectors to cover both deterministic regression baselines and agent-friendly text matching

If you want screenshots to be collected automatically during regression runs, add `--auto-screenshot on-success` or `--auto-screenshot always` to the `exec` command.

## Plan Set

- `01-login-to-home.exact.plan.json`: exact login flow
- `02-home-practice-save.mixed.plan.json`: exact modal save plus fuzzy wait
- `03-home-search.fuzzy.plan.json`: fuzzy search text verification
- `04-gesture-tap.exact.plan.json`: exact tap gesture verification
- `05-gesture-two-finger.exact.plan.json`: hold-to-drag plus simultaneous marker placement with exact assertions
- `06-cursor-marker-flow.mixed.plan.json`: hold-to-drag plus two marker drops with explicit screenshot checkpoints
- `07-review-board.mixed.plan.json`: review board filter toggle plus before-and-after zoom screenshots around the reference beacon
- `08-assertion-failure.exact.plan.json`: failure forensics baseline
