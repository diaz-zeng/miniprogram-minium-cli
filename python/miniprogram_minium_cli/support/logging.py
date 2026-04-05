"""Logging utilities."""

from __future__ import annotations

import logging


def get_logger(level: str = "INFO") -> logging.Logger:
    logger = logging.getLogger("miniprogram_minium_cli")
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    logger.setLevel(level.upper())
    return logger
