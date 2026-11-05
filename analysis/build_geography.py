"""Administrative geography for the Signals workflow, from geoBoundaries gbOpen.

Loads every country and territory the gbOpen release publishes at ADM0, and each country's ADM1
and ADM2 levels wherever geoBoundaries publishes them. Levels are never assumed: a country with no
ADM2 file simply has no ADM2 areas, and the index says so.

Writes reusable identifiers that every page can share:

    web/public/data/geography/index.json          every country/territory with its available levels,
                                                  counts, local level names and licence, for the
                                                  server readers and the client search index
    web/public/data/geography/admin/{ISO}.json    one file per country: its ADM1 and ADM2 units
    web/public/data/geography/license.json        source, release, license and attribution for
                                                  every boundary file actually loaded

geoBoundaries supplies geography only: no weather measurement and no signal score. Coverage counts
and demo scores are computed by build_signal_scores.py.

Why the unit names come from the .dbf instead of the .geojson: the global geometry is several
gigabytes, while the attribute table carries the same shapeName/shapeID fields in about 4 MB. The
.dbf is the attribute component of the same boundary file, so the names and IDs are identical to
the .geojson, and geometry is not needed to list areas.

    python build_geography.py            # download missing files, then write outputs
    python build_geography.py --offline  # write outputs from analysis/raw/ only
"""

from __future__ import annotations

import argparse
import json
import os
import struct
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = Path(__file__).parent / "raw" / "geoboundaries"
OUT = ROOT / "web" / "public" / "data" / "geography"

LEVELS = ("ADM0", "ADM1", "ADM2")
SUB_LEVELS = ("ADM1", "ADM2")
API = "https://www.geoboundaries.org/api/current/gbOpen/{iso}/{level}/"
GB_VERSION = "gbOpen, current release (as served by the geoBoundaries API)"
GB_LICENSE_URL = "https://www.geoboundaries.org/license/"
GB_URL = "https://www.geoboundaries.org/"
TIMEOUT = 120

# Every ADM0 name seen while building, so a level whose canonical label is a country name
# ("Croatia", "People’s Republic of China") is not mistaken for a level type.
COUNTRY_NAMES: set[str] = set()

# Names geoBoundaries gives the ADM0 layer are the country itself, not a local level; the page
# should not call a country a "Province". Anything else is used verbatim.
LEVEL_NAME_BN = {
    "Division": "বিভাগ",
    "Divisions": "বিভাগ",
    "district": "জেলা",
    "District": "জেলা",
    "Districts": "জেলা",
    "State / Union Territory": "রাজ্য / কেন্দ্রশাসিত অঞ্চল",
    "States": "রাজ্য",
    "Province": "প্রদেশ",
    "Provinces": "প্রদেশ",
    "Region": "অঞ্চল",
    "Regions": "অঞ্চল",
    "Governorate": "গভর্নরেট",
    "Governorates": "গভর্নরেট",
    "County": "কাউন্টি",
    "Counties": "কাউন্টি",
    "Municipality": "পৌরসভা",
    "Municipalities": "পৌরসভা",
    "Prefecture": "প্রিফেকচার",
    "Prefectures": "প্রিফেকচার",
    "Department": "বিভাগ",
    "Departments": "বিভাগ",
    "Canton": "ক্যান্টন",
    "Cantons": "ক্যান্টন",
    "Gewog": "গেওগ",
    "Dzongdeys": "জোংদে",
    "Tehsil": "তহসিল",
    "Woreda": "ওরেডা",
    "Woredas": "ওরেডা",
}


def get(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "earths-hidden-signals/1.0 (Space Apps 2026)"})
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return response.read()


def meta_path(iso: str, level: str) -> Path:
    return RAW / iso / f"{level}.meta.json"


def dbf_path(iso: str, level: str) -> Path:
    return RAW / iso / f"{level}.dbf"


def fetch(iso: str, level: str, simplified: bool = True) -> dict | None:
    """Download one level's metadata and attribute table. A 404 means not published."""
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
    source = meta.get("gjDownloadURL") or ""
    dbf_name = source.rsplit("/", 1)[-1].replace(".geojson", "_simplified.dbf")
    dbf_url = source.rsplit("/", 1)[0] + "/" + dbf_name
    dbf_path(iso, level).write_bytes(get(dbf_url))
    return meta


def read_dbf(path: Path) -> list[dict[str, str]]:
    """Read the shapeName/shapeISO/shapeID/... fields from a dBASE III .dbf file."""
    raw = path.read_bytes()
    count = struct.unpack("<I", raw[4:8])[0]
    header = struct.unpack("<H", raw[8:10])[0]
    record = struct.unpack("<H", raw[10:12])[0]
    fields = []
    for offset in range(32, header - 1, 32):
        spec = raw[offset : offset + 32]
        fields.append((spec[0:11].split(b"\x00")[0].decode().strip(), spec[16]))
    rows = []
    for index in range(count):
        start = header + index * record
        if raw[start : start + 1] == b"*":  # deleted record
            continue
        cursor = start + 1
        row = {}
        for name, length in fields:
            value = raw[cursor : cursor + length]
            cursor += length
            row[name] = value.decode("utf-8", "replace").replace("\x00", "").strip()
        rows.append(row)
    return rows


def _is_country_like(value: str) -> bool:
    """True when a label reads as a state/territory name rather than an administrative level."""
    text = normalize_country(value)
    markers = ("republic", "kingdom", "federation", "territory", "taipei", "emirates",
               "states of", "commonwealth", "union of", "islamic", "principality", "sultanate")
    return any(marker in text for marker in markers)


def normalize_country(value: str) -> str:
    """Country names compared ignoring case, spacing and each apostrophe glyph."""
    text = value.strip().casefold()
    for quote in ("\u2019", "\u2018", "`", "\u00b4"):
        text = text.replace(quote, "'")
    return " ".join(text.split())


def level_label(meta: dict, level: str) -> tuple[str, str]:
    """The level's own name from geoBoundaries, never a guess.

    Some files set boundaryCanonical to the country's own name (Croatia's ADM1, Mauritania's ADM2,
    China's ADM1) or leave it "Unknown". That is not a level name, so those fall back to the generic
    label and the raw canonical stays visible in the country file.
    """
    canonical = (meta.get("boundaryCanonical") or "").strip()
    # "Country" plus any canonical that is itself a country or territory name ("Croatia",
    # "Mauritania", "People’s Republic of China", "Chinese Taipei") is not a level type. The raw
    # canonical is always kept in the country file, so nothing the source said is lost.
    names_country = bool(canonical) and (
        normalize_country(canonical) in COUNTRY_NAMES
        or normalize_country(canonical) == "country"
        or _is_country_like(canonical)
    )
    if level == "ADM0" or not canonical or canonical.casefold() == "unknown" or names_country:
        return ("Country / territory" if level == "ADM0" else f"{level} areas",
                "দেশ / অঞ্চল" if level == "ADM0" else f"{level} এলাকা")
    return canonical, LEVEL_NAME_BN.get(canonical, canonical)


def slug(text: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "-" for ch in text)
    while "--" in cleaned:
        cleaned = cleaned.replace("--", "-")
    return cleaned.strip("-") or "area"


def unit_ids(iso: str, level: str, rows: list[dict[str, str]]) -> list[dict]:
    """Stable {iso}-adm{level}-{slug} identifiers, suffixed only when two names collide."""
    taken: set[str] = set()
    units = []
    for row in rows:
        name = row.get("shapeName") or ""
        if not name:
            continue
        base = f"{iso.lower()}-{level.lower()}-{slug(name)}"
        # A suffixed id can collide with a real name (e.g. two "Suhag" areas and a literal
        # "Suhag-2"), so keep bumping the suffix until the id is free rather than trusting a count.
        area_id = base
        suffix = 1
        while area_id in taken:
            suffix += 1
            area_id = f"{base}-{suffix}"
        taken.add(area_id)
        unit = {"id": area_id, "name": name}
        shape_iso = row.get("shapeISO") or None
        if shape_iso:
            unit["shapeISO"] = shape_iso
        units.append(unit)
    units.sort(key=lambda unit: (unit["name"].casefold(), unit["id"]))
    return units


def country_name(meta: dict) -> str:
    name = (meta.get("boundaryName") or "").strip()
    return name or meta.get("boundaryISO") or ""


def build() -> None:
    COUNTRY_NAMES.clear()
    for levels_meta in metas_by_iso().values():
        adm0 = levels_meta.get("ADM0")
        if adm0:
            for key in ("boundaryName", "boundaryCanonical"):
                if adm0.get(key):
                    COUNTRY_NAMES.add(normalize_country(adm0[key]))
    expanded = []
    license_entries = []
    skipped: list[dict] = []
    metas = list(metas_by_iso().items())
    for iso, levels_meta in sorted(metas):
        adm0 = levels_meta.get("ADM0")
        if adm0 is None:
            # geoBoundaries publishes PRI at ADM2 only. Without an ADM0 boundary there is no
            # country record to hang it on, so it is reported rather than invented.
            skipped.append({
                "iso": iso,
                "levels": sorted(levels_meta),
                "reason": "No ADM0 boundary is published; not listed as a country/territory.",
            })
            print(f"skip {iso}: no ADM0 boundary (has {', '.join(sorted(levels_meta))})", file=sys.stderr)
            continue
        levels: dict[str, dict] = {}
        for level in SUB_LEVELS:
            meta = levels_meta.get(level)
            if meta is None or not dbf_path(iso, level).exists():
                continue
            rows = read_dbf(dbf_path(iso, level))
            if not rows:
                continue
            name, name_bn = level_label(meta, level)
            units = unit_ids(iso, level, rows)
            levels[level] = {
                "code": level,
                "name": name,
                "nameBn": name_bn,
                "canonical": meta.get("boundaryCanonical"),
                "count": len(units),
                "sourceCount": int(meta.get("admUnitCount") or len(units)),
                "representedYear": meta.get("boundaryYearRepresented"),
                "units": units,
            }
            license_entries.append(license_entry(iso, level, name, len(units), meta))
        license_entries.append(license_entry(iso, "ADM0", level_label(adm0, "ADM0")[0], 1, adm0))
        adm0_name, adm0_name_bn = level_label(adm0, "ADM0")
        levels["ADM0"] = {
            "code": "ADM0",
            "name": adm0_name,
            "nameBn": adm0_name_bn,
            "canonical": adm0.get("boundaryCanonical"),
            "count": 1,
            "sourceCount": 1,
            "representedYear": adm0.get("boundaryYearRepresented"),
            "units": [],
        }

        name = country_name(adm0)
        country = {
            "code": iso,
            "name": name,
            "nameBn": name,
            "flag": "",
            "levels": {level: levels[level] for level in LEVELS if level in levels},
        }
        OUT.joinpath("admin").mkdir(parents=True, exist_ok=True)
        write(OUT / "admin" / f"{iso}.json", country)
        summary = country["levels"].get("ADM2") or country["levels"].get("ADM1") or country["levels"]["ADM0"]
        expanded.append({
            "code": iso,
            "name": name,
            "nameBn": name,
            "flag": "",
            "areaName": summary["name"],
            "areaNameBn": summary["nameBn"],
            "levels": {
                level: {
                    "name": data["name"],
                    "nameBn": data["nameBn"],
                    "count": data["count"],
                    "sourceCount": data["sourceCount"],
                }
                for level, data in country["levels"].items()
            },
            "areas": {
                level: country["levels"][level]["units"]
                for level in SUB_LEVELS if level in country["levels"]
            },
        })

    expanded.sort(key=lambda country: (country["name"].casefold(), country["code"]))
    counts = {
        "countries": len(expanded),
        "ADM1": sum(1 for c in expanded if "ADM1" in c["levels"]),
        "ADM2": sum(1 for c in expanded if "ADM2" in c["levels"]),
        "ADM1Areas": sum(len(c["areas"].get("ADM1", [])) for c in expanded),
        "ADM2Areas": sum(len(c["areas"].get("ADM2", [])) for c in expanded),
    }
    index = {
        "schema": "geography-v2",
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
        "counts": counts,
        "skipped": skipped,
        "countries": expanded,
    }
    write(OUT / "index.json", index)
    write(OUT / "license.json", {
        "schema": "geography-license-v2",
        "source": "geoBoundaries gbOpen",
        "licenseUrl": GB_LICENSE_URL,
        "note": "License varies by boundary file and is recorded per file exactly as geoBoundaries "
                "publishes it. The upstream source dataset is named where geoBoundaries names it.",
        "files": sorted(license_entries, key=lambda item: (item["iso"], item["level"])),
    })
    print(f"{counts['countries']} countries/territories: ADM1 in {counts['ADM1']} "
          f"({counts['ADM1Areas']} areas), ADM2 in {counts['ADM2']} ({counts['ADM2Areas']} areas)")


def license_entry(iso: str, level: str, level_name: str, units: int, meta: dict) -> dict:
    return {
        "iso": iso,
        "level": level,
        "boundaryId": meta.get("boundaryID"),
        "levelName": level_name,
        "units": units,
        "license": meta.get("boundaryLicense"),
        "licenseSource": meta.get("licenseSource"),
        "boundarySource": meta.get("boundarySource"),
        "sourceURL": meta.get("boundarySourceURL") or meta.get("licenseSource"),
        "representedYear": meta.get("boundaryYearRepresented"),
        "buildDate": meta.get("buildDate"),
        "download": (meta.get("gjDownloadURL") or "").split("/raw/")[-1],
    }


def metas_by_iso() -> dict[str, dict[str, dict]]:
    """Every ISO with at least one downloaded level, mapped to its per-level metadata."""
    found: dict[str, dict[str, dict]] = {}
    for iso_dir in sorted(RAW.glob("*")):
        if not iso_dir.is_dir():
            continue
        levels = {}
        for level in LEVELS:
            path = meta_path(iso_dir.name, level)
            if path.exists():
                levels[level] = json.loads(path.read_text(encoding="utf-8"))
        if levels:
            found[iso_dir.name] = levels
    return found


def write(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--offline", action="store_true", help="do not download; use analysis/raw/")
    args = parser.parse_args()
    if not args.offline:
        isos = discover_isos()
        for iso in isos:
            for level in LEVELS:
                if meta_path(iso, level).exists() and dbf_path(iso, level).exists():
                    continue
                meta = fetch(iso, level)
                if meta:
                    print(f"{iso} {level}: published ({meta.get('admUnitCount')} units)")
        print(f"downloaded levels for {len(isos)} ISO codes")
    os.makedirs(OUT, exist_ok=True)
    build()
    print(f"Wrote {OUT.relative_to(ROOT)}")


def discover_isos() -> list[str]:
    """ISO codes from the gbOpen ADM0 list, plus any ISO already present under analysis/raw/."""
    isos = set()
    try:
        listing = json.loads(get(API.format(iso="ALL", level="ADM0")))
        isos.update(item["boundaryISO"] for item in listing if item.get("boundaryISO"))
    except (urllib.error.URLError, ValueError, KeyError, TypeError) as exc:
        print(f"warning: could not read the global ADM0 list ({exc}); using stored ISOs only", file=sys.stderr)
    for level in SUB_LEVELS:
        try:
            listing = json.loads(get(API.format(iso="ALL", level=level)))
            isos.update(item["boundaryISO"] for item in listing if item.get("boundaryISO"))
        except (urllib.error.URLError, ValueError, KeyError, TypeError):
            pass
    if RAW.exists():
        isos.update(p.name for p in RAW.iterdir() if p.is_dir())
    return sorted(isos)


if __name__ == "__main__":
    main()
