---
name: miniprogram-minium-cli
description: Use when working with miniprogram-minium-cli to prepare the managed runtime, author or validate structured miniapp plans, execute plans, install the bundled skill with `miniprogram-minium-cli install --skills`, or analyze run artifacts such as summary.json, result.json, comparison.json, and screenshots.
---

# miniprogram-minium-cli Skill

Use this skill as the single entry point for product usage of `miniprogram-minium-cli` across Codex, Claude Code, GitHub Copilot, and other coding agents that can work with standard skill directories or read the CLI help directly.

## Quick start

```bash
# warm up the managed runtime
miniprogram-minium-cli prepare-runtime

# install the bundled skill into the local .agents skills directory
miniprogram-minium-cli install --skills

# install through npx when the package is local
npx --no-install miniprogram-minium-cli install --skills

# install through npx without a prior global install
npx miniprogram-minium-cli install --skills

# install through the open skills tool from this repository
npx skills add diaz-zeng/miniprogram-minium-cli --skill miniprogram-minium-cli

# execute a plan file
miniprogram-minium-cli exec --plan ./path/to/plan.json

# execute an inline plan and print structured output
miniprogram-minium-cli exec --plan-json '{"version":1,"kind":"miniapp-test-plan", ... }' --json
```

## Guardrails

- Treat `miniprogram-minium-cli` as an execution layer, not a planner.
- Use documented commands, flags, plan fields, and artifact names only.
- Do not invent unsupported step types or arbitrary shell workflows.
- Prefer structured run artifacts over ad hoc log interpretation.

## Workflow

1. Confirm whether the task is about runtime setup, plan authoring, execution, skill installation, or run analysis.
2. Read the matching reference file before acting:
   - Runtime setup: [references/prepare-runtime.md](references/prepare-runtime.md)
   - Plan authoring and validation: [references/plan-authoring.md](references/plan-authoring.md)
   - Plan execution: [references/execution.md](references/execution.md)
   - Skill installation: [references/installing-skills.md](references/installing-skills.md)
   - Run analysis: [references/run-analysis.md](references/run-analysis.md)
3. Keep the workflow inside the documented CLI contract in `README.md` and `docs/API_REFERENCE.md`.
4. When a command or field is undocumented, stop treating it as supported and fall back to the repository docs.

## Commands at a glance

```bash
miniprogram-minium-cli prepare-runtime
miniprogram-minium-cli prepare-runtime --json

miniprogram-minium-cli install --skills
miniprogram-minium-cli install --skills --path /path/to/skills
miniprogram-minium-cli install --skills --json
npx --no-install miniprogram-minium-cli install --skills
npx miniprogram-minium-cli install --skills
npx skills add diaz-zeng/miniprogram-minium-cli --skill miniprogram-minium-cli

miniprogram-minium-cli exec --plan ./path/to/plan.json
miniprogram-minium-cli exec --plan-json '{"version":1,"kind":"miniapp-test-plan", ... }'
miniprogram-minium-cli exec --plan ./path/to/plan.json --json
```

## Specific tasks

- Runtime setup: [references/prepare-runtime.md](references/prepare-runtime.md)
- Plan authoring and validation: [references/plan-authoring.md](references/plan-authoring.md)
- Plan execution: [references/execution.md](references/execution.md)
- Skill installation: [references/installing-skills.md](references/installing-skills.md)
- Run analysis: [references/run-analysis.md](references/run-analysis.md)

## Command availability

If the global `miniprogram-minium-cli` command is unavailable but the package exists locally, prefer:

```bash
npx --no-install miniprogram-minium-cli --help
```

If the package is not installed yet, install it first:

```bash
npm install -g miniprogram-minium-cli
```

By default, `install --skills` writes to `./.agents/skills` under the current working directory. Use `--path` when you want a shared global directory or an agent-specific local skills directory.

If you want to avoid a global install, use `npx miniprogram-minium-cli ...` instead.

If the agent supports the open `skills` ecosystem, you can also install this skill directly from the repository with `npx skills add diaz-zeng/miniprogram-minium-cli --skill miniprogram-minium-cli`.
