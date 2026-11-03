"""Credential probes and downloads for the signals pipeline (plan rev. 7b, step 2).

Never prints, logs or stores a secret. The only thing that leaves this module is one of:
``OK`` / ``rejected`` / ``expired`` / ``missing`` / ``network-error``.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass
from pathlib import Path

import requests

UA = {"User-Agent": "earth-hidden-signals/0.1 (signals pipeline)"}
PPS_DIR = "https://jsimpsonhttps.pps.eosdis.nasa.gov/imerg/gis/"
GES_LISTING = "https://gpm1.gesdisc.eosdis.nasa.gov/data/GPM_L3/GPM_3IMERGDF.07/"
GES_SUBSET_PROBE = "https://gpm1.gesdisc.eosdis.nasa.gov/opendap/GPM_L3/GPM_3IMERGDF.07/2024/07/3B-DAY.MS.MRG.3IMERG.20240715-S000000-E235959.V07B.nc4.lat"
LANCE_DIR = "https://nrt3.modaps.eosdis.nasa.gov/archive/allData/61/MCDWD_L3_NRT/"


@dataclass(frozen=True)
class Credentials:
    pps_user: str | None
    pps_password: str | None
    earthdata_token: str | None

    @classmethod
    def from_env(cls) -> "Credentials":
        return cls(
            pps_user=os.environ.get("PPS_USERNAME") or None,
            pps_password=os.environ.get("PPS_PASSWORD") or None,
            earthdata_token=os.environ.get("EARTHDATA_TOKEN") or None,
        )

    def pps(self) -> tuple[str, str] | None:
        if self.pps_user and self.pps_password:
            return (self.pps_user, self.pps_password)
        return None

    def earthdata(self) -> dict[str, str]:
        if not self.earthdata_token:
            return {}
        return {"Authorization": f"Bearer {self.earthdata_token}"}

    def __repr__(self) -> str:  # never let a repr leak a secret into a log or a traceback
        return f"Credentials(pps={'set' if self.pps() else 'missing'}, earthdata={'set' if self.earthdata_token else 'missing'})"


def _classify(status: int, body: bytes) -> str:
    if 200 <= status < 300:
        return "OK"
    if status in (401, 403):
        text = body[:400].lower()
        if b"expired" in text:
            return "expired"
        return "rejected"
    if status in (301, 302, 303, 307):
        return "rejected"
    if status == 404:
        return "OK"  # the host answered and accepted the credentials; this path just does not exist
    return f"unexpected-{status}"


def probe_pps(creds: Credentials, url: str = PPS_DIR, timeout: int = 30) -> str:
    auth = creds.pps()
    if not auth:
        return "missing"
    try:
        response = requests.get(url, auth=auth, headers=UA, timeout=timeout)
    except requests.RequestException:
        return "network-error"
    return _classify(response.status_code, response.content)


def probe_earthdata(creds: Credentials, url: str = GES_LISTING, timeout: int = 30) -> str:
    if not creds.earthdata_token:
        return "missing"
    try:
        response = requests.get(url, headers={**UA, **creds.earthdata()}, timeout=timeout, allow_redirects=False)
    except requests.RequestException:
        return "network-error"
    return _classify(response.status_code, response.content)


def check_all(creds: Credentials | None = None) -> dict[str, str]:
    creds = creds or Credentials.from_env()
    return {
        "pps-late-gis": probe_pps(creds),
        "pps-readme-gis": probe_pps(creds, PPS_DIR + "README.GIS"),
        "earthdata-ges-listing": probe_earthdata(creds),
        "earthdata-ges-opendap": probe_earthdata(creds, GES_SUBSET_PROBE),
        "earthdata-lance": probe_earthdata(creds, LANCE_DIR),
    }


def download(url: str, path: Path, creds: Credentials | None = None, timeout: int = 300) -> dict:
    """Stream one file to disk; returns status, bytes and seconds. Never raises on HTTP errors."""
    creds = creds or Credentials.from_env()
    path.parent.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    auth = creds.pps()
    try:
        with requests.get(url, auth=auth, headers=UA, timeout=timeout, stream=True) as response:
            if response.status_code != 200:
                return {"status": response.status_code, "bytes": 0, "seconds": time.monotonic() - started, "ok": False}
            written = 0
            tmp = path.with_suffix(path.suffix + ".part")
            with open(tmp, "wb") as handle:
                for chunk in response.iter_content(1 << 16):
                    if chunk:
                        handle.write(chunk)
                        written += len(chunk)
            tmp.replace(path)
            return {"status": 200, "bytes": written, "seconds": time.monotonic() - started, "ok": True}
    except requests.RequestException as error:
        return {"status": "network-error", "bytes": 0, "seconds": time.monotonic() - started, "ok": False,
                "error": type(error).__name__}
