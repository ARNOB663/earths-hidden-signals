"""Tile registry and grid arithmetic (plan rev. 7b).

A tile is a 10x10 degree box named by an area label, never by a country. Tiles are the unit of
"enabled" coverage: a tile that is not listed in ``config.json`` renders "Not yet covered", which
is distinct from Grey (a data problem).
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONFIG_PATH = HERE / "config.json"
# Byte-identical copy served to the browser so the UI reads the same thresholds as the pipeline.
PUBLIC_CONFIG = HERE.parents[1] / "web" / "public" / "data" / "signals" / "config.json"


@dataclass(frozen=True)
class Tile:
    id: str
    label: str
    south: float
    north: float
    west: float
    east: float

    def contains(self, lat: float, lon: float) -> bool:
        return self.south <= lat < self.north and self.west <= lon < self.east

    def grid(self, cell_deg: float) -> list[tuple[float, float]]:
        """Cell centres inside the tile, row-major from the north-west corner (north-up)."""
        rows = int(round((self.north - self.south) / cell_deg))
        cols = int(round((self.east - self.west) / cell_deg))
        out: list[tuple[float, float]] = []
        for row in range(rows):
            lat = self.north - (row + 0.5) * cell_deg
            for col in range(cols):
                lon = self.west + (col + 0.5) * cell_deg
                out.append((round(lat, 4), round(lon, 4)))
        return out

    def area_deg2(self) -> float:
        return (self.north - self.south) * (self.east - self.west)


def load_config(path: Path = CONFIG_PATH) -> dict:
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def tiles(config: dict) -> list[Tile]:
    out = []
    for entry in config["enabledTiles"]:
        tile = Tile(**entry)
        if not (-90 <= tile.south < tile.north <= 90 and -180 <= tile.west < tile.east <= 180):
            raise ValueError(f"tile {tile.id} has invalid bounds")
        if abs(tile.north) > config["maxAbsLat"] or abs(tile.south) > config["maxAbsLat"]:
            raise ValueError(f"tile {tile.id} crosses the reliable-coverage limit {config['maxAbsLat']}")
        out.append(tile)
    ids = [t.id for t in out]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate tile ids")
    return out


def tile_for(lat: float, lon: float, config: dict) -> Tile | None:
    for tile in tiles(config):
        if tile.contains(lat, lon):
            return tile
    return None


def cell_of(lat: float, lon: float, cell_deg: float) -> tuple[float, float]:
    """The cell centre a coordinate snaps to (same rounding as the tile grid)."""
    return (
        round(math.floor(lat / cell_deg) * cell_deg + cell_deg / 2, 4),
        round(math.floor(lon / cell_deg) * cell_deg + cell_deg / 2, 4),
    )


def round_for_url(value: float, step: float = 0.125) -> float:
    """Place URLs round to 1/8 degree so a link is short and stable."""
    return round(value / step) * step


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance used for the event-area radius (plan §7)."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def cells_within(lat: float, lon: float, radius_km: float, cell_deg: float, tile: Tile) -> list[tuple[float, float]]:
    """Cells whose centre is within radius_km of a point — the backtest's "event area"."""
    return [cell for cell in tile.grid(cell_deg) if distance_km(lat, lon, *cell) <= radius_km]
