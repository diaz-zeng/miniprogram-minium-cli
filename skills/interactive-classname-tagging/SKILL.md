---
name: interactive-classname-tagging
description: Use when developing or editing miniapp pages and components that need explicit dedicated `className` markers on interactive elements for automation, recording, replay, or debugging.
---

# interactive-classname-tagging Skill

Use this skill when the task involves adding or updating miniapp UI code and the target interactive elements must carry dedicated automation anchors.

This skill is for development-time code changes. It does not replace the product-use skill for `miniprogram-minium-cli`, and it does not describe OpenSpec workflows.

## Guardrails

- Add a dedicated marker to each target interactive element. Do not treat an existing business or layout `className` as sufficient.
- Use the fixed marker format `minium-anchor-<4hex>`.
- Keep the change minimal: preserve existing style classes and add the dedicated marker alongside them.
- Prefer the actual event-bound node or the closest interaction-bearing node.
- Do not add markers to pure layout, pure text, or decorative nodes unless they are explicitly required as automation anchors.

## Workflow

1. Confirm the task touches interactive or automation-critical elements.
2. Read [references/when-to-tag.md](references/when-to-tag.md) to decide which nodes need a dedicated marker.
3. Read [references/naming-convention.md](references/naming-convention.md) to generate `minium-anchor-<4hex>` markers consistently.
4. Add the dedicated marker next to existing business classes instead of replacing them.
5. Use [references/examples.md](references/examples.md) when the target node, placement, or coexistence with existing classes is unclear.

## Specific tasks

- Tagging scope: [references/when-to-tag.md](references/when-to-tag.md)
- Naming and collision handling: [references/naming-convention.md](references/naming-convention.md)
- Before/after examples: [references/examples.md](references/examples.md)
