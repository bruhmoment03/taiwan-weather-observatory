#!/usr/bin/env python3
"""Fetch CWA dataset C-B0024-001 and shape it into tidy JSON for the dashboard.

Outputs (into ../data relative to this file):
  meta.json        - update timestamps, data window, units, attribution
  latest.json      - one record per station: latest values + 24h temp stats + coords
  timeseries.json  - per-station hourly arrays for every metric

The CWA API key is read from the CWA_API_KEY environment variable.
No third-party dependencies (stdlib only) so the GitHub Action stays fast.
"""

import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

DATASET_ID = "C-B0024-001"
API_URL = (
    "https://opendata.cwa.gov.tw/api/v1/rest/datastore/"
    f"{DATASET_ID}?Authorization={{key}}&format=JSON"
)
TAIPEI_TZ = timezone(timedelta(hours=8))

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.normpath(os.path.join(HERE, "..", "data"))
COORDS_PATH = os.path.join(DATA_DIR, "station_coords.json")

# Sentinels the CWA API uses for "no reading".
MISSING_TOKENS = {"", "x", "X", "x,x", "X,X", "-99", "-99.0", "?", "none", "null"}

# Metric key in the API  ->  (output key, human label, unit)
METRICS = {
    "AirTemperature":    ("temp",     "Temperature",       "°C"),
    "RelativeHumidity":  ("humidity", "Relative Humidity", "%"),
    "AirPressure":       ("pressure", "Air Pressure",      "hPa"),
    "WindSpeed":         ("wind",     "Wind Speed",        "m/s"),
    "Precipitation":     ("precip",   "Precipitation",     "mm"),
    "SunshineDuration":  ("sunshine", "Sunshine",          "hr"),
}


def to_float(value):
    """Parse a CWA string value to float, or None if missing/invalid."""
    if value is None:
        return None
    s = str(value).strip()
    if s.lower() in MISSING_TOKENS:
        return None
    try:
        f = float(s)
    except ValueError:
        return None
    if f <= -90:  # CWA uses large negatives as missing sentinels
        return None
    return f


def clean_wind_dir(value):
    """'静風,Calm' -> 'Calm'; 'X,X' -> None; '270,SW' -> 'SW'."""
    if value is None:
        return None
    s = str(value).strip()
    if s.lower() in MISSING_TOKENS:
        return None
    # API gives "<chinese/deg>,<english>"; prefer the english half when present.
    parts = [p.strip() for p in s.split(",")]
    if len(parts) == 2:
        en = parts[1]
        return None if en.lower() in MISSING_TOKENS else en
    return None if s.lower() in MISSING_TOKENS else s


def fetch_raw(key):
    url = API_URL.format(key=key)
    req = urllib.request.Request(url, headers={"User-Agent": "taiwan-weather-observatory/1.0"})
    with urllib.request.urlopen(req, timeout=90) as resp:
        payload = resp.read().decode("utf-8")
    data = json.loads(payload)
    if str(data.get("success")).lower() != "true":
        raise RuntimeError(f"API returned success={data.get('success')!r}")
    return data


def stats(values):
    """min/max/mean over non-null numbers, rounded; None if empty."""
    nums = [v for v in values if v is not None]
    if not nums:
        return {"min": None, "max": None, "mean": None}
    return {
        "min": round(min(nums), 1),
        "max": round(max(nums), 1),
        "mean": round(sum(nums) / len(nums), 1),
    }


def build(raw, coords):
    locations = raw["records"]["location"]
    latest, timeseries = [], {}
    window_start, window_end = None, None

    for loc in locations:
        station = loc["station"]
        sid = station["StationID"]
        obs = loc["stationObsTimes"]["stationObsTime"]
        # Ensure chronological order.
        obs = sorted(obs, key=lambda o: o["DateTime"])

        times = [o["DateTime"] for o in obs]
        if times:
            window_start = min(window_start, times[0]) if window_start else times[0]
            window_end = max(window_end, times[-1]) if window_end else times[-1]

        series = {"time": times}
        for api_key, (out_key, _lbl, _unit) in METRICS.items():
            series[out_key] = [to_float(o["weatherElements"].get(api_key)) for o in obs]
        timeseries[sid] = series

        geo = coords.get(sid, {})
        last = obs[-1] if obs else {"weatherElements": {}, "DateTime": None}
        we = last["weatherElements"]

        latest.append({
            "id": sid,
            "name": station["StationName"],
            "name_en": station["StationNameEN"],
            "attribute": station.get("StationAttribute"),
            "lat": geo.get("lat"),
            "lon": geo.get("lon"),
            "elevation_m": geo.get("elevation_m"),
            "county": geo.get("county"),
            "region": geo.get("region"),
            "obs_time": last["DateTime"],
            "temp": to_float(we.get("AirTemperature")),
            "humidity": to_float(we.get("RelativeHumidity")),
            "pressure": to_float(we.get("AirPressure")),
            "wind": to_float(we.get("WindSpeed")),
            "wind_dir": clean_wind_dir(we.get("WindDirection")),
            "precip": to_float(we.get("Precipitation")),
            "sunshine": to_float(we.get("SunshineDuration")),
            "temp_24h": stats(series["temp"]),
            "humidity_24h": stats(series["humidity"]),
            "precip_24h_total": round(sum(v for v in series["precip"] if v is not None), 1),
        })

    now = datetime.now(timezone.utc)
    meta = {
        "dataset": DATASET_ID,
        "source": "Central Weather Administration (CWA), Taiwan - Open Data",
        "source_url": "https://opendata.cwa.gov.tw/",
        "last_updated_utc": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "last_updated_taipei": now.astimezone(TAIPEI_TZ).strftime("%Y-%m-%d %H:%M (UTC+8)"),
        "window_start": window_start,
        "window_end": window_end,
        "station_count": len(latest),
        "metrics": {ok: {"label": lbl, "unit": unit}
                    for (ok, lbl, unit) in METRICS.values()},
    }
    return meta, latest, timeseries


def write_json(name, obj):
    path = os.path.join(DATA_DIR, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    return path


def main():
    key = os.environ.get("CWA_API_KEY")
    if not key:
        sys.exit("ERROR: CWA_API_KEY environment variable is not set.")

    with open(COORDS_PATH, encoding="utf-8") as f:
        coords = {k: v for k, v in json.load(f).items() if not k.startswith("_")}

    print(f"Fetching {DATASET_ID} ...")
    try:
        raw = fetch_raw(key)
    except urllib.error.HTTPError as e:
        sys.exit(f"ERROR: HTTP {e.code} from CWA API")
    except Exception as e:  # noqa: BLE001
        sys.exit(f"ERROR: {e}")

    meta, latest, timeseries = build(raw, coords)

    # Stable ordering so git diffs stay small.
    latest.sort(key=lambda r: r["id"])

    write_json("meta.json", meta)
    write_json("latest.json", latest)
    write_json("timeseries.json", timeseries)

    missing_coords = [r["id"] for r in latest if r["lat"] is None]
    no_temp = [r["name_en"] for r in latest if r["temp"] is None]
    print(f"OK: {len(latest)} stations, window {meta['window_start']} -> {meta['window_end']}")
    if missing_coords:
        print(f"WARNING: no coordinates for {missing_coords}")
    if no_temp:
        print(f"NOTE: no current temperature for {no_temp}")


if __name__ == "__main__":
    main()
