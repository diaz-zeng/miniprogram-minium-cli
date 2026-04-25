# Demo Regression Plans

These plans target the in-repository TaroJS demo miniapp at [../demo-miniapp](../demo-miniapp).

## Before You Run

1. Build the demo miniapp:

```bash
cd examples/demo-miniapp
pnpm install
pnpm run build:weapp
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

The local-network plan also needs the fixture server to be running before execution:

```bash
node examples/demo-regression/network-fixture-server.mjs --port 9781
```

The demo miniapp disables DevTools URL checks through `project.config.json` so `15-network-local-server.real.plan.json` can exercise real `wx.request`, `wx.uploadFile`, and `wx.downloadFile` calls against `http://127.0.0.1:9781`.

Use the placeholder network plans as fast synthetic baselines. They validate listener, wait, assertion, failure, mock, and artifact logic without depending on DevTools, local ports, or external network state. Use `15-network-local-server.real.plan.json` as the real-runtime network acceptance plan.

Bridge-focused plans intentionally add one exception:

- `10-bridge-medium.placeholder.plan.json` uses `runtimeMode: "placeholder"` because those APIs depend on permissions, upload domains, camera containers, or other host conditions that the demo miniapp does not own

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
- `09-bridge-high-priority.exact.plan.json`: high-priority bridge actions for storage, navigation, app context, settings, clipboard, and feedback UI
- `10-bridge-medium.placeholder.plan.json`: placeholder-safe medium-priority bridge actions for location open, media, file, device, and auth flows
- `11-bridge-tourist-skip.exact.plan.json`: AppID-restricted bridge actions that should be skipped automatically while the demo project uses `touristappid`
- `12-network-observation.placeholder.plan.json`: synthetic placeholder baseline for network listening, filtered waits, and ordered request assertions
- `13-network-failure.placeholder.plan.json`: forced request failure with structured response assertions
- `14-network-transfer.placeholder.plan.json`: staged upload and download observation with mocked transfer responses
- `15-network-local-server.real.plan.json`: real-runtime local server flow for request, staged upload, download, and network artifact assertions
