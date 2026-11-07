"""Build Greater Manchester neighbourhood (MSOA 2011) geography joined to deprivation.

Inputs (data/raw):
  imd2019_file7.csv        English Indices of Deprivation 2019, File 7 (LSOA 2011)
  gm_msoa2011.geojson      ONS MSOA Dec 2011 BGC boundaries for the 10 GM districts

Outputs (data/processed):
  areas.parquet            one row per MSOA with deprivation + population
  areas.geojson            simplified boundaries with the same attributes
"""
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"

GM_DISTRICTS = [
    "Bolton", "Bury", "Manchester", "Oldham", "Rochdale",
    "Salford", "Stockport", "Tameside", "Trafford", "Wigan",
]
HOUSEHOLD_SIZE = 2.4  # assumption: people per household


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    imd = pd.read_csv(RAW / "imd2019_file7.csv")
    col = {
        "lsoa_name": "LSOA name (2011)",
        "lad": "Local Authority District name (2019)",
        "imd_score": "Index of Multiple Deprivation (IMD) Score",
        "income": "Income Score (rate)",
        "employment": "Employment Score (rate)",
        "idaci": "Income Deprivation Affecting Children Index (IDACI) Score (rate)",
        "idaopi": "Income Deprivation Affecting Older People (IDAOPI) Score (rate)",
        "pop": "Total population: mid 2015 (excluding prisoners)",
        "pop60": "Older population aged 60 and over: mid 2015 (excluding prisoners)",
    }
    imd = imd[list(col.values())].rename(columns={v: k for k, v in col.items()})
    imd = imd[imd["lad"].isin(GM_DISTRICTS)].copy()
    imd["msoa_name"] = imd["lsoa_name"].str[:-1].str.strip()

    def wavg(g: pd.DataFrame, c: str) -> float:
        return float(np.average(g[c], weights=g["pop"]))

    rows = []
    for name, g in imd.groupby("msoa_name"):
        rows.append({
            "msoa_name": name,
            "lad": g["lad"].iloc[0],
            "imd_score": wavg(g, "imd_score"),
            "income": wavg(g, "income"),
            "employment": wavg(g, "employment"),
            "idaci": wavg(g, "idaci"),
            "idaopi": wavg(g, "idaopi"),
            "population": int(g["pop"].sum()),
            "share_60plus": float(g["pop60"].sum() / g["pop"].sum()),
        })
    areas = pd.DataFrame(rows)
    # Deprivation decile within Greater Manchester (1 = most deprived)
    areas["gm_decile"] = 10 - pd.qcut(areas["imd_score"].rank(method="first"), 10, labels=False)
    areas["households"] = (areas["population"] / HOUSEHOLD_SIZE).round().astype(int)

    geo = gpd.read_file(RAW / "gm_msoa2011.geojson").rename(
        columns={"MSOA11CD": "msoa_code", "MSOA11NM": "msoa_name"})
    geo = geo.merge(areas, on="msoa_name", how="inner")
    geo["geometry"] = geo.geometry.simplify(0.0004, preserve_topology=True)
    geo = geo.sort_values("msoa_code").reset_index(drop=True)
    geo["area_id"] = np.arange(len(geo))
    cent = geo.geometry.representative_point()
    geo["lon"], geo["lat"] = cent.x, cent.y

    geo.drop(columns="geometry").to_parquet(OUT / "areas.parquet", index=False)
    geo.to_file(OUT / "areas.geojson", driver="GeoJSON")
    print(f"{len(geo)} MSOAs, {geo['households'].sum():,} households, "
          f"unmatched IMD MSOAs: {len(set(areas.msoa_name) - set(geo.msoa_name))}")


if __name__ == "__main__":
    main()
