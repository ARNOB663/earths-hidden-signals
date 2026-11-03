"""Guard: existing pages are frozen (plan rev. 7b, step 1).

Diff against the pre-step-1 commit — not against main, which moves when ananda is merged. The
only existing files that may change are:

  * ``web/src/components/site/SiteNav.tsx``  — added lines inside the ``TABS`` array only
  * ``web/src/app/methods/page.tsx``         — one appended "Signals" section, no other hunk

Everything else must be a new file in one of the allowed folders. Run from the repo root:

    python3 -m pytest -q scripts/signals/tests/test_guardrails.py

CI must check out with ``fetch-depth: 0`` or the baseline commit is missing.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

BASELINE = "93812d033fd8c476413c119f11e3bb44ec8cb21d"
ROOT = Path(__file__).resolve().parents[3]

ALLOWED_NEW_PREFIXES = (
    "scripts/signals/",
    "web/src/app/signals/",
    "web/src/app/watch/",
    "web/src/app/accuracy/",
    "web/src/app/about/",
    "web/src/app/signals/evidence/",
    "web/src/components/signals/",
    "web/src/lib/signals/",
    "web/public/data/signals/",
    "docs/",
    ".github/workflows/",
)
ALLOWED_NEW_FILES = {".gitignore", "PLAN.md"}
# Allowed to change as a whole (not frozen): the ignore list, the plan folder, and tsconfig so the
# node:test files (which must import "./x.ts") can be excluded from Next's type check.
ALLOWED_MODIFY_PATHS = {".gitignore", "web/tsconfig.json"}
ALLOWED_MODIFY_PREFIXES = (".kilo/plans/",)
NAV_FILE = "web/src/components/site/SiteNav.tsx"
METHODS_FILE = "web/src/app/methods/page.tsx"
METHODS_MARKER = "Signals"


def git(*args: str) -> str:
    result = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    if result.returncode != 0:
        pytest.skip(f"git {args[0]} unavailable: {result.stderr.strip()[:200]}")
    return result.stdout


def changed_paths() -> dict[str, str]:
    """name-status for everything from the baseline to the working tree (staged + unstaged)."""
    out: dict[str, str] = {}
    tracked = git("diff", "--name-status", "--no-renames", BASELINE, "HEAD")
    for line in tracked.splitlines():
        if line.strip():
            status, path = line.split("\t", 1)
            out[path] = status
    for line in git("status", "--porcelain", "--untracked-files=all").splitlines():
        if not line.strip():
            continue
        status, path = line[:2].strip(), line[3:]
        if status == "??":
            out[path] = "A"
        elif path not in out:
            out[path] = "M" if status.startswith("M") else status
    return out


def patch_of(path: str) -> str:
    return git("diff", BASELINE, "--", path) + git("diff", "--", path)


def test_baseline_commit_exists() -> None:
    assert "commit" in git("cat-file", "-t", BASELINE)


def test_no_frozen_page_or_component_changed() -> None:
    offenders = []
    for path, status in changed_paths().items():
        if path in (NAV_FILE, METHODS_FILE):
            continue
        if path in ALLOWED_MODIFY_PATHS or path.startswith(ALLOWED_MODIFY_PREFIXES):
            continue
        if not path.startswith(ALLOWED_NEW_PREFIXES) and path not in ALLOWED_NEW_FILES:
            offenders.append(f"{status} {path} (outside allowed folders)")
    assert not offenders, "Existing files must not change:\n" + "\n".join(offenders)


# The nav as shipped. Watch is the /explore map relabelled; /watch and /monitoring keep their
# routes but no tab. About is the /methods page. Labels are the short `label:` strings in the
# TABS entries. This list is a product decision, not a refactor target.
NAV_TABS = (
    ("/", "Home"),
    ("/signals", "Signals"),
    ("/accuracy", "Accuracy"),
    ("/hazards", "Hazards"),
    ("/trends", "Trends"),
    ("/explore", "Watch"),
    ("/methods", "About"),
)
NO_TAB_ROUTES = ("/monitoring", "/watch")


def test_site_nav_has_exactly_the_planned_tabs() -> None:
    nav = (ROOT / NAV_FILE).read_text(encoding="utf-8")
    block = nav[nav.index("export const TABS = [") : nav.index("];", nav.index("export const TABS = ["))]
    entries = [line.strip() for line in block.splitlines() if line.strip().startswith("{ href:")]
    got = [line.split('href: "', 1)[1].split('"', 1)[0] for line in entries]
    assert tuple(got) == tuple(href for href, _ in NAV_TABS), f"Tabs are {got}"
    for (href, label), entry in zip(NAV_TABS, entries):
        assert f'label: "{label}"' in entry, entry
    for route in NO_TAB_ROUTES:
        assert f'href: "{route}"' not in block, f"{route} must not be a tab"
    # Only TABS may change: the rest of the nav is frozen against the baseline commit.
    changed = [line[1:] for line in patch_of(NAV_FILE).splitlines() if line.startswith(("+", "-")) and line[:3] not in ("+++", "---")]
    outside = [line for line in changed if '{ href: "' not in line]
    assert not outside, "Only TABS entries may change in SiteNav.tsx: " + repr(outside[:3])


def test_methods_only_gains_the_signals_section() -> None:
    patch = patch_of(METHODS_FILE)
    if not patch.strip():
        return
    added = [line[1:] for line in patch.splitlines() if line.startswith("+") and not line.startswith("+++")]
    removed = [line[1:] for line in patch.splitlines() if line.startswith("-") and not line.startswith("---")]
    assert not removed, "Methods page may only gain its Signals section: removed " + repr(removed[:3])
    assert any(METHODS_MARKER in line for line in added), "Methods addition must be the Signals section"


def test_baseline_folder_is_allowed_and_budgeted() -> None:
    folder = ROOT / "scripts" / "signals" / "baseline"
    if not folder.exists():
        return
    total = sum(p.stat().st_size for p in folder.rglob("*") if p.is_file())
    assert total <= 25 * 1024 * 1024, f"scripts/signals/baseline/ is {total} bytes (budget 25 MB)"
    for path in folder.rglob("*"):
        if path.is_file():
            assert path.stat().st_size <= 8 * 1024 * 1024, f"{path.name} exceeds 8 MB per tile"


def test_no_country_specific_files_anywhere_in_signals() -> None:
    for path in (ROOT / "scripts" / "signals").rglob("*"):
        if path.is_file() and "tests" not in path.parts:
            name = path.name.lower()
            for word in ("bangladesh", "india", "pakistan", "nepal", "srilanka", "bhutan"):
                assert word not in name, f"Country-specific file {path}"
