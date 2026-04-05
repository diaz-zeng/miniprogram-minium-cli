# Run Analysis

Use this reference when the task is to understand the outcome of a `miniprogram-minium-cli` execution.

## Primary artifacts

Prefer these files over raw terminal output:

- `summary.json`
- `result.json`
- `comparison.json`
- screenshots

## What to inspect

- Overall status and run ID
- Passed, failed, and skipped counts
- Failure code and message
- Artifact paths for screenshots and summaries

## Guidance

- Start from the structured files in the run directory.
- Use screenshots for visual confirmation or failure forensics.
- Do not infer unsupported runtime behavior from logs when the structured result already answers the question.
