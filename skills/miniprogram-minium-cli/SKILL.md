---
name: miniprogram-minium-cli
description: Use when working with miniprogram-minium-cli to prepare the managed runtime, author or validate structured miniapp plans, use the bridge-backed miniapp APIs, execute plans, install the bundled skills with `miniprogram-minium-cli install --skills`, or analyze run artifacts such as summary.json, result.json, comparison.json, and screenshots.
---

# miniprogram-minium-cli Skill

Use this skill as the single entry point for product usage of `miniprogram-minium-cli` across Codex, Claude Code, GitHub Copilot, and other coding agents that can work with standard skill directories or read the CLI help directly.

## Quick start

```bash
# warm up the managed runtime
miniprogram-minium-cli prepare-runtime

# install the bundled skills into the local .agents skills directory
miniprogram-minium-cli install --skills

# install this specific skill through the open skills tool from this repository
npx skills add diaz-zeng/miniprogram-minium-cli --skill miniprogram-minium-cli

# execute a plan file
miniprogram-minium-cli exec --plan ./path/to/plan.json

# execute an inline plan
miniprogram-minium-cli exec --plan-json '{"version":1,"kind":"miniapp-test-plan", ... }'
```

## Bridge-backed API usage

When the task is about miniapp storage, navigation, app context, settings, clipboard, feedback UI, location, media, file, device, auth, or subscription capabilities, prefer the documented bridge-backed step types instead of inventing raw `wx` calls.

Use bridge-backed steps when:

- the capability should not depend on clicking a visible page control
- the plan needs direct access to miniapp runtime state or host APIs
- the user wants a structured result object under the step output

Use network steps when:

- the task is to verify whether a UI action or bridge step emitted any request
- the plan needs URL, method, query, header, body, status, or response-body based filtering
- the task needs a structured failure, delay, or mocked response instead of a real backend dependency

Read [references/bridge-actions.md](references/bridge-actions.md) before drafting or editing plans that use:

- `storage.*`
- `navigation.*`
- `app.*`
- `settings.*`
- `clipboard.*`
- `ui.*`
- `location.*`
- `media.*`
- `file.*`
- `device.*`
- `auth.*`
- `subscription.requestMessage`

Read [references/plan-authoring.md](references/plan-authoring.md) before drafting or editing plans that use:

- `network.listen.*`
- `network.wait`
- `network.intercept.*`
- `assert.networkRequest`
- `assert.networkResponse`

## Guardrails

- Treat `miniprogram-minium-cli` as an execution layer, not a planner.
- Use documented commands, flags, plan fields, and artifact names only.
- Do not invent unsupported step types or arbitrary shell workflows.
- Prefer structured run artifacts over ad hoc log interpretation.
- Do not add `--json` by default when `exec` already persists the evidence you need to run artifacts on disk.
- Use `exec ... --json` only when the current caller must consume structured stdout directly in the same command context.
- Do not read persisted run artifacts by default when the CLI result already answers the validation question.
- Read `summary.json`, `result.json`, `comparison.json`, `network.json`, or screenshots only when the observed result is unexpected or when the caller explicitly needs deeper evidence.

## Workflow

1. Confirm whether the task is about runtime setup, plan authoring, execution, skill installation, or run analysis.
2. Read the matching reference file before acting:
   - Runtime setup: [references/prepare-runtime.md](references/prepare-runtime.md)
   - Plan authoring and validation: [references/plan-authoring.md](references/plan-authoring.md)
   - Bridge-backed miniapp APIs: [references/bridge-actions.md](references/bridge-actions.md)
   - Plan execution: [references/execution.md](references/execution.md)
   - Skill installation: [references/installing-skills.md](references/installing-skills.md)
   - Run analysis: [references/run-analysis.md](references/run-analysis.md)
3. Keep the workflow inside the documented CLI contract in `README.md` and `docs/API_REFERENCE.md`.
4. When a command or field is undocumented, stop treating it as supported and fall back to the repository docs.
5. For `exec`, decide whether stdout JSON is actually needed before adding `--json`:
   - Prefer plain `exec` when the goal is to validate a run, and inspect `summary.json`, `result.json`, `comparison.json`, `network.json`, or screenshots only if the observed outcome is unexpected or the caller explicitly asks for evidence.
   - Add `--json` only when the immediate caller explicitly needs the structured response on stdout for in-process parsing or direct inline return.
6. For persisted run artifacts, read them lazily:
   - If the CLI outcome already matches the expected result, stop there unless the caller explicitly asks for artifact-level details.
   - If the CLI outcome is unexpected, start with the smallest useful artifact and expand only as needed.

## When to use `--json`

Use `exec ... --json` only when structured stdout is part of the contract of the current caller.

- Required:
  - another script, agent, or CI step must parse the execution result directly from stdout in the same invocation
  - the current workflow needs fields such as `ok`, `summary.status`, `error.error_code`, `artifacts`, or `stepResults` immediately, without reading the run directory afterward
- Recommended:
  - you are testing or debugging the CLI's structured stdout contract itself
  - you are composing `miniprogram-minium-cli` inside a machine-to-machine pipeline where stdout is the integration surface
- Usually avoid:
  - the task only needs to know whether the run passed or failed
  - the observed result already matches the expected outcome
  - the same facts can be read later from `summary.json`, `result.json`, `comparison.json`, `network.json`, or screenshots with lower token cost

## Commands at a glance

```bash
miniprogram-minium-cli prepare-runtime
miniprogram-minium-cli prepare-runtime --json

miniprogram-minium-cli install --skills
miniprogram-minium-cli install --skills --path /path/to/skills
miniprogram-minium-cli install --skills --json
npx skills add diaz-zeng/miniprogram-minium-cli --skill miniprogram-minium-cli

miniprogram-minium-cli exec --plan ./path/to/plan.json
miniprogram-minium-cli exec --plan-json '{"version":1,"kind":"miniapp-test-plan", ... }'
miniprogram-minium-cli exec --plan ./path/to/plan.json --json
```

## Specific tasks

- Runtime setup: [references/prepare-runtime.md](references/prepare-runtime.md)
- Plan authoring and validation: [references/plan-authoring.md](references/plan-authoring.md)
- Bridge-backed miniapp APIs: [references/bridge-actions.md](references/bridge-actions.md)
- Plan execution: [references/execution.md](references/execution.md)
- Skill installation: [references/installing-skills.md](references/installing-skills.md)
- Run analysis: [references/run-analysis.md](references/run-analysis.md)

## Command availability

If the package is not installed yet, install it first:

```bash
npm install -g miniprogram-minium-cli
```

By default, `install --skills` writes all bundled skills to `./.agents/skills` under the current working directory. Use `--path` when you want a shared global directory or an agent-specific local skills directory.

If the agent supports the open `skills` ecosystem, you can also install this skill directly from the repository with `npx skills add diaz-zeng/miniprogram-minium-cli --skill miniprogram-minium-cli`.

The same repository also exposes `interactive-classname-tagging` for development-time interactive marker guidance.
