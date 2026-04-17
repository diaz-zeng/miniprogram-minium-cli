# Contributing

[中文](./docs/CONTRIBUTING.zh-CN.md)

Thank you for contributing to `miniprogram-minium-cli`.

This repository contains:

- a TypeScript-based Node.js CLI layer
- a Python execution runtime powered by Minium
- OpenSpec artifacts used to track product and implementation changes

## Development Principles

- Keep the CLI focused on execution, validation, and artifact management.
- Keep the Python runtime private to the CLI. Do not introduce dependencies on the user's global Python installation.
- Keep CLI help text and runtime-facing output in English.
- Keep repository-facing documentation in English unless a file explicitly requires another language.
- Prefer structured and machine-readable interfaces.

## Local Setup

Requirements:

- Node.js `>= 18`
- `pnpm`

Install dependencies:

```bash
pnpm install
```

## Development Commands

Build the TypeScript layer:

```bash
pnpm run build
```

Run type checks:

```bash
pnpm run typecheck
```

Run the test suite:

```bash
pnpm test
```

Warm up the managed runtime:

```bash
node lib/index.js prepare-runtime
```

## Project Structure

- `src/`: TypeScript CLI layer
- `python/`: Python runtime and Minium integration
- `tests/`: Node-side automated tests
- `examples/`: local-only example assets for development and verification
- `openspec/`: OpenSpec changes, specs, and implementation tracking

## Documentation Expectations

- `README.md` is the primary English product document.
- `docs/README.zh-CN.md` is the Chinese mirror document.
- Keep English and Chinese README files aligned when one of them changes.
- Example-specific explanations should live under `examples/` rather than the root README.
- Keep repository-managed skills under `skills/` aligned with documented CLI behavior and plan semantics.

## OpenSpec Workflow Expectations

- Use OpenSpec artifacts under `openspec/changes/<change>/` to track user-visible capability changes.
- When a change adds or modifies documented CLI commands, plan schema, step types, run artifacts, or other agent-facing workflows, explicitly assess whether repository-managed skills under `skills/` need an update.
- If the skill guidance would become stale, include the skill update in the same OpenSpec change instead of treating it as unrelated follow-up work.
- Reflect applicable skill work in the change artifacts, such as `proposal.md`, `design.md`, or `tasks.md`, so reviewers can verify the agent-facing workflow remains consistent.

## Testing Expectations

Before opening a change, run:

```bash
pnpm run typecheck
pnpm test
```

If you change runtime behavior, also verify the affected execution path manually when practical.

## Release Workflow Expectations

- `main` represents the current stable release and should only receive formal release PRs from `hotfix/*`, `release/*`, or `next/*`.
- `package.json.version` on each active release line must match the line version exactly and represent the target stable release for that line.
- `release/*` publishes beta builds to npm `next`, and `next/*` publishes alpha builds to npm `alpha`.
- Stable releases are published after a merged formal release PR reaches `main`; the workflow then publishes npm `latest`, creates the tag, and creates the GitHub Release.
- Stable releases require a matching `CHANGELOG.md` entry for the version being published; missing changelog content must fail the release workflow.
- After PATCH or MINOR stable releases, forward-port applicable fixes into the active `release/*` and `next/*` lines.
- Prefer npm trusted publishing for GitHub Actions. If it is not available yet, use `NPM_TOKEN` only as a temporary fallback.

## Commit Message Rules

- Use English commit messages.
- Follow Conventional Commits.

Examples:

- `feat: add inline json plan execution`
- `fix: resolve gesture dispatch target coordinates`
- `docs: rewrite root readme as product guide`

## Pull Request Guidance

- Keep changes focused and reviewable.
- Explain user-visible behavior changes clearly.
- Call out any runtime, compatibility, or release impacts.
- Include validation notes for tests and manual checks.
