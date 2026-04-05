[中文](./docs/README.zh-CN.md)

# TaroJS Demo Miniapp

This TaroJS miniapp is the in-repository verification target for `miniprogram-minium-cli`.

It is designed to validate:

- exact selectors based on `id`
- fuzzy selectors based on partial text matching
- page navigation, waits, text assertions, and input
- touch tap, single-finger, and two-finger gesture flows
- cursor dragging, marker placement, and review-board gestures
- explicit screenshot checkpoints for interaction and visual acceptance

## Install

```bash
cd examples/demo-miniapp
npm install
```

## Build For WeChat Mini Program

```bash
npm run build:weapp
```

For iterative local verification:

```bash
npm run dev:weapp
```

After the build is ready, open the project root in WeChat DevTools. The `project.config.json` file points `miniprogramRoot` to `dist/`.

## Real Validation Note

The demo project uses `touristappid` by default so the repository can be cloned and built without private credentials.

When the target project uses `touristappid`, the CLI enables a compatibility path during real runtime startup and disables Minium's native modal mocking.

This compatibility path is suitable for the demo flows in this repository:

- page navigation
- exact and fuzzy element lookup
- text input
- waits and assertions
- tap and gesture validation

It is not a good proxy for flows that depend on mocked native dialogs or mocked authorization APIs, such as:

- `wx.showModal`
- `wx.showActionSheet`
- `wx.authorize`
- `wx.getLocation`
- `wx.chooseLocation`
- `wx.getUserProfile`
- `wx.requestSubscribeMessage`

This limitation is expected for any project that still runs under `touristappid`, including early local development setups. If you need to validate those native-authorization flows, switch the project to a developer-owned AppID instead of `touristappid`.

## Documentation

- [Documentation Index](./docs/README.md)
- [Scenario Matrix](./docs/scenarios.md)
- [中文](./docs/README.zh-CN.md)
