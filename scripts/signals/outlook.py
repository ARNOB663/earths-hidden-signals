"""7-day outlook from a public source — context only (plan rev. 7b).

The outlook never touches a status, a confidence or a colour. It answers "will it rain next week"
next to a clearly labelled line. When the provider is unreachable the outlook is omitted and the
page says so; it must never be silently replaced by a guess.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass

import requests

UA = {"User-Agent": "earth-hidden-signals/0.1 (signals pipeline)"}
LABEL = "Outlook from an external public source, not our signal and not an official warning."


@dataclass(frozen=True)
class Outlook:
    points: list[tuple[str, float | None]]
    provider: str
    fetched_at: dt.datetime
    label: str = LABEL

    @property
    def total_mm(self) -> float | None:
        values = [v for _, v in self.points if v is not None]
        return round(sum(values), 1) if values else None

    def as_dict(self) -> dict:
        return {
            "provider": self.provider,
            "fetchedAt": self.fetched_at.isoformat(),
            "days": [{"date": d, "mm": v} for d, v in self.points],
            "totalMm": self.total_mm,
            "label": self.label,
            "usedInStatus": False,
        }


def fetch(lat: float, lon: float, url: str, days: int = 7, timeout: int = 20) -> Outlook | None:
    """Return None on any failure — the caller shows 'outlook unavailable', never a substitute."""
    params = {
        "latitude": round(lat, 3),
        "longitude": round(lon, 3),
        "daily": "precipitation_sum",
        "forecast_days": days,
        "timezone": "GMT",
    }
    try:
        response = requests.get(url, params=params, headers=UA, timeout=timeout)
        payload = response.json()
        daily = payload["daily"]
        points = [(date, (None if value is None else float(value))) for date, value in zip(daily["time"], daily["precipitation_sum"])]
    except (requests.RequestException, KeyError, TypeError, ValueError):
        return None
    return Outlook(points=points, provider="Open-Meteo (CC-BY 4.0)", fetched_at=dt.datetime.now(dt.timezone.utc))
