"""Administrative geography for the Signals workflow, from geoBoundaries gbOpen.

Downloads the ADM0/ADM1/ADM2 boundary files for the six study countries, keeps each level only
when geoBoundaries actually publishes it, and writes reusable identifiers that every page can
share:

    web/public/data/geography/admin/{ISO}.json   one file per country: ADM0, ADM1 and (when
                                                 published) ADM2 areas, each with its own local
                                                 level name, canonical name and parent
    web/public/data/geography/index.json         country list and available levels, for the
                                                 server readers and the client search index
    web/public/data/geography/license.json       source, release, license and attribution for
                                                 every downloaded boundary file

geoBoundaries supplies geography only. It holds no weather measurement and no signal score; the
coverage counts and demo scores are computed by build_signal_scores.py.

Network use is limited to the geoBoundaries API and its GitHub release links; the raw downloads
stay in analysis/raw/ (gitignored). The committed outputs are deterministic: they are written from
the downloaded files with sorted keys, so a rerun against the same gbOpen release is byte-identical.

    python build_geography.py            # download missing files, then write outputs
    python build_geography.py --offline  # write outputs from analysis/raw/ only
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = Path(__file__).parent / "raw" / "geoboundaries"
OUT = ROOT / "web" / "public" / "data" / "geography"

COUNTRIES = {
    "BGD": {"name": "Bangladesh", "nameBn": "বাংলাদেশ", "flag": "🇧🇩"},
    "IND": {"name": "India", "nameBn": "ভারত", "flag": "🇮🇳"},
    "NPL": {"name": "Nepal", "nameBn": "নেপাল", "flag": "🇳🇵"},
    "PAK": {"name": "Pakistan", "nameBn": "পাকিস্তান", "flag": "🇵🇰"},
    "LKA": {"name": "Sri Lanka", "nameBn": "শ্রীলঙ্কা", "flag": "🇱🇰"},
    "BTN": {"name": "Bhutan", "nameBn": "ভুটান", "flag": "🇧🇹"},
}
LEVELS = ("ADM0", "ADM1", "ADM2")
API = "https://www.geoboundaries.org/api/current/gbOpen/{iso}/{level}/"
GB_VERSION = "gbOpen, current release (as served by the geoBoundaries API)"
GB_LICENSE_URL = "https://www.geoboundaries.org/license/"
GB_URL = "https://www.geoboundaries.org/"
TIMEOUT = 120


def get(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "earths-hidden-signals/1.0 (Space Apps 2026)"})
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return response.read()


def meta_path(iso: str, level: str) -> Path:
    return RAW / iso / f"{level}.meta.json"


def geo_path(iso: str, level: str) -> Path:
    return RAW / iso / f"{level}.geojson"


def fetch(iso: str, level: str) -> dict | None:
    """Download one level's metadata and simplified geometry. A 404 means not published."""
    try:
        meta = json.loads(get(API.format(iso=iso, level=level)))
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return None
        raise
    if not isinstance(meta, dict) or "boundaryID" not in meta:
        return None
    meta_path(iso, level).parent.mkdir(parents=True, exist_ok=True)
    meta_path(iso, level).write_bytes(json.dumps(meta, indent=1, sort_keys=True).encode())
    # The simplified file is what the API serves for lightweight previews; the full file is the
    # source of record for names and identifiers, so only the simplified geometry is kept.
    geo_path(iso, level).write_bytes(get(meta["simplifiedGeometryGeoJSON"]))
    return meta


def local_level_name(level: str, canonical: str | None, count: int) -> tuple[str, str]:
    """The level's own name, from the geoBoundaries canonical layer label, never a guess."""
    label = (canonical or "").strip()
    if not label or label.lower() == "unknown":
        return ("National boundary" if level == "ADM0" else f"{level} areas",
                "জাতীয় সীমানা" if level == "ADM0" else f"{level} এলাকা")
    # A single canonical label is used verbatim; plurals stay plural ("Provinces", "Districts").
    bn = {
        "Division": "বিভাগ",
        "district": "জেলা",
        "Districts": "জেলা",
        "State / Union Territory": "রাজ্য / কেন্দ্রশাসিত অঞ্চল",
        "Provinces": "প্রদেশ",
        "Province": "প্রদেশ",
        "Dzongdeys": "জোংদে",
        "Gewog": "গেওগ",
        "Tehsil": "তহসিল",
        "Divisional Secretariat": "বিভাগীয় সচিবালয়",
        "Federal Democratic Republic of Nepal": "সংযুক্ত নেপাল",
        "Bangladesh": "বাংলাদেশ",
        "India": "ভারত",
        "Bhutan": "ভুটান",
    }.get(label, label)
    return label, bn


def feature_names(feature: dict) -> tuple[str, str, str | None]:
    props = feature.get("properties") or {}
    name = props.get("shapeName") or ""
    iso = props.get("shapeISO") or None
    return name.strip(), iso


def slug(text: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "-" for ch in text)
    while "--" in cleaned:
        cleaned = cleaned.replace("--", "-")
    return cleaned.strip("-")


def level_key(iso: str, level: str, name: str, used: dict[str, int]) -> str:
    base = f"{iso.lower()}-{level.lower()}-{slug(name)}"
    used[base] = used.get(base, 0) + 1
    return base if used[base] == 1 else f"{base}-{used[base]}"


def build() -> None:
    countries = []
    license_entries = []
    used_ids: dict[str, int] = {}
    for iso, info in COUNTRIES.items():
        levels: dict[str, dict] = {}
        for level in LEVELS:
            if not geo_path(iso, level).exists() or not meta_path(iso, level).exists():
                continue
            meta = json.loads(meta_path(iso, level).read_text(encoding="utf-8"))
            geo = json.loads(geo_path(iso, level).read_text(encoding="utf-8"))
            features = geo.get("features") or []
            if not features:
                continue
            level_name, level_name_bn = local_level_name(level, meta.get("boundaryCanonical"), len(features))
            areas = []
            for feature in features:
                name, shape_iso = feature_names(feature)
                if not name:
                    continue
                areas.append({"id": level_key(iso, level, name, used_ids), "name": name, "shapeISO": shape_iso})
            areas.sort(key=lambda area: (area["name"].casefold(), area["id"]))
            levels[level] = {
                "code": level,
                "name": level_name,
                "nameBn": level_name_bn,
                "canonical": meta.get("boundaryCanonical"),
                "count": len(areas),
                "representedYear": meta.get("boundaryYearRepresented"),
                "units": areas,
            }
            license_entries.append({
                "iso": iso,
                "level": level,
                "boundaryId": meta.get("boundaryID"),
                "levelName": level_name,
                "units": len(areas),
                "license": meta.get("boundaryLicense"),
                "licenseSource": meta.get("licenseSource"),
                "boundarySource": meta.get("boundarySource"),
                "sourceURL": meta.get("boundarySourceURL") or meta.get("licenseSource"),
                "representedYear": meta.get("boundaryYearRepresented"),
                "buildDate": meta.get("buildDate"),
                "download": (meta.get("gjDownloadURL") or "").split("/raw/")[-1],
            })
        if "ADM0" not in levels:
            print(f"skip {iso}: no ADM0 boundary", file=sys.stderr)
            continue
        country = {
            "code": iso,
            **info,
            "levels": {level: levels[level] for level in LEVELS if level in levels},
        }
        OUT.joinpath("admin").mkdir(parents=True, exist_ok=True)
        write(OUT / "admin" / f"{iso}.json", country)
        summary = country["levels"].get("ADM2") or country["levels"].get("ADM1") or country["levels"]["ADM0"]
        countries.append({
            "code": iso,
            "name": info["name"],
            "nameBn": info["nameBn"],
            "flag": info["flag"],
            "areaName": summary["name"],
            "areaNameBn": summary["nameBn"],
            "levels": {
                level: {"name": data["name"], "nameBn": data["nameBn"], "count": data["count"]}
                for level, data in country["levels"].items()
            },
            # The shared identifiers pages reference: lower levels only; ADM0 is the country.
            "areas": {
                level: country["levels"][level]["units"]
                for level in ("ADM1", "ADM2") if level in country["levels"]
            },
        })
        print(f"{iso}: " + ", ".join(f"{lv} {country['levels'][lv]['name']} ({country['levels'][lv]['count']})"
                                     for lv in LEVELS if lv in country["levels"]))

    index = {
        "schema": "geography-v1",
        "release": GB_VERSION,
        "source": {
            "name": "geoBoundaries",
            "url": GB_URL,
            "dataset": "gbOpen",
            "citation": "Runfola, D. et al. (2020) geoBoundaries: A global database of political "
                        "administrative boundaries. PLOS ONE 15(4): e0231866.",
            "doi": "https://doi.org/10.1371/journal.pone.0231866",
            "note": "geoBoundaries provides administrative geography only: no weather "
                    "measurements and no signal scores.",
        },
        "countries": countries,
    }
    write(OUT / "index.json", index)
    write(OUT / "license.json", {
        "schema": "geography-license-v1",
        "source": "geoBoundaries gbOpen",
        "licenseUrl": GB_LICENSE_URL,
        "note": "License varies by boundary file and is recorded per file exactly as geoBoundaries "
                "publishes it. The upstream source dataset is named where geoBoundaries names it.",
        "files": sorted(license_entries, key=lambda item: (item["iso"], item["level"])),
    })


def write(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--offline", action="store_true", help="do not download; use analysis/raw/")
    args = parser.parse_args()
    if not args.offline:
        for iso in COUNTRIES:
            for level in LEVELS:
                if geo_path(iso, level).exists() and meta_path(iso, level).exists():
                    continue
                meta = fetch(iso, level)
                print(f"{iso} {level}: {'published' if meta else 'not published'}")
    os.makedirs(OUT, exist_ok=True)
    build()
    print(f"Wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
