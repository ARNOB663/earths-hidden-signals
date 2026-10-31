import json

import numpy as np
import pytest

from intel import geography, names
from intel.inputs import DATA


@pytest.fixture(scope="module")
def locations():
    load = lambda rel: json.loads((DATA / rel).read_text(encoding="utf-8"))  # noqa: E731
    return geography.build(load("maps/place-signals.json"), load("trends/zones.json")["zones"], load("hazards/zones.json")["zones"])


def test_city_list_is_read_from_the_web_app():
    cities = names.cities()
    assert len(cities) >= 50
    ids = [c["id"] for c in cities]
    assert "hyderabad-india" in ids and "hyderabad-pakistan" in ids
    bn = names.bangla()
    assert all(c["id"] in bn["places"] for c in cities)


def test_ids_are_unique(locations):
    ids = [loc["id"] for loc in locations]
    assert len(ids) == len(set(ids))


def test_fallback_chain(locations):
    by_id = {loc["id"]: loc for loc in locations}
    assert by_id["dhaka"]["sourceId"] == "bengal-delta" and by_id["dhaka"]["sourceKind"] == "region"
    assert by_id["kathmandu"]["sourceId"] == "central-himalaya"
    assert by_id["delhi"]["sourceId"] == "india" and by_id["delhi"]["sourceKind"] == "country"
    for outside in ("kabul", "kandahar", "yangon", "mandalay", "lhasa"):
        assert by_id[outside]["sourceId"] == "study-area", outside
    assert all(loc["fallback"] for loc in locations if loc["kind"] == "city")


def test_every_location_has_official_sources(locations):
    for loc in locations:
        assert loc["officialSources"][-1]["url"] == "https://www.gdacs.org/"


def test_coverage_counts_only_land_cells_with_values():
    weights = np.array([1.0, 1.0, 2.0, 0.0])
    series = [[1.0, 2.0], [1.0, None], None, [3.0, 4.0]]  # cell 2 is sea, cell 3 is outside
    cov = geography.coverage(weights, series, 1)
    assert cov["coveragePct"] == 50.0 and cov["cellsUsed"] == 1
    assert geography.coverage(weights, series, 0)["coveragePct"] == 100.0


def test_resolution_in_km():
    r = geography.resolution(2.0, 2.0, 0.0)
    assert r["approxKmNS"] == 222 and r["approxKmEW"] == 222
    assert geography.resolution(2.0, 2.0, 60.0)["approxKmEW"] == 111
