# Bridge-backed Miniapp APIs

Use this reference when the task is to draft, edit, or run plans that use the bridge-backed miniapp APIs in `miniprogram-minium-cli`.

## What bridge-backed means

Bridge-backed steps expose a controlled subset of miniapp native capabilities through structured plan step types.

Use them for:

- storage reads and writes
- navigation APIs
- app context queries
- settings and clipboard APIs
- feedback UI such as toast, loading, modal, and action sheet
- location, media, file, device, auth, and subscription flows

Do not replace them with raw `wx` method names or custom script execution.

## Step families

The currently supported bridge-backed step groups are:

- `storage.set`, `storage.get`, `storage.info`, `storage.remove`, `storage.clear`
- `navigation.navigateTo`, `navigation.redirectTo`, `navigation.reLaunch`, `navigation.switchTab`, `navigation.back`
- `app.getLaunchOptions`, `app.getSystemInfo`, `app.getAccountInfo`
- `settings.get`, `settings.authorize`, `settings.open`
- `clipboard.set`, `clipboard.get`
- `ui.showToast`, `ui.hideToast`, `ui.showLoading`, `ui.hideLoading`, `ui.showModal`, `ui.showActionSheet`
- `location.get`, `location.choose`, `location.open`
- `media.chooseImage`, `media.chooseMedia`, `media.takePhoto`, `media.getImageInfo`, `media.saveImageToPhotosAlbum`
- `file.upload`, `file.download`
- `device.scanCode`, `device.makePhoneCall`
- `auth.login`, `auth.checkSession`
- `subscription.requestMessage`

## When to use bridge-backed steps instead of UI steps

Use bridge-backed steps when the plan should call a miniapp capability directly.

Use UI steps when the plan should verify or drive visible page interactions first.

Examples:

- Prefer `storage.set` over clicking a demo button if the goal is to validate storage behavior directly.
- Prefer `navigation.navigateTo` when the plan should assert route behavior independently of page controls.
- Prefer `element.click` when the task is explicitly about a user-visible button flow.

## Common optional fields

Bridge-backed steps can also accept these shared optional fields when supported by the documented schema:

- `timeoutMs`
  Use this for async bridge actions that need a custom timeout budget.
- `requiresDeveloperAppId`
  Mark steps that should run only under a developer-owned AppID.
- `skipReason`
  Provide a human-readable reason for the restricted-step skip path.

## AppID-restricted behavior

When a bridge-backed step sets `requiresDeveloperAppId: true`, or belongs to the built-in restricted set, the engine checks the target project's `project.config.json`.

If the project uses `touristappid`:

- the step is skipped instead of reported as a product failure
- the structured result includes the skip reason

If the project uses a developer-owned AppID:

- the step executes normally
- failures are reported as runtime or action failures instead of compatibility skips

## Authoring examples

### Storage and clipboard

```json
{
  "id": "set-storage",
  "type": "storage.set",
  "input": { "key": "demo-key", "value": "demo-value" }
}
```

```json
{
  "id": "get-clipboard",
  "type": "clipboard.get",
  "input": {}
}
```

### Navigation

```json
{
  "id": "open-bridge-lab",
  "type": "navigation.navigateTo",
  "input": { "url": "/pages/bridge-lab/index" }
}
```

```json
{
  "id": "go-back",
  "type": "navigation.back",
  "input": { "delta": 1 }
}
```

### AppID-restricted bridge step

```json
{
  "id": "authorize-location",
  "type": "settings.authorize",
  "input": {
    "scope": "scope.userLocation",
    "requiresDeveloperAppId": true,
    "skipReason": "Authorization flows require a developer-owned AppID."
  }
}
```

### Async bridge step with timeout

```json
{
  "id": "confirm-modal",
  "type": "ui.showModal",
  "input": {
    "title": "Bridge confirmation",
    "content": "Proceed with the bridge plan.",
    "timeoutMs": 1500
  }
}
```

## Execution guidance

For in-repository verification, use the bundled demo plans under `examples/demo-regression/` when possible.

Helpful examples:

- `09-bridge-high-priority.exact.plan.json`
- `10-bridge-medium.placeholder.plan.json`
- `11-bridge-tourist-skip.exact.plan.json`

When choosing a runtime mode:

- use `real` when the task depends on actual WeChat DevTools behavior
- use `placeholder` when the flow is intentionally host-independent
- use `auto` when the same plan should remain portable across environments

## Result interpretation

Bridge-backed step results are returned under the structured step output.

Inspect:

- `bridge_method`
- `result`
- `current_page_path`
- skip metadata when AppID restrictions apply

Prefer those structured fields over raw terminal logs.
