"""Real-world check data: ONS Claimant Count (Nomis, NM_162_1) for Greater Manchester.

Claimant data for Sept 2026 is published on 2021 MSOAs; our map uses 2011 MSOAs.
The ONS MSOA 2011->2021 lookup maps them: 340 are unchanged, and 13 2011 MSOAs were
split. Split ones are re-aggregated (sum of claimants / sum of residents aged 16-64).

Output: data/processed/real_claimants.parquet with, per 2011 MSOA:
  claimants_2026, rate_2026 (% of residents aged 16-64)
(The 2021-MSOA series only starts in January 2026, so no year-on-year change is available.)
"""
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW, OUT = ROOT / "data" / "raw", ROOT / "data" / "processed"


def load(date: str) -> pd.DataFrame:
    c = pd.read_csv(RAW / f"claimant_msoa21_{date}_m1.csv")[["GEOGRAPHY_CODE", "DATE_NAME", "OBS_VALUE"]]
    r = pd.read_csv(RAW / f"claimant_msoa21_{date}_m2.csv")[["GEOGRAPHY_CODE", "OBS_VALUE"]]
    df = c.rename(columns={"OBS_VALUE": "claimants"}).merge(r.rename(columns={"OBS_VALUE": "rate"}), on="GEOGRAPHY_CODE")
    df["residents"] = df["claimants"] / (df["rate"] / 100)
    return df.rename(columns={"GEOGRAPHY_CODE": "MSOA21CD"})


def main() -> None:
    lk = pd.DataFrame([f["attributes"] for f in json.load(open(RAW / "msoa11_21_lookup_gm.json"))["features"]])
    out = None
    for date, tag in (("latest", "2026"),):
        df = lk.merge(load(date), on="MSOA21CD", how="left")
        g = df.groupby("MSOA11CD").agg(claimants=("claimants", "sum"), residents=("residents", "sum"),
                                       month=("DATE_NAME", "first")).reset_index()
        g[f"rate_{tag}"] = 100 * g["claimants"] / g["residents"]
        g = g.rename(columns={"claimants": f"claimants_{tag}", "month": f"month_{tag}"}).drop(columns="residents")
        out = g if out is None else out.merge(g, on="MSOA11CD")
    out = out.rename(columns={"MSOA11CD": "msoa_code"})
    out.to_parquet(OUT / "real_claimants.parquet", index=False)
    print(len(out), "MSOAs;", out["month_2026"].iloc[0])
    print(out[["rate_2026"]].describe().round(2))


if __name__ == "__main__":
    main()
