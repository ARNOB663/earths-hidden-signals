"""Writers for web/public/data/signals/ (plan §5, step 3).

Enforces the size budgets before anything lands in the repo, writes one small plain JSON per tile,
and copies config.json byte-for-byte so the browser and the pipeline read the same thresholds.
"""

from __future__ import annotations

import datetime as dt
import json
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / "web" / "public" / "data" / "signals"


class BudgetError(RuntimeError):
    pass


def _dump(path: Path, payload: dict) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, separators=(",", ":"), ensure_ascii=False, sort_keys=True)
    path.write_text(text, encoding="utf-8")
    return len(text.encode("utf-8"))


def check_budget(name: str, size: int, limit: int) -> None:
    if size > limit:
        raise BudgetError(f"{name} is {size} bytes, budget {limit}. The run fails rather than shrinking precision silently.")


def write_config_copy(config_path: Path = HERE / "config.json") -> None:
    target = OUT / "config.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(config_path, target)
    if target.read_bytes() != config_path.read_bytes():
        raise BudgetError("config.json copy is not byte-identical")


def write_meta(meta: dict, config: dict) -> None:
    size = _dump(OUT / "meta.json", meta)
    check_budget("meta.json", size, 64 * 1024)


def write_sources(sources: dict) -> None:
    _dump(OUT / "sources.json", sources)


def write_grid(tile_id: str, cells: list[dict], config: dict) -> int:
    size = _dump(OUT / "grid" / f"{tile_id}.json", {"tile": tile_id, "cells": cells})
    check_budget(f"grid/{tile_id}.json", size, config["budgets"]["gridBytes"])
    return size


def write_replay(event_id: str, payload: dict, config: dict) -> None:
    size = _dump(OUT / "replay" / f"{event_id}.json", payload)
    check_budget(f"replay/{event_id}.json", size, config["budgets"]["replayBytes"])


def write_archive(day: dt.date, payload: dict, config: dict) -> None:
    size = _dump(OUT / "archive" / f"{day.isoformat()}.json", payload)
    check_budget(f"archive/{day.isoformat()}.json", size, config["budgets"]["archiveBytes"])


def write_watch(payload: dict, config: dict) -> None:
    size = _dump(OUT / "watch.json", payload)
    check_budget("watch.json", size, config["budgets"]["watchBytes"])


