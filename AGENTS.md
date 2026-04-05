# AGENTS.md

This repository hosts an AI-first CLI for mini program automation and testing.

## Response Language

- Always reply in the user's language.
- Keep repository-facing documentation, code comments, commit messages, and command descriptions in English unless a file explicitly requires another language.

## Collaboration Rules

- Prefer small, focused changes that keep the Node.js CLI shell and the Python runtime loosely coupled.
- Preserve the `uv`-managed private runtime model; do not introduce changes that depend on the user's global Python installation.
- Keep CLI output and command help in English so they are easier for language models and automation systems to consume.
- Favor structured, machine-readable interfaces for plans, summaries, and runtime responses.

## Documentation Rules

- The root `README.md` is the primary English project document.
- The Chinese mirror document lives at `docs/README.zh-CN.md`.
- Keep the English and Chinese README files cross-linked when editing either one.

## Commit Rules

- Use English commit messages.
- Follow the Conventional Commits format, such as `feat: ...`, `fix: ...`, or `docs: ...`.
