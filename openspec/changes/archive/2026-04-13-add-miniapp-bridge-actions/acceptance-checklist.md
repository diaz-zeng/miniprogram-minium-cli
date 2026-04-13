# Acceptance Checklist

This checklist tracks execution of all bundled acceptance plans under `examples/demo-regression/`.

Completion rule:

- Every checklist item below must be checked off.
- Each item should only be checked after the plan has been executed and the observed result matches the expected outcome.
- The acceptance task in `tasks.md` may only be marked complete after this checklist is fully complete.

## Regression Acceptance Plans

- [x] `examples/demo-regression/01-login-to-home.exact.plan.json`
  Expected outcome: pass
  Notes: exact login flow baseline; accepted on 2026-04-10

- [x] `examples/demo-regression/02-home-practice-save.mixed.plan.json`
  Expected outcome: pass
  Notes: mixed exact/fuzzy home practice save flow; accepted on 2026-04-10 after serial re-run with startup retry support

- [x] `examples/demo-regression/03-home-search.fuzzy.plan.json`
  Expected outcome: pass
  Notes: fuzzy search text verification; accepted on 2026-04-10

- [x] `examples/demo-regression/04-gesture-tap.exact.plan.json`
  Expected outcome: pass
  Notes: exact tap gesture verification; accepted on 2026-04-10 after fixing real-runtime tap dispatch

- [x] `examples/demo-regression/05-gesture-two-finger.exact.plan.json`
  Expected outcome: pass
  Notes: two-finger gesture and marker placement; accepted on 2026-04-10

- [x] `examples/demo-regression/06-cursor-marker-flow.mixed.plan.json`
  Expected outcome: pass
  Notes: cursor drag, marker flow, and screenshot checkpoints; accepted on 2026-04-10

- [x] `examples/demo-regression/07-review-board.mixed.plan.json`
  Expected outcome: pass
  Notes: review board interaction and screenshot checkpoints; accepted on 2026-04-10

- [x] `examples/demo-regression/08-assertion-failure.exact.plan.json`
  Expected outcome: expected failure
  Notes: failure forensics baseline; accepted on 2026-04-10 with expected `ASSERTION_FAILED`

- [x] `examples/demo-regression/09-bridge-high-priority.exact.plan.json`
  Expected outcome: pass
  Notes: high-priority bridge actions; accepted on 2026-04-10

- [x] `examples/demo-regression/10-bridge-medium.placeholder.plan.json`
  Expected outcome: pass
  Notes: medium-priority bridge actions in placeholder runtime; accepted on 2026-04-10 after normalizing placeholder page paths

- [x] `examples/demo-regression/11-bridge-tourist-skip.exact.plan.json`
  Expected outcome: pass with skipped restricted steps
  Notes: AppID-restricted bridge actions under `touristappid`; accepted on 2026-04-10 by executing the plan against a temporary demo-miniapp copy with `project.config.json.appid = touristappid`
  Additional observation: under the real AppID project, the same restricted flow no longer skips and `settings.authorize` returned a structured `ACTION_ERROR` (`authorize:fail`), which matches the non-tourist execution branch
