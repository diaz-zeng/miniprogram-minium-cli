# Dedicated Marker Naming Convention

Use this reference to generate dedicated automation markers in a stable and repeatable way.

## Required format

Every dedicated marker must use:

```text
minium-anchor-<4hex>
```

`<4hex>` is a 4-character lowercase hexadecimal short hash such as `a1b2` or `0f3c`.

## Base seed

Build the base seed from:

```text
<relative-file-path>|<element-tree-path>|<interaction-type>
```

Use these field meanings:

- `relative-file-path`: the stable file path relative to the repository root, using forward slashes
- `element-tree-path`: the stable source-order path from the local view root to the target element, such as `0/3/1`
- `interaction-type`: a normalized interaction label such as `click`, `input`, `switch`, `submit`, `select`, or `navigate`

## Hash rule

Normalize the base seed, hash it, and take the first 4 lowercase hexadecimal characters.

The exact hash function can be any stable hexadecimal-producing hash available to the agent, as long as the same normalized seed produces the same `<4hex>` value in the same environment.

## Collision handling

If two different target elements in the same page or component scope produce the same marker:

1. keep the original base seed
2. append an incrementing collision suffix such as `|1`, `|2`, `|3`
3. recompute the hash
4. stop only when the dedicated marker is unique in the current scope

## Usage rules

- Keep existing business classes and append the dedicated marker.
- Do not invent semantic names such as `qa-login-submit-button`.
- Do not use business classes, layout classes, or visual classes as substitutes for the dedicated marker.
