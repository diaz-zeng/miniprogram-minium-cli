# Runtime Preparation

Use this reference when the task is to warm up the managed runtime or verify that the CLI can prepare its Python environment before a real execution.

## Primary command

```bash
miniprogram-minium-cli prepare-runtime
```

## Structured output

```bash
miniprogram-minium-cli prepare-runtime --json
```

The JSON output can include fields such as:

- `uvBin`
- `pythonRequest`
- `details`
- `cacheBaseDir`

## Guidance

- Use runtime preparation before the first real execution when cold start matters.
- Keep the workflow inside the managed `uv` runtime model.
- Do not replace the managed runtime with assumptions about the user's global Python installation.
