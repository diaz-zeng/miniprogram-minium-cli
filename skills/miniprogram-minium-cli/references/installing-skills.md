# Installing the Bundled Skills

Use this reference when the task is to install the repository-bundled skills into a local skills directory for Claude Code, GitHub Copilot, Codex, or another coding agent.

## Default installation

```bash
miniprogram-minium-cli install --skills
```

If your agent supports the open `skills` ecosystem, install the main product-use skill directly from this repository:

```bash
npx skills add diaz-zeng/miniprogram-minium-cli --skill miniprogram-minium-cli
```

List available skills before installing:

```bash
npx skills add diaz-zeng/miniprogram-minium-cli --list
```

This installs every bundled skill from the package into:

- `./.agents/skills` under the current working directory

The bundled set currently includes:

- `miniprogram-minium-cli`
- `interactive-classname-tagging`

## Custom installation root

```bash
miniprogram-minium-cli install --skills --path /custom/skills/root
```

The command installs each bundled skill into a subdirectory of the target root.

Use `--path` when you want a shared global directory or another coding agent expects a different local skills directory.

## Structured output

```bash
miniprogram-minium-cli install --skills --json
```

Use JSON mode when another agent or script needs the installed paths.

## Notes

- The command installs packaged skill assets; it does not generate new skills.
- Re-running the command refreshes the installed bundled skills at the target location.
- The open `skills` tool installs from the repository layout under `skills/`, so each skill can also be installed individually, including `interactive-classname-tagging`.

## Command availability

Install the CLI first if `miniprogram-minium-cli` is unavailable in the shell, then rerun the bundled skill installation command.
