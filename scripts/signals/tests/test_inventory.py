"""Quality gate: the resource inventory must account for every dataset the repo ships (plan §10).

These tests do not police wording. They fail when a dataset, licence register or automation file
exists in the repository but is missing from `docs/RESOURCE_INVENTORY.md` and
`docs/DATA_SOURCE_CATALOG.md`, so a future refactor cannot quietly drop a source's record. They also
pin the preservation rule that matters most: a retired page must not take its underlying dataset with
it.

Run from the repo root:

    python3 -m pytest -q scripts/signals/tests/test_inventory.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / "web" / "public" / "data"
DOCS = ROOT / "docs"
INVENTORY = DOCS / "RESOURCE_INVENTORY.md"
CATALOG = DOCS / "DATA_SOURCE_CATALOG.md"
INTEGRATION = DOCS / "RESOURCE_INTEGRATION_MAP.md"

# Dataset ids the intelligence engine registers as inputs. The catalog must name each one.
REGISTERED_DATASETS = (
    "gistemp",
    "gpcp-monthly",
    "gpcp-daily",
    "cru-ts",
    "firms-modis",
    "nasa-glc",
    "gdacs",
    "ibtracs",
)

# Committed data files that carry observational or hazard records. Each must appear in the catalog's
# live tree (the inventory) under a path that still exists.
REQUIRED_DATA_FILES = (
    "trends/manifest.json",
    "trends/zones.json",
    "trends/crosscheck.json",
    "latest.json",
    "hazards/floods.json",
    "hazards/landslides.json",
    "hazards/fires_grid.json",
    "hazards/cyclones.json",
    "hazards/zones.json",
    "geography/index.json",
    "geography/license.json",
    "maps/place-signals.json",
    "signals/coverage.json",
    "signals/provenance.json",
    "signals/backtest.json",
    "signals/accuracy.json",
    "signals/brief.json",
    "signals/flood-catalogue.json",
    "signals/config.json",
    "signals/meta.json",
    "intelligence/sources.json",
    "intelligence/thresholds.json",
)


def _text(path: Path) -> str:
    assert path.exists(), f"{path.relative_to(ROOT)} is missing"
    return path.read_text(encoding="utf-8")


def test_the_three_inventory_documents_exist() -> None:
    for doc in (INVENTORY, CATALOG, INTEGRATION):
        assert doc.exists(), f"{doc.relative_to(ROOT)} is missing"


def test_catalog_names_every_registered_dataset() -> None:
    catalog = _text(CATALOG).lower()
    register = json.loads((DATA / "intelligence" / "sources.json").read_text(encoding="utf-8"))
    registered = {ds["datasetId"] for ds in register["datasets"]}
    assert registered == set(REGISTERED_DATASETS), f"Register changed: {sorted(registered)}"
    missing = [name for name in REGISTERED_DATASETS if name not in catalog]
    assert not missing, "Dataset register entries missing from DATA_SOURCE_CATALOG.md: " + ", ".join(missing)


def test_inventory_lists_every_committed_hazard_and_analysis_file() -> None:
    inventory = _text(INVENTORY)
    missing = [rel for rel in REQUIRED_DATA_FILES if not (DATA / rel).exists() or rel not in inventory]
    assert not missing, "Committed data missing from RESOURCE_INVENTORY.md: " + ", ".join(missing)


def test_catalog_names_every_gibs_layer_and_its_source_url() -> None:
    catalog = _text(CATALOG)
    layers = (ROOT / "web" / "src" / "lib" / "layers.ts").read_text(encoding="utf-8")
    gibs_ids = re.findall(r'gibsId:\s*"([^"]+)"', layers)
    assert gibs_ids, "no GIBS layers found in layers.ts"
    for gibs_id in gibs_ids:
        assert gibs_id in catalog, f"GIBS layer {gibs_id} missing from DATA_SOURCE_CATALOG.md"
    source_urls = re.findall(r'sourceUrl:\s*"(https?://[^"]+)"', layers)
    for url in source_urls:
        assert url in catalog or url.split("//", 1)[1].rstrip("/") in catalog, (
            f"layer sourceUrl {url} missing from DATA_SOURCE_CATALOG.md"
        )


def test_every_hazard_dataset_stays_committed_after_its_page_was_retired() -> None:
    """The preservation rule: a retired route must not remove its own dataset."""
    for rel in (
        "hazards/floods.json",
        "hazards/landslides.json",
        "hazards/fires_grid.json",
        "hazards/cyclones.json",
        "hazards/zones.json",
    ):
        assert (DATA / rel).exists(), f"{rel} was removed with its page; datasets must be preserved"


def test_geography_licences_are_recorded_for_every_boundary_file() -> None:
    license_file = json.loads((DATA / "geography" / "license.json").read_text(encoding="utf-8"))
    files = license_file["files"]
    assert files, "geography/license.json lists no boundary files"
    unlicensed = [f["boundaryId"] for f in files if not f.get("license")]
    assert not unlicensed, f"boundary files without a licence: {unlicensed[:5]}"
    admin = sorted(p.stem for p in (DATA / "geography" / "admin").glob("*.json"))
    listed = {f["boundaryId"].split("-")[0] for f in files}
    missing = [iso for iso in admin if iso not in listed]
    assert not missing, f"admin files with no licence record: {missing[:5]}"


def test_inventory_records_the_automation_and_licence_registers() -> None:
    inventory = _text(INVENTORY)
    for needle in (
        ".github/workflows/validate.yml",
        "geography/license.json",
        "signals/provenance.json",
        "intelligence/sources.json",
    ):
        assert needle in inventory, f"{needle} missing from RESOURCE_INVENTORY.md"
    assert (ROOT / ".github" / "workflows" / "validate.yml").exists()
