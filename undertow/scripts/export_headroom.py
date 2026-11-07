"""Export the released (privacy-protected) Undertow forecast for one neighbourhood to Headroom.

Only area totals that Undertow already publishes leave here: noised rates, P10/P90 bands,
drivers rounded to 5%. Nothing about any one household. Usage:

    .venv/Scripts/python scripts/export_headroom.py [MSOA code or name fragment]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import pandas as pd  # noqa: E402

try:  # pyarrow's parquet DLL can be blocked by Windows Application Control; fall back
    import pyarrow.parquet  # noqa: F401
except Exception:
    pd.set_option("io.parquet.engine", "fastparquet")

from engine import config as C  # noqa: E402
from engine.aggregate import area_forecast, city_summary  # noqa: E402
from engine.model import World  # noqa: E402
from engine.scenarios import Scenario  # noqa: E402

OUT = ROOT.parent / "headroom" / "src" / "lib" / "undertow" / "area.json"
DEFAULT_AREA = "E02001075"  # Manchester 031 = Levenshulme, where Aisha lives (M19)
PLACE = {"E02001075": "Levenshulme"}


def pick(areas, query: str):
    q = query.lower()
    hit = areas[(areas["msoa_code"].str.lower() == q) | areas["msoa_name"].str.lower().str.contains(q)]
    if hit.empty:
        raise SystemExit(f"No area matches {query!r}. Try an MSOA code like E02001xxx.")
    return int(hit.iloc[0]["area_id"])


def main(query: str) -> None:
    w = World()
    s = Scenario()
    res = w.run(s)
    area_id = pick(w.areas, query)
    horizons = []
    city = []
    for k, days in enumerate(C.HORIZONS):
        af = area_forecast(w.areas, w.hh, w.mix, res, k, "headroom export")
        row = af[af["area_id"] == area_id].iloc[0]
        cs = city_summary(af)
        city.append({"weeks": days // 7, "rate": round(cs["rate"], 3)})
        if row["suppressed"]:
            horizons.append({"weeks": days // 7, "suppressed": True})
            continue
        drivers = sorted(((d, float(row[f"drv_{d}"])) for d in C.DRIVERS), key=lambda x: -x[1])
        horizons.append({
            "weeks": days // 7,
            "suppressed": False,
            "rate": round(float(row["rate"]), 3),
            "rate_p10": round(float(row["rate_p10"]), 3),
            "rate_p90": round(float(row["rate_p90"]), 3),
            "drivers": [{"id": d, "share": v} for d, v in drivers if v > 0],
        })
    first = w.areas[w.areas["area_id"] == area_id].iloc[0]
    out = {
        "source": "Undertow neighbourhood forecast (privacy-protected area totals, synthetic customers)",
        "as_of": str(C.DEMO_TODAY),
        "msoa_code": first["msoa_code"],
        "msoa_name": first["msoa_name"],
        "place": PLACE.get(first["msoa_code"], first["msoa_name"]),
        "lad": first["lad"],
        "horizons": horizons,
        "city": city,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2))
    print(f"Wrote {OUT}\n{json.dumps(out, indent=2)}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_AREA)
