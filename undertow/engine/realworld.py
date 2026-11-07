"""Real-world check: does the forecast map agree with independent, real hardship data?

Outcome: ONS Claimant Count, September 2026, as % of residents aged 16-64, per
neighbourhood (Nomis). Not an input to Undertow. (The deprivation input uses
2015-16 benefit data, a decade earlier.)

This is a convergent-validity check on WHERE hardship is, not a test of forecast
accuracy: no public data contains households' future cash flow.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import config as C


def load() -> pd.DataFrame | None:
    p = C.DATA / "real_claimants.parquet"
    return pd.read_parquet(p) if p.exists() else None


def spearman(a, b) -> float:
    return float(pd.Series(a).rank().corr(pd.Series(b).rank()))


def check(af: pd.DataFrame, real: pd.DataFrame) -> dict:
    a = af[~af["suppressed"]].merge(real[["msoa_code", "rate_2026", "claimants_2026", "month_2026"]], on="msoa_code")
    top = lambda col, n=50: set(a.nlargest(n, col)["msoa_code"])
    return {
        "n": len(a),
        "month": a["month_2026"].iloc[0],
        "undertow_spearman": spearman(a["rate"], a["rate_2026"]),
        "undertow_pearson": float(np.corrcoef(a["rate"], a["rate_2026"])[0, 1]),
        "deprivation_spearman": spearman(a["imd_score"], a["rate_2026"]),
        "undertow_top50": len(top("rate") & top("rate_2026")),
        "deprivation_top50": len(top("imd_score") & top("rate_2026")),
        "points": a[["msoa_name", "lad", "rate", "rate_2026", "imd_score"]],
    }
