"""Guard: the seven-page navigation contract, redirects and data budgets.

These tests guard the structure the platform now promises: exactly seven primary pages, permanent
redirects for every retired route, no internal link pointing at a retired route, and the budgets
that keep the committed signal files small. Run from the repo root:

    python3 -m pytest -q scripts/signals/tests/test_guardrails.py
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
NAV_FILE = "web/src/components/site/SiteNav.tsx"

# The shipped navigation contract: exactly these seven pages, in this order. Changing this list is
# a product decision, not a refactor target. Labels are the short `label:` strings in TABS.
NAV_TABS = (
    ("/", "Home"),
    ("/signal", "Signal"),
    ("/gap", "Gap"),
    ("/replay", "Replay"),
    ("/accuracy", "Accuracy"),
    ("/act", "Act"),
    ("/watch", "Watch"),
)

# Routes retired when the seven-page structure landed. Each must redirect, and no internal link may
# still point at one. `:slug` / `:id` stand for a dynamic segment in next.config.ts.
RETIRED_ROUTES = (
    "/trends",
    "/hazards",
    "/monitoring",
    "/locations",
    "/countries",
    "/country/:slug",
    "/location/:id",
    "/explore",
    "/findings",
    "/signals",
    "/signals/place",
    "/signals/evidence",
    "/about",
)
# Files that reference a retired route legitimately: the redirect table itself.
REDIRECT_FILE = ROOT / "web" / "next.config.ts"


def _nav_block() -> str:
    nav = (ROOT / NAV_FILE).read_text(encoding="utf-8")
    start = nav.index("export const TABS = [")
    return nav[start : nav.index("];", start)]


def test_required_nav_tabs_are_exactly_the_seven_pages() -> None:
    block = _nav_block()
    entries = [line.strip() for line in block.splitlines() if line.strip().startswith("{ href:")]
    got = [line.split('href: "', 1)[1].split('"', 1)[0] for line in entries]
    assert tuple(got) == tuple(href for href, _ in NAV_TABS), f"Tabs are {got}"
    for (_, label), entry in zip(NAV_TABS, entries):
        assert f'label: "{label}"' in entry, entry


def test_retired_routes_are_not_navigation_tabs() -> None:
    block = _nav_block()
    for route in RETIRED_ROUTES:
        literal = route.replace("/:slug", "").replace("/:id", "")
        assert f'href: "{literal}"' not in block, f"{route} is retired and must not be a tab"


def test_retired_routes_have_permanent_redirects() -> None:
    config = REDIRECT_FILE.read_text(encoding="utf-8")
    for route in RETIRED_ROUTES:
        assert f'source: "{route}"' in config, f"{route} has no redirect in next.config.ts"
    assert "permanent: true" in config, "retired-route redirects must be permanent (308)"


def test_no_internal_links_point_at_retired_routes() -> None:
    src = ROOT / "web" / "src"
    offenders = []
    for path in src.rglob("*.tsx"):
        text = path.read_text(encoding="utf-8", errors="ignore")
        for route in RETIRED_ROUTES:
            if ":" in route:
                continue  # dynamic segments are only ever patterns in next.config.ts
            if f'href="{route}"' in text or f'href="{route}/' in text or f'href={{`{route}/' in text:
                offenders.append(f"{path.relative_to(ROOT)} -> {route}")
    assert not offenders, "Internal links to retired routes:\n" + "\n".join(offenders)


def test_footer_links_target_live_pages_or_external_urls() -> None:
    layout = (ROOT / "web" / "src" / "app" / "layout.tsx").read_text(encoding="utf-8")
    for href in ("/methods", "/for-organizations", "/methods#data"):
        assert f'href="{href}"' in layout, f"footer is missing {href}"
    assert "https://github.com/" in layout, "footer is missing the GitHub link"
    for route in ("/methods", "/for-organizations"):
        page = ROOT / "web" / "src" / "app" / route.strip("/") / "page.tsx"
        assert page.exists(), f"footer target {route} has no page"


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
