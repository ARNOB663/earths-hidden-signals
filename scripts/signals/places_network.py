"""Network refresh for /signals/place Next and Evidence strips (plan: signals trust axis).

Only ``place.py --refresh`` calls this. The committed outputs are cached under
``scripts/signals/raw/`` (gitignored) and written into ``web/public/data/signals/places/`` so the
normal offline build and the CI byte-identical gate never touch the network.

Sources:

* Next — Open-Meteo forecast (`config.json` → ``outlook``), the same external rain outlook as
  ``outlook.py``: rain only, never a status, ``usedInStatus: false``.
* Evidence — Open-Meteo's historical rain archive, a different product from IMERG, marked as such.
  Flood years come from the GDACS flood catalogue queried in <= 3-month chunks (the wide window
  returns non-JSON), recorded as catalogue years without a place name.
"""

from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
CACHE = HERE / "raw" / "places"
OUT = ROOT / "web" / "public" / "data" / "signals" / "places"
UA = {"User-Agent": "earth-hidden-signals/0.1 (signals pipeline)"}
ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"
GDACS = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH"
EVIDENCE_YEARS = 15
CHUNK_MONTHS = 3
# The archive's own latest complete year; using the last year only after it is over avoids a row
# that is three-quarters of a year against twelve.
ARCHIVE_LAST_COMPLETE = dt.date(2025, 12, 31)


def _get_json(url: str, params: dict, *, tries: int = 2) -> dict | None:
    for _ in range(tries):
        try:
            response = requests.get(url, params=params, headers=UA, timeout=30)
            response.raise_for_status()
            return response.json()
        except (requests.RequestException, ValueError):
            continue
    return None


def next_for(centre: list[float], outlook: dict) -> dict | None:
    """7-day rain for the area's centre; None when the provider is unreachable."""
    payload = _get_json(
        outlook["url"],
        {
            "latitude": centre[0],
            "longitude": centre[1],
            "daily": "precipitation_sum",
            "forecast_days": outlook["days"],
            "timezone": "GMT",
        },
    )
    if not payload or "daily" not in payload:
        return None
    days = payload["daily"]["time"]
    rain = payload["daily"]["precipitation_sum"]
    total = round(sum(v for v in rain if v is not None), 1) if any(v is not None for v in rain) else None
    return {
        "provider": "Open-Meteo (CC-BY 4.0)",
        "fetchedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "days": [{"date": d, "mm": None if v is None else round(float(v), 1)} for d, v in zip(days, rain)],
        "totalMm": total,
        "label": outlook.get("label", "Outlook from an external public source, not our signal and not an official warning."),
        "usedInStatus": False,
    }


def evidence_for(centre: list[float], end: dt.date) -> list[dict]:
    """Each of the last EVIDENCE_YEARS years' rain at the centre, with gaps left as null."""
    start = end.replace(year=end.year - EVIDENCE_YEARS) + dt.timedelta(days=1)
    payload = _get_json(
        ARCHIVE,
        {
            "latitude": centre[0],
            "longitude": centre[1],
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "daily": "precipitation_sum",
            "timezone": "GMT",
        },
    )
    if not payload or "daily" not in payload:
        return []
    sums: dict[int, float] = {}
    seen: dict[int, int] = {}
    for day, value in zip(payload["daily"]["time"], payload["daily"]["precipitation_sum"]):
        year = int(day[:4])
        seen[year] = seen.get(year, 0) + 1
        if value is not None:
            sums[year] = sums.get(year, 0.0) + float(value)
    years = []
    for year in range(start.year, end.year + 1):
        # A year is usable when the archive has at least 300 days of it; a short year is a gap.
        complete = seen.get(year, 0) >= 300
        years.append({"year": year, "mm": round(sums[year], 0) if complete and year in sums else None})
    return years


def gdacs_flood_years(config: dict, start: dt.date, end: dt.date) -> dict:
    """{event id: {start, lat, lon, tile}} for GDACS floods inside the enabled tiles."""
    cache = CACHE / f"gdacs_fl_{start:%Y%m%d}_{end:%Y%m%d}.json"
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    tiles = config["enabledTiles"]
    seen: dict[str, dict] = {}
    cursor = start
    while cursor < end:
        month = cursor.month + CHUNK_MONTHS
        year = cursor.year + (month - 1) // 12
        month = (month - 1) % 12 + 1
        nxt = min(dt.date(year, month, min(cursor.day, 28)), end)
        payload = _get_json(GDACS, {"eventlist": "FL", "fromdate": cursor.isoformat(), "todate": nxt.isoformat()})
        for feature in (payload or {}).get("features", []):
            props = feature["properties"]
            lon, lat = feature["geometry"]["coordinates"][:2]
            tile = next(
                (t["id"] for t in tiles if t["south"] <= lat <= t["north"] and t["west"] <= lon <= t["east"]),
                None,
            )
            if tile is None:
                continue
            key = f"gdacs-{props['eventid']}-{props['fromdate'][:10]}"
            seen[key] = {"id": key, "start": props["fromdate"][:10], "lat": round(lat, 3), "lon": round(lon, 3), "tile": tile}
        cursor = nxt
    CACHE.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(seen, sort_keys=True), encoding="utf-8")
    return seen


def refresh(config: dict, *, limit: int | None = None, resume: bool = True) -> None:
    places_file = ROOT / "web" / "public" / "data" / "signals" / "places.json"
    if not places_file.exists():
        raise SystemExit("run place.py first: places.json is the area list to enrich")
    places = json.loads(places_file.read_text(encoding="utf-8"))
    outlook = config["outlook"]
    today = dt.date.today()
    events = gdacs_flood_years(config, dt.date(today.year - EVIDENCE_YEARS - 1, 1, 1), today)
    event_years = sorted(int(e["start"][:4]) for e in events.values())
    last_complete = min(today - dt.timedelta(days=1), ARCHIVE_LAST_COMPLETE)
    OUT.mkdir(parents=True, exist_ok=True)
    written = 0
    unavailable = 0
    for area in places["areas"]:
        target = OUT / f"{area['id']}.json"
        if resume and target.exists():
            continue
        if limit is not None and written >= limit:
            break
        centre = area["centre"]
        nxt = next_for(centre, outlook) if outlook.get("enabled") else None
        years = evidence_for(centre, last_complete)
        if nxt is None:
            unavailable += 1
        if not years:
            # Nothing usable came back: leave no file, so the page says "not built" rather than
            # showing an empty chart it cannot fill.
            continue
        payload = {
            "schema": "signals-place-extras-v1",
            "id": area["id"],
            "name": area["name"],
            "country": area["country"],
            "fetchedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
            "next": nxt,
            "nextNote": None if nxt else "Outlook unavailable from the provider at build time; the strip is omitted rather than guessed.",
            "evidence": {
                "product": "Open-Meteo historical rain archive (reanalysis, model-based)",
                "note": "A different product from our IMERG signal. It shows the years we can compare, not a measured satellite record.",
                "years": years,
                "gaps": [y["year"] for y in years if y["mm"] is None],
                "floodYears": [y for y in event_years if years and years[0]["year"] <= y <= years[-1]["year"]],
                "floodEvents": [e for e in events.values() if years and years[0]["year"] <= int(e["start"][:4]) <= years[-1]["year"]],
                "floodNote": "Flood years come from the GDACS flood catalogue. A missing year is a gap in the catalogue, not a year without floods.",
            },
        }
        target.write_text(json.dumps(payload, separators=(",", ":"), sort_keys=True), encoding="utf-8")
        written += 1
    sources_path = ROOT / "web" / "public" / "data" / "signals" / "sources.json"
    if sources_path.exists():
        sources = json.loads(sources_path.read_text(encoding="utf-8"))
        today_iso = today.isoformat()
        sources["outlook-open-meteo"] = {
            "checkedOn": today_iso,
            "sample": False,
            "status": "integrated",
            "url": "https://open-meteo.com/",
            "license": "CC-BY 4.0",
            "product": "Forecast (7-day) and historical rain archive (reanalysis)",
            "cadence": "Forecast hourly; archive updated daily with a ~5-day delay",
            "use": "Next strip (7-day rain outlook, external, never a status) and Evidence strip (past years' rain, a different product from IMERG)",
            "perPlace": "signals/places/{area}.json",
        }
        sources["gdacs-flood"] = {
            "checkedOn": today_iso,
            "sample": False,
            "status": "integrated",
            "url": "https://www.gdacs.org/",
            "product": "Flood event catalogue (FL)",
            "cadence": "Updated as events are reported",
            "use": "Evidence strip flood years and the replayed flood events on /accuracy",
            "note": "A missing year in a point query is a catalogue gap, not a year without floods.",
        }
        sources_path.write_text(json.dumps(sources, ensure_ascii=False, sort_keys=True), encoding="utf-8")
    print(f"extras: {written} written, {unavailable} without outlook, {len(events)} GDACS floods in the tiles")


if __name__ == "__main__":
    import tiles as tiles_mod

    refresh(tiles_mod.load_config())
