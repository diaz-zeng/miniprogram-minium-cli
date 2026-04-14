# Run Analysis

Use this reference when the task is to understand the outcome of a `miniprogram-minium-cli` execution.

## Primary artifacts

When deeper analysis is needed, prefer these files over raw terminal output:

- `summary.json`
- `result.json`
- `comparison.json`
- `network.json`
- screenshots

## What to inspect

- Overall status and run ID
- Passed, failed, and skipped counts
- Failure code and message
- Artifact paths for screenshots and summaries
- Bridge-backed step outputs under `result`
- Skip reasons for AppID-restricted bridge-backed steps

## Guidance

- Start from the CLI conclusion first.
- If the result already matches the expectation, do not read run artifacts by default.
- When you need to investigate an unexpected result, start from the smallest useful structured file in the run directory.
- Prefer reading these artifacts after a plain `exec` run instead of defaulting to `exec ... --json`.
- Use screenshots for visual confirmation or failure forensics.
- Do not infer unsupported runtime behavior from logs when the structured result already answers the question.
- For bridge-backed steps, prefer `bridge_method`, `result`, and `current_page_path` from the structured output over terminal text.
