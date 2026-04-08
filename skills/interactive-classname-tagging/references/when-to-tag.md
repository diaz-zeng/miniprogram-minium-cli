# When to Tag Interactive Elements

Use this reference to decide whether an element needs an explicit dedicated automation marker.

## Tag by default

Add a dedicated `className` marker to:

- clickable buttons, cards, icons, and list actions
- input fields, textareas, search boxes, and form controls
- switches, tabs, radios, checkboxes, and toggle controls
- submit, confirm, next-step, and navigation triggers
- any other element that is a stable automation, replay, or debugging anchor

## Do not tag by default

Do not add a dedicated marker to:

- pure layout wrappers
- pure text display nodes
- decorative images and backgrounds
- non-interactive containers that only exist for spacing or styling

## Placement rules

- Prefer the node that actually owns the interaction handler.
- If both wrapper and child are interactive, tag the node that represents the real action target.
- If a node already has business classes, keep them and append the dedicated marker instead of replacing them.
- If a marker already exists in the correct dedicated format, reuse it and do not add a second dedicated marker.
