[中文](./scenarios.zh-CN.md)

# Scenario Matrix

This document maps demo pages to the CLI capabilities they are meant to verify.

## Pages

### Login Page

Source: `src/pages/login/index.tsx`

Purpose:

- validate exact element lookup by `id`
- validate click-driven navigation
- provide a stable entry page for smoke plans

Typical coverage:

- `element.query`
- `element.click`
- `wait.for`
- `assert.pagePath`

### Home Page

Source: `src/pages/home/index.tsx`

Purpose:

- validate fuzzy lookup through partial text
- validate text input and local state updates
- validate modal open and close flows

Typical coverage:

- `element.input`
- `assert.elementText`
- `assert.elementVisible`
- mixed exact and fuzzy selectors

### Gesture Page

Source: `src/pages/gesture/index.tsx`

Purpose:

- validate `gesture.touchTap`
- validate single-finger and two-finger gesture state handling
- validate gesture result feedback in page content

Typical coverage:

- `gesture.touchTap`
- `gesture.touchStart`
- `gesture.touchMove`
- `gesture.touchEnd`

### Cursor Lab Page

Source: `src/pages/cursor-lab/index.tsx`

Purpose:

- validate hold-to-drag cursor movement
- validate multi-pointer marker placement on the current cursor position
- validate screenshot checkpoints for activation, first marker, relocation, and second marker
- validate mixed selectors in a stateful interaction page

Typical coverage:

- `gesture.touchStart`
- `gesture.touchMove`
- `gesture.touchTap`
- exact coordinate assertions after pointer movement

### Review Board Page

Source: `src/pages/review-board/index.tsx`

Purpose:

- validate review rendering after marker placement
- validate pan and zoom style interactions on a second page
- provide a visible reference beacon so before-and-after screenshots are easy to compare
- validate reusable gesture coverage outside the cursor editor page

Typical coverage:

- page assertions
- gesture sequences
- marker summary assertions

## Plan Styles

The regression set intentionally mixes two styles:

- exact plans: optimized for deterministic smoke coverage through stable `id` selectors
- fuzzy or mixed plans: optimized for model-friendly prompts and more realistic user-facing text lookup

Use exact plans when you want a low-noise baseline. Use fuzzy or mixed plans when you want to validate the CLI's higher-level locator behavior.
