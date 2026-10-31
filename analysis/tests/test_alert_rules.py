from intel import alerts
from intel.thresholds import INTERNAL_ALERT_PREFIX_BN, INTERNAL_ALERT_PREFIX_EN


def r(level, direction="high", pct=50.0):
    cls = "normal" if level == 0 else "x"
    return {"available": True, "level": level, "direction": direction, "percentile": pct, "class": cls, "n": 30}


def lookup(table):
    return lambda var, period, year: table.get((var, period, year), {"available": False})


def test_wet_watch_and_warning():
    get = lookup({("rainfall", "monsoon", 2025): r(1, pct=92), ("heavy-rain", "annual", 2025): r(0)})
    assert alerts.wet(get, 2025)["severity"] == "watch"
    get = lookup({("rainfall", "monsoon", 2025): r(2, pct=96), ("heavy-rain", "annual", 2025): r(2)})
    assert alerts.wet(get, 2025)["severity"] == "warning"
    get = lookup({("rainfall", "monsoon", 2025): r(2, pct=96), ("heavy-rain", "annual", 2025): r(1)})
    assert alerts.wet(get, 2025)["severity"] == "watch"  # heavy-rain days must be unusually high for a warning
    get = lookup({("rainfall", "monsoon", 2025): r(0, pct=80)})
    assert alerts.wet(get, 2025)["severity"] is None


def test_heat_rules():
    get = lookup({("temperature", "monsoon", 2025): r(3)})
    assert alerts.heat(get, 2025, "monsoon", None)["severity"] == "warning"
    get = lookup({("temperature", "monsoon", 2025): r(2), ("temperature", "pre-monsoon", 2025): r(2)})
    assert alerts.heat(get, 2025, "monsoon", (2025, "pre-monsoon"))["severity"] == "warning"
    get = lookup({("temperature", "monsoon", 2025): r(2), ("temperature", "pre-monsoon", 2025): r(1)})
    assert alerts.heat(get, 2025, "monsoon", (2025, "pre-monsoon"))["severity"] == "watch"
    get = lookup({("temperature", "monsoon", 2025): r(2, "low")})
    assert alerts.heat(get, 2025, "monsoon", None)["severity"] is None


def test_dry_needs_both_conditions_and_escalates():
    dry_year = {("rainfall", "monsoon", 2025): r(1, "low", pct=8), ("dry-spell", "annual", 2025): r(2)}
    assert alerts.dry(lookup(dry_year), 2025)["severity"] == "watch"
    both = {**dry_year, ("rainfall", "monsoon", 2024): r(1, "low", pct=5), ("dry-spell", "annual", 2024): r(2)}
    assert alerts.dry(lookup(both), 2025)["severity"] == "warning"
    no_spell = {("rainfall", "monsoon", 2025): r(1, "low", pct=8), ("dry-spell", "annual", 2025): r(0)}
    assert alerts.dry(lookup(no_spell), 2025)["severity"] is None


def test_wildfire_requires_link():
    get = lookup({("temperature", "pre-monsoon", 2025): r(1), ("rainfall", "pre-monsoon", 2025): r(1, "low")})
    assert alerts.wildfire(get, 2025, True)["severity"] == "watch"
    assert alerts.wildfire(get, 2025, False)["severity"] is None
    assert alerts.wildfire(get, 2025, None)["severity"] == "watch"  # backtest: link not applied
    one = lookup({("temperature", "pre-monsoon", 2025): r(1), ("rainfall", "pre-monsoon", 2025): r(0)})
    assert alerts.wildfire(one, 2025, True)["severity"] == "info"


def test_cyclone_uses_linked_driver_percentile():
    d = {"linked": True, "latest": {"year": 2025, "percentile": 93}, "highEventYearsPercentile": 60}
    assert alerts.cyclone(d, 2025)["severity"] == "watch"
    assert alerts.cyclone({**d, "linked": False}, 2025)["severity"] is None
    assert alerts.cyclone({**d, "latest": {"year": 2025, "percentile": 40}}, 2025)["severity"] is None


def step(year, sev):
    return {"year": year, "period": "monsoon", "severity": sev, "evidence": [{"percentile": 95.0, "n": 30}]}


def test_lifecycle_no_duplicates_supersede_and_expire():
    steps = [step(2020, "watch"), step(2021, "watch"), step(2022, "warning"), step(2023, None), step(2024, "watch"), step(2025, "watch")]
    out = alerts.lifecycle("loc", "flood", steps, (2025, "monsoon"), ("Place", "স্থান"))
    assert [a["severity"] for a in out] == ["watch", "warning", "watch"]
    first, second, third = out
    assert first["occurrences"] == ["2020-monsoon", "2021-monsoon"]  # re-detection extends, no duplicate
    assert first["closedReason"] == "superseded" and first["supersededBy"] == second["id"]
    assert second["closedReason"] == "expired" and second["closedAt"] == "2023-monsoon"
    assert third["status"] == "active" and third["lastSeenPeriod"] == "2025-monsoon"
    assert first["reconstructed"] and second["reconstructed"] and not third["reconstructed"]
    assert len({a["id"] for a in out}) == len(out)


def test_internal_alert_text_says_not_confirmed():
    out = alerts.lifecycle("loc", "heat", [step(2025, "watch")], (2025, "monsoon"), ("Place", "স্থান"))
    assert out[0]["textEn"].startswith(INTERNAL_ALERT_PREFIX_EN)
    assert out[0]["textBn"].startswith(INTERNAL_ALERT_PREFIX_BN)
    assert "official" not in out[0]["textEn"].lower()


def test_gdacs_records_become_official_alerts():
    floods = [{"date": "2025-07-01", "end": "2025-07-10", "lat": 23.5, "lon": 90.0, "alert": "Orange", "title": "Flood in Bangladesh", "country": "Bangladesh"},
              {"date": "2024-07-01", "lat": 23.5, "lon": 90.0, "alert": "Red", "title": "Old", "country": "Bangladesh"},
              {"date": "2025-08-01", "lat": 10.0, "lon": 70.0, "alert": "Green", "title": "Elsewhere", "country": "X"}]
    out = alerts.official_alerts("bd", floods, lambda la, lo: 20 <= la <= 27 and 88 <= lo <= 93, "2025-01-01", "2025-12-31")
    assert len(out) == 1
    a = out[0]
    assert a["official"] is True and a["kind"] == "official" and a["alertLevel"] == "Orange"
    assert "GDACS" in a["provider"] and a["textEn"].startswith("Official GDACS")
