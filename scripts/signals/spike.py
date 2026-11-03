#!/usr/bin/env python3
"""Spike: link check, auth probe, GDACS and EONET shape (plan rev. 7, step 0).

Standalone on purpose: standard library only, so it runs before any requirements install,
and it never imports from analysis/ (the pipeline is a separate, self-contained tree).

    python3 scripts/signals/spike.py --check-links
    python3 scripts/signals/spike.py --check-auth
    python3 scripts/signals/spike.py --gdacs
    python3 scripts/signals/spike.py --eonet

Exit codes: 0 = every probe usable, 1 = at least one probe unusable, 2 = interrupted.
Secrets are read from the environment and never printed.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import socket
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

UA = "earth-hidden-signals-spike/0.1 (NASA Space Apps 2026)"
TIMEOUT = 40
MAX_BYTES = 4 * 1024 * 1024  # read at most this much of any body; we only need a sample
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "raw")
REPORT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "spike_report.md")

# --------------------------------------------------------------------------------------
# Links to check. Each entry: name, url, tier, auth, expect, mode
#   mode "http": GET, no auth, record status/type/size
#   mode "ppe":  PPS basic-auth path; without credentials an unauthorised answer is the
#                expected result, so 401/403 counts as "auth required", not a dead link
#   mode "ed":   Earthdata-protected page; a browser usually sees HTML that redirects to
#                login. Any answer that is not 404/410 counts as alive.
# Expect: what a healthy answer looks like ("html", "xml", "json", "text", "binary", "dir").
# --------------------------------------------------------------------------------------
LINKS: list[dict[str, str]] = [
    # --- Tier A -------------------------------------------------------------------------
    {"name": "A1  IMERG Late/Early GIS dir (PPS)", "url": "https://jsimpsonhttps.pps.eosdis.nasa.gov/imerg/gis/", "tier": "A", "auth": "PPS basic", "expect": "dir", "mode": "ppe"},
    {"name": "A1b PPS registration", "url": "https://registration.pps.eosdis.nasa.gov/registration/", "tier": "A", "auth": "none", "expect": "html", "mode": "http"},
    {"name": "A1c IMERG docs", "url": "https://gpm.nasa.gov/data/imerg", "tier": "A", "auth": "none", "expect": "html", "mode": "http"},
    {"name": "A2  IMERG Final V07 dataset page", "url": "https://disc.gsfc.nasa.gov/datasets/GPM_3IMERGDF_07/summary", "tier": "A", "auth": "earthdata", "expect": "html", "mode": "ed"},
    {"name": "A2  IMERG Final V07 GES DISC dir", "url": "https://gpm1.gesdisc.eosdis.nasa.gov/data/GPM_L3/GPM_3IMERGDF.07/", "tier": "A", "auth": "earthdata", "expect": "dir", "mode": "ed"},
    {"name": "A2b Earthdata Login", "url": "https://urs.earthdata.nasa.gov/", "tier": "A", "auth": "none", "expect": "html", "mode": "http"},
    {"name": "A2c AWS Open Data registry (home)", "url": "https://registry.opendata.aws/", "tier": "A", "auth": "none", "expect": "html", "mode": "http"},
    {"name": "A3  GIBS WMTS the best (root)", "url": "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/", "tier": "A", "auth": "none", "expect": "xml", "mode": "http"},
    {"name": "A3  GIBS GetCapabilities", "url": "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml", "tier": "A", "auth": "none", "expect": "xml", "mode": "http"},
    {"name": "A3c GIBS colormap (IMERG rate; real id is GPM_Precipitation_Rate)", "url": "https://gibs.earthdata.nasa.gov/colormaps/v1.3/GPM_Precipitation_Rate.xml", "tier": "A", "auth": "none", "expect": "xml", "mode": "http"},
    {"name": "A3d GIBS API docs", "url": "https://nasa-gibs.github.io/gibs-api-docs/", "tier": "A", "auth": "none", "expect": "html", "mode": "http"},
    {"name": "A4  LANCE MCDWD_L3_NRT dir", "url": "https://nrt3.modaps.eosdis.nasa.gov/archive/allData/61/MCDWD_L3_NRT/", "tier": "A", "auth": "none", "expect": "dir", "mode": "http"},
    {"name": "A4b LANCE VIIRS VCDWD short-name listing", "url": "https://nrt3.modaps.eosdis.nasa.gov/archive/allData/5200/", "tier": "A", "auth": "earthdata", "expect": "dir", "mode": "ed"},
    {"name": "A4c LANCE FLOOD viewer", "url": "https://lance.modaps.eosdis.nasa.gov/flood/", "tier": "A", "auth": "none", "expect": "html", "mode": "http"},
    {"name": "A5  SMAP NRT SPL2SMP_NRT.107 dir", "url": "https://n5eil01u.ecs.nsidc.org/SMAP/SPL2SMP_NRT.107/", "tier": "A", "auth": "earthdata", "expect": "dir", "mode": "ed"},
    {"name": "A6  NASA Worldview", "url": "https://worldview.earthdata.nasa.gov/", "tier": "A", "auth": "none", "expect": "html", "mode": "http"},
    {"name": "A7  GDACS home", "url": "https://www.gdacs.org/", "tier": "A", "auth": "none", "expect": "html", "mode": "http"},
    {"name": "A7  GDACS SEARCH API", "url": "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH", "tier": "A", "auth": "none", "expect": "json", "mode": "http"},
    {"name": "A7  GDACS RSS 7d", "url": "https://www.gdacs.org/xml/rss_7d.xml", "tier": "A", "auth": "none", "expect": "xml", "mode": "http"},
    {"name": "A7b WMO SWIC", "url": "https://severeweather.wmo.int/", "tier": "A", "auth": "none", "expect": "html", "mode": "http"},
    {"name": "A7c Open-Meteo geocoding (sample query)", "url": "https://geocoding-api.open-meteo.com/v1/search?name=Dhaka&count=1&language=en&format=json", "tier": "A", "auth": "none", "expect": "json", "mode": "http"},
    {"name": "A7d Nominatim (manual fallback)", "url": "https://nominatim.openstreetmap.org/search?q=Dhaka&format=json&limit=1", "tier": "A", "auth": "none", "expect": "json", "mode": "http"},
    # --- Tier B -------------------------------------------------------------------------
    {"name": "B1  EONET v3 events", "url": "https://eonet.gsfc.nasa.gov/api/v3/events?days=30", "tier": "B", "auth": "none", "expect": "json", "mode": "http"},
    {"name": "B2  OPERA DSWx product page", "url": "https://www.jpl.nasa.gov/go/opera/products/dswx-product-suite/", "tier": "B", "auth": "none", "expect": "html", "mode": "http"},
    {"name": "B3  NASADEM product page", "url": "https://lpdaac.usgs.gov/products/nasadem_hgtv001/", "tier": "B", "auth": "none", "expect": "html", "mode": "http"},
    {"name": "B4  SEDAC GPWv4 collection", "url": "https://sedac.ciesin.columbia.edu/data/collection/gpw-v4", "tier": "B", "auth": "none", "expect": "html", "mode": "http"},
    {"name": "B5  NASA POWER API docs", "url": "https://power.larc.nasa.gov/docs/services/api/", "tier": "B", "auth": "none", "expect": "html", "mode": "http"},
    {"name": "B5  NASA POWER daily point query", "url": "https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR&community=RE&longitude=90.41&latitude=23.81&start=20240720&end=20240725&format=JSON", "tier": "B", "auth": "none", "expect": "json", "mode": "http"},
    # --- Tooling / independent station checks ------------------------------------------
    {"name": "T   CMR search", "url": "https://cmr.earthdata.nasa.gov/search/", "tier": "T", "auth": "none", "expect": "html", "mode": "http"},
    {"name": "T   CMR collections API", "url": "https://cmr.earthdata.nasa.gov/search/collections.json?short_name=GPM_3IMERGDF&version=07", "tier": "T", "auth": "none", "expect": "json", "mode": "http"},
    {"name": "T   CMR IMERG Late collections", "url": "https://cmr.earthdata.nasa.gov/search/collections.json?short_name=GPM_3IMERGDL", "tier": "T", "auth": "none", "expect": "json", "mode": "http"},
    {"name": "T   earthaccess docs", "url": "https://earthaccess.readthedocs.io/en/latest/", "tier": "T", "auth": "none", "expect": "html", "mode": "http"},
    {"name": "T   Harmony", "url": "https://harmony.earthdata.nasa.gov/", "tier": "T", "auth": "none", "expect": "html", "mode": "http"},
    {"name": "T   Earthdata Search", "url": "https://search.earthdata.nasa.gov/", "tier": "T", "auth": "none", "expect": "html", "mode": "http"},
    {"name": "T   ASF", "url": "https://asf.alaska.edu/", "tier": "T", "auth": "none", "expect": "html", "mode": "http"},
    {"name": "T   LP DAAC", "url": "https://lpdaac.usgs.gov/", "tier": "T", "auth": "none", "expect": "html", "mode": "http"},
    {"name": "T   Giovanni", "url": "https://giovanni.gsfc.nasa.gov/giovanni/", "tier": "T", "auth": "none", "expect": "html", "mode": "http"},
    {"name": "T   NCEI GHCN-Daily access (independent station check)", "url": "https://www.ncei.noaa.gov/pub/data/ghcn/daily/by_station/", "tier": "T", "auth": "none", "expect": "dir", "mode": "http"},
    {"name": "T   NCEI GHCN-Daily station list", "url": "https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-stations.txt", "tier": "T", "auth": "none", "expect": "text", "mode": "http"},
    # --- Deliberately checked dead links -------------------------------------------------
    {"name": "X   Disasters Mapping Portal IMERG ImageServer (expected dead)", "url": "https://maps.disasters.nasa.gov/arcgis/rest/services/IMERG", "tier": "X", "auth": "none", "expect": "html", "mode": "http"},
]

# Optional probes that need credentials. Kept apart so --check-links stays keyless.
AUTH_PROBES = [
    {"name": "PPS basic (IMERG Late GIS)", "url": "https://jsimpsonhttps.pps.eosdis.nasa.gov/imerg/gis/", "kind": "pps"},
    {"name": "PPS basic (IMERG Early GIS)", "url": "https://jsimpsonhttps.pps.eosdis.nasa.gov/imerg/gis/early/", "kind": "pps"},
    {"name": "Earthdata token (GES DISC Final listing)", "url": "https://gpm1.gesdisc.eosdis.nasa.gov/data/GPM_L3/GPM_3IMERGDF.07/", "kind": "ed"},
    {"name": "Earthdata token (GES DISC OPeNDAP Final)", "url": "https://gpm1.gesdisc.eosdis.nasa.gov/opendap/GPM_L3/GPM_3IMERGDF.07/", "kind": "ed"},
    {"name": "Earthdata token (LANCE VIIRS archive)", "url": "https://nrt3.modaps.eosdis.nasa.gov/archive/allData/5200/", "kind": "ed"},
    {"name": "Earthdata token (SMAP NRT dir)", "url": "https://n5eil01u.ecs.nsidc.org/SMAP/SPL2SMP_NRT.107/", "kind": "ed"},
]


# --------------------------------------------------------------------------------------
# HTTP helpers
# --------------------------------------------------------------------------------------
def _basic(user: str, password: str) -> str:
    import base64

    return "Basic " + base64.b64encode(f"{user}:{password}".encode()).decode()


def fetch(url: str, *, headers: dict[str, str] | None = None, max_bytes: int = MAX_BYTES) -> dict:
    """GET url and return a small record; never raises on HTTP errors."""
    request = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    started = time.monotonic()
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            status = response.status
            final_url = response.geturl()
            body = response.read(max_bytes)
            content_type = response.headers.get("Content-Type", "")
            encoding = response.headers.get("Content-Encoding", "")
    except urllib.error.HTTPError as error:
        status = error.code
        final_url = url
        body = error.read(max_bytes) if error.fp else b""
        content_type = error.headers.get("Content-Type", "") if error.headers else ""
        encoding = ""
    except (urllib.error.URLError, socket.timeout, TimeoutError, OSError) as error:
        return {"status": "ERR", "seconds": time.monotonic() - started, "error": str(error), "body": b"", "type": "", "final": url, "encoding": ""}
    return {
        "status": status,
        "seconds": round(time.monotonic() - started, 2),
        "body": body,
        "type": content_type.split(";")[0].strip(),
        "final": final_url,
        "encoding": encoding,
    }


def fetch_stream(url: str, path: str, *, max_bytes: int) -> dict:
    """GET a large body straight to disk (fixtures above the 4 MB in-memory cap)."""
    request = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    started = time.monotonic()
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            written = 0
            with open(path, "wb") as handle:
                while written < max_bytes:
                    chunk = response.read(1 << 16)
                    if not chunk:
                        break
                    handle.write(chunk)
                    written += len(chunk)
            return {"status": response.status, "ok": 200 <= response.status < 300, "bytes": written,
                    "seconds": time.monotonic() - started, "path": path}
    except (urllib.error.HTTPError, urllib.error.URLError, socket.timeout, TimeoutError, OSError) as error:
        status = getattr(error, "code", "ERR")
        return {"status": status, "ok": False, "bytes": 0, "seconds": time.monotonic() - started, "path": path}


def looks_like_body(body: bytes, expected: str) -> str:
    """A rough format guess so the report says what came back, not just the status."""
    head = body[:2000].lstrip().lower()
    if not head:
        return "empty"
    if expected == "dir":
        return "listing" if (b"<pre" in head or b"<a href" in head or b"<html" in head) else "not a listing"
    if expected == "json":
        return "json" if head[:1] in (b"{", b"[") else "not json"
    if expected == "xml":
        return "xml" if b"<?xml" in head else "not xml"
    if expected == "html":
        return "html" if b"<html" in head or b"<!doctype" in head or b"<body" in head else "not html"
    return "binary" if b"\x00" in head else "text"


def human_bytes(size: int | float) -> str:
    if size < 1024:
        return f"{size:.0f} B"
    for unit in ("KB", "MB", "GB"):
        size /= 1024
        if size < 1024:
            return f"{size:.1f} {unit}"
    return f"{size:.1f} TB"


def has_creds(kind: str) -> bool:
    if kind == "pps":
        return bool(os.environ.get("PPS_USERNAME") and os.environ.get("PPS_PASSWORD"))
    return bool(os.environ.get("EARTHDATA_TOKEN"))


def auth_headers(kind: str) -> dict[str, str]:
    if kind == "pps":
        return {"Authorization": _basic(os.environ["PPS_USERNAME"], os.environ["PPS_PASSWORD"])}
    return {"Authorization": f"Bearer {os.environ['EARTHDATA_TOKEN']}"}


# --------------------------------------------------------------------------------------
# --check-links
# --------------------------------------------------------------------------------------
def record_table(row: list[str]) -> str:
    return "| " + " | ".join(row) + " |"


# Links whose public page answers a bot/API-shaped request but a browser-shaped one works.
# HTTP 403/406 there means "varies by client", not "gone"; the notes section says so.
BROWSER_ONLY = {"B2  OPERA DSWx product page", "B4  SEDAC GPWv4 collection"}


def check_links() -> int:
    os.makedirs(OUT_DIR, exist_ok=True)
    rows = ["| name | URL | HTTP | auth | format | size | s | usable |", "|---|---|---|---|---|---|---|---|"]
    notes: list[str] = []
    failures = 0
    for link in LINKS:
        headers = {"Accept": "*/*"}
        if link["mode"] == "ed":
            headers["Accept"] = "text/html,application/xhtml+xml,*/*"
        result = fetch(link["url"], headers=headers)
        body = result["body"]
        status = result["status"]
        fmt = looks_like_body(body, link["expect"])
        size = human_bytes(len(body))
        if result.get("encoding"):
            size += f" ({result['encoding']})"
        if status == "ERR":
            usable = "no: " + result.get("error", "")[:70]
        elif status in (401, 403):
            usable = "yes, needs auth" if link["mode"] in ("ppe", "ed") else "no: forbidden"
        elif status in (404, 410):
            usable = "no: gone"
        elif isinstance(status, int) and 200 <= status < 400:
            usable = "yes"
        else:
            usable = f"check ({status})"
        if link["mode"] == "ed" and status in (401, 403, 302, 303):
            usable = "yes (login-protected; --check-auth tests access)"
        if link["name"] in BROWSER_ONLY and status in (403, 406, "ERR"):
            usable = f"browser-only ({status}); open in a browser"
        if link["tier"] == "X":
            usable = "expected dead (baseline)" if status in (404, 410) else "unexpectedly alive"
        rows.append(record_table([link["name"], link["url"], str(status), link["auth"], fmt, size, str(result["seconds"]), usable]))
        if not usable.startswith(("yes", "expected dead")):
            notes.append(f"- {link['name']}: {usable} at {link['url']}. Try a browser user agent or CMR before marking not-integrated.")
            failures += 1
    print("\n".join(rows))
    if notes:
        print("\nNeeds attention:")
        print("\n".join(notes))
    write_report_section("Link check", "\n".join(rows) + ("\n\nNeeds attention:\n" + "\n".join(notes) if notes else ""))
    return failures


def save_sample(name: str, body: bytes, content_type: str) -> str:
    """Keep a small fixture so later tests can parse the real shape offline."""
    if not body:
        return ""
    os.makedirs(OUT_DIR, exist_ok=True)
    head = body[:200].lstrip()
    if "json" in content_type or head[:1] in (b"{", b"["):
        extension = ".json"
    elif "xml" in content_type or b"<?xml" in head:
        extension = ".xml"
    else:
        extension = ".txt"
    path = os.path.join(OUT_DIR, name + extension)
    with open(path, "wb") as handle:
        handle.write(body[: 256 * 1024])
    return path


# --------------------------------------------------------------------------------------
# --check-auth  (prints OK / rejected / expired only)
# --------------------------------------------------------------------------------------
def check_auth() -> int:
    failures = 0
    missing = 0
    rows = ["| probe | result | HTTP |", "|---|---|---|"]
    for probe in AUTH_PROBES:
        kind = probe["kind"]
        if not has_creds(kind):
            result = "no credentials in this environment"
            status = "-"
            missing += 1
        else:
            outcome = fetch(probe["url"], headers=auth_headers(kind))
            status = outcome["status"]
            if status == "ERR":
                result = "network error"
            elif 200 <= status < 300:
                result = "OK"
            elif status in (401, 403):
                body = outcome["body"][:400].lower()
                if b"expired" in body or b"token expired" in body:
                    result = "expired"
                else:
                    result = "rejected"
            elif status in (302, 303):
                result = "rejected (redirected to login)"
            elif status == 404:
                result = "OK (path not found, auth accepted)"
            else:
                result = f"unexpected ({status})"
            if result != "OK" and not result.startswith("OK"):
                failures += 1
        rows.append(record_table([probe["name"], result, str(status)]))
    print("\n".join(rows))
    if missing:
        print(f"\n{missing} probe(s) had no credentials. Set PPS_USERNAME, PPS_PASSWORD, EARTHDATA_TOKEN and rerun.")
    write_report_section("Auth probe", "\n".join(rows) + (f"\n\n{missing} probe(s) had no credentials in this environment." if missing else ""))
    return failures + (1 if missing else 0)


# --------------------------------------------------------------------------------------
# --gdacs  /  --eonet  (shape probes, store fixtures)
# --------------------------------------------------------------------------------------
def _first_keys(payload: object, depth: int = 0) -> str:
    if isinstance(payload, dict):
        keys = list(payload)[:12]
        return ", ".join(keys)
    if isinstance(payload, list):
        return f"list[{len(payload)}]"
    return type(payload).__name__


def probe_gdacs() -> int:
    rows = ["| source | HTTP | format | size | usable | sample fields |", "|---|---|---|---|---|---|"]
    api = fetch("https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH", headers={"Accept": "application/json"})
    payload = None
    fields = ""
    try:
        payload = json.loads(api["body"]) if api["body"] else None
        features = (payload or {}).get("features") if isinstance(payload, dict) else payload
        if isinstance(features, list) and features:
            props = features[0].get("properties", {})
            geom = features[0].get("geometry", {})
            fields = f"{len(features)} features; props: {_first_keys(props)}; geom: {geom.get('type')}; coords: {str(geom.get('coordinates'))[:80]}"
    except (ValueError, AttributeError) as error:
        fields = f"parse failed: {error}"
    save_sample("gdacs_search", api["body"], api["type"])
    rows.append(record_table(["GDACS SEARCH JSON", str(api["status"]), looks_like_body(api["body"], "json"), human_bytes(len(api["body"])), "yes" if fields and "parse failed" not in fields else "no", fields]))
    if isinstance(payload, dict) and isinstance(payload.get("features"), list) and payload["features"]:
        flood_sample = [f for f in payload["features"] if f.get("properties", {}).get("eventtype") == "FL"][:3]
        if flood_sample:
            save_sample("gdacs_flood_features", json.dumps(flood_sample, indent=1).encode(), "application/json")
        rows.append(record_table(["flood features in this response", str(api["status"]), "json", "-", "yes" if flood_sample else "no",
                                  ", ".join(f"{f['properties']['fromdate'][:10]} {f['properties']['eventid']} at {f['geometry'].get('coordinates')}" for f in flood_sample)]))

    rss = fetch("https://www.gdacs.org/xml/rss_7d.xml", headers={"Accept": "application/xml"})
    items = len(re.findall(rb"<item>", rss["body"]))
    save_sample("gdacs_rss_7d", rss["body"], rss["type"])
    rows.append(record_table(["GDACS RSS 7d", str(rss["status"]), looks_like_body(rss["body"], "xml"), human_bytes(len(rss["body"])), "yes" if items else "no", f"{items} items"]))

    rss_all = fetch("https://www.gdacs.org/xml/rss.xml", headers={"Accept": "application/xml"})
    all_items = len(re.findall(rb"<item>", rss_all["body"]))
    rows.append(record_table(["GDACS RSS (all)", str(rss_all["status"]), looks_like_body(rss_all["body"], "xml"), human_bytes(len(rss_all["body"])), "yes" if all_items else "no", f"{all_items} items"]))

    # Dated history probe: the API accepts fromdate/todate, which is what replays need.
    history_queries = [("2015-01-01", "2015-03-01"), ("2004-01-01", "2004-03-01")]
    for start, end in history_queries:
        url = f"https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=FL&fromdate={start}&todate={end}"
        history = fetch(url, headers={"Accept": "application/json"})
        try:
            history_payload = json.loads(history["body"])
            events = history_payload.get("features", [])
            detail = ", ".join(f"{e['properties']['eventid']}:{e['properties']['fromdate'][:10]}" for e in events[:4]) or "no events"
        except ValueError:
            detail = "parse failed"
        if start.startswith("2015"):
            save_sample("gdacs_fl_2015Q1", history["body"], history["type"])
        rows.append(record_table([f"GDACS FL history {start[:4]} Q1", str(history["status"]), looks_like_body(history["body"], "json"), human_bytes(len(history["body"])), "yes" if detail not in ("parse failed", "no events") else "no", detail]))

    # Footnote: the archive page is the fallback when the API has no history.
    fallback = fetch("https://www.gdacs.org/report.aspx?eventid=4219&eventtype=FL&episodeid=0", headers={"Accept": "text/html"})
    rows.append(record_table(["GDACS report.aspx (fallback shape)", str(fallback["status"]), looks_like_body(fallback["body"], "html"), human_bytes(len(fallback["body"])), "yes" if fallback["status"] == 200 else "no", "record page for a known event"]))

    print("\n".join(rows))
    write_report_section("GDACS shape", "\n".join(rows) + """

Decision rule (rev. 7 §4a-f): SEARCH gives dated flood features whose `properties` carry
`eventtype`, `fromdate`, `todate`, `country`, `htmldescription` and whose geometry carries
coordinates → replays use GDACS events. If SEARCH stays empty, use `rss.xml` / per-event
`report.aspx` pages and cross-check with EONET.
""")
    return 0 if fields and "parse failed" not in fields else 1


def probe_eonet() -> int:
    rows = ["| source | HTTP | format | size | usable | sample fields |", "|---|---|---|---|---|---|"]
    events = fetch("https://eonet.gsfc.nasa.gov/api/v3/events?days=60", headers={"Accept": "application/json"})
    try:
        payload = json.loads(events["body"])
        count = len(payload.get("events", []))
        first = payload.get("events", [{}])[0] if count else {}
        detail = f"{count} events; fields: {_first_keys(first)}; categories: {_first_keys(first.get('categories', []))}; geom: {_first_keys((first.get('geometry') or [{}])[0])}"
        usable = "yes" if count else "no events in window (API alive)"
    except ValueError as error:
        detail = f"parse failed: {error}"
        usable = "no"
    save_sample("eonet_events", events["body"], events["type"])
    rows.append(record_table(["EONET v3 events", str(events["status"]), looks_like_body(events["body"], "json"), human_bytes(len(events["body"])), usable, detail]))

    floods = fetch("https://eonet.gsfc.nasa.gov/api/v3/categories/floods", headers={"Accept": "application/json"})
    try:
        flood_payload = json.loads(floods["body"])
        flood_count = flood_payload.get("events", []) and len(flood_payload["events"])
    except ValueError:
        flood_count = 0
    rows.append(record_table(["EONET v3 category floods", str(floods["status"]), looks_like_body(floods["body"], "json"), human_bytes(len(floods["body"])), "yes" if flood_count else "no flood events listed", f"{flood_count or 0} events"]))

    # Closed-flood lookup: replays need dated, *closed* flood events. The body is ~10 MB because
    # every event carries full polygons, so this is streamed from disk, not through the 4 MB cap.
    closed = fetch_stream("https://eonet.gsfc.nasa.gov/api/v3/categories/floods?status=closed&limit=50",
                          os.path.join(OUT_DIR, "eonet_floods_closed.json"), max_bytes=12 * 1024 * 1024)
    try:
        with open(closed["path"], encoding="utf-8") as handle:
            closed_payload = json.load(handle)
        closed_events = closed_payload.get("events", []) or []
        closed_detail = f"{len(closed_events)} closed flood events" + (f"; first: {closed_events[0].get('title')}" if closed_events else "")
        usable_closed = "yes" if closed_events else "no closed flood events"
        pre_2010 = [e for e in closed_events if (e.get("geometry") or [{}])[0].get("date", "9") < "2010"]
        closed_detail += f"; before 2010: {len(pre_2010)}"
    except (ValueError, OSError):
        closed_detail = "parse failed (download kept for inspection)"
        usable_closed = "no"
    rows.append(record_table(["EONET v3 closed floods", str(closed["status"]), "json" if closed["ok"] else "not json", human_bytes(closed["bytes"]), usable_closed, closed_detail]))
    print("\n".join(rows))
    write_report_section("EONET shape", "\n".join(rows) + """

Decision rule: EONET is [M] Tier B and is only a **cross-check** for replay candidates
(finding the action of an event), never the primary catalogue. If its IDs and dates match
GDACS for ≥ 2 events, list them; otherwise record "cross-check unavailable".
""")
    return 0 if usable == "yes" else 1


# --------------------------------------------------------------------------------------
# Report writer (a human-curated file that the spike only appends to)
# --------------------------------------------------------------------------------------
REPORT_SECTIONS = {
    "Link check": "## 1. Link check (auto-generated, then curated)\n\n",
    "Auth probe": "## 2. Auth probe (auto-generated)\n\n",
    "GDACS shape": "## 3. GDACS (auto-generated)\n\n",
    "EONET shape": "## 4. EONET (auto-generated)\n\n",
}


def write_report_section(title: str, body: str) -> None:
    """Upsert the auto-generated section, leaving curated sections intact."""
    header = REPORT_SECTIONS.get(title, f"## {title}\n\n")
    block = header + body + "\n\n"
    existing = ""
    if os.path.exists(REPORT):
        with open(REPORT, encoding="utf-8") as handle:
            existing = handle.read()
    marker_start = header
    if marker_start in existing:
        start = existing.index(marker_start)
        rest = existing[start + len(marker_start):]
        # Section ends at the next "## " heading.
        end = re.search(r"\n## ", rest)
        existing = existing[:start] + (block + rest[end.start() + 1:] if end else block)
    else:
        existing = existing.rstrip() + "\n\n" + block if existing else block
    with open(REPORT, "w", encoding="utf-8") as handle:
        handle.write(existing)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Signals spike: links, auth, GDACS, EONET. No writes outside scripts/signals/.")
    parser.add_argument("--check-links", action="store_true", help="probe every catalogued URL and print a table")
    parser.add_argument("--check-auth", action="store_true", help="probe PPS basic auth and the Earthdata token; prints OK/rejected/expired only")
    parser.add_argument("--gdacs", action="store_true", help="probe the GDACS API and RSS shapes and save fixtures")
    parser.add_argument("--eonet", action="store_true", help="probe EONET v3 and save a fixture")
    parser.add_argument("--all", action="store_true", help="everything above in one run")
    args = parser.parse_args(argv)
    if not any((args.check_links, args.check_auth, args.gdacs, args.eonet, args.all)):
        parser.print_help()
        return 0
    failures = 0
    if args.check_links or args.all:
        failures += check_links()
    if args.check_auth or args.all:
        failures += check_auth()
    if args.gdacs or args.all:
        failures += probe_gdacs()
    if args.eonet or args.all:
        failures += probe_eonet()
    print(f"\nReport written to {os.path.relpath(REPORT)}")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(2)
