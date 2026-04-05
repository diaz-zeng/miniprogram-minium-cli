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
- `npm`

Install dependencies:

```bash
npm install
```

## Development Commands

Build the TypeScript layer:

```bash
npm run build
```

Run type checks:

```bash
npm run typecheck
```

Run the test suite:

```bash
npm test
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

## Testing Expectations

Before opening a change, run:

```bash
npm run typecheck
npm test
```

If you change runtime behavior, also verify the affected execution path manually when practical.

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
