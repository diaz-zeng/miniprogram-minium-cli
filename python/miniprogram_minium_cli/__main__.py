"""Python execution entrypoint for the CLI runtime."""

from __future__ import annotations

import json
import sys

from .engine import execute_request


def main() -> None:
    raw = sys.stdin.read()
    request = json.loads(raw)
    response = execute_request(request)
    sys.stdout.write(json.dumps(response, ensure_ascii=False))


if __name__ == "__main__":
    main()
