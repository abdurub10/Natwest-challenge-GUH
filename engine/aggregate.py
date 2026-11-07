"""Turn private household forecasts into safe area statistics.

1. Census reweighting (post-stratification): area rate = sum over household types
   of the area's true type mix x the customer shortfall rate for that type.
2. Shrinkage: small area x type cells are pulled towards the city-wide type rate.
3. Uncertainty: P10/P50/P90 of the area rate across Monte Carlo paths (paths
   share area shocks, so the band reflects correlated risk).
4. Differential privacy: Laplace noise on each released area rate, scaled to the
   most one household could move it (sensitivity / epsilon).
5. Suppression: areas with fewer than MIN_CUSTOMERS customers are not released.
Only the output of `area_forecast` ever reaches the app or Claude.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from . import config as C
from .simulate import SimResult

SHRINK = 8.0


@dataclass
class PrivacyLedger:
    entries: list = field(default_factory=list)

    def record(self, label: str, n_stats: int, eps: float = C.EPSILON):
        if not any(e["release"] == label for e in self.entries):
            self.entries.append({"release": label, "statistics": n_stats, "epsilon_per_statistic": eps})

    def frame(self) -> pd.DataFrame:
        return pd.DataFrame(self.entries)


LEDGER = PrivacyLedger()


def _seed(*parts) -> int:
    return int(hashlib.sha256("|".join(map(str, parts)).encode()).hexdigest()[:8], 16)


def cell_counts(hh: pd.DataFrame, n_areas: int) -> np.ndarray:
    n = np.zeros((n_areas, len(C.TYPES)))
    np.add.at(n, (hh["area_id"].to_numpy(), hh["type_id"].to_numpy()), 1)
    return n


def area_forecast(areas: pd.DataFrame, hh: pd.DataFrame, mix: np.ndarray, res: SimResult, k: int,
                  release: str, private: bool = True) -> pd.DataFrame:
    A, T = len(areas), len(C.TYPES)
    n = cell_counts(hh, A)
    S = np.zeros((A, T))
    np.add.at(S, (hh["area_id"].to_numpy(), hh["type_id"].to_numpy()), res.p_short[:, k])

    # Small cells borrow strength from the city-wide rate for that household type
    # (shrinkage prior of SHRINK pseudo-households). This also caps how much any
    # one household can move an area's released rate (its DP sensitivity).
    city_type = S.sum(0) / np.maximum(n.sum(0), 1)
    cell_rate_true = (S + SHRINK * city_type[None, :]) / (n + SHRINK)
    rate_true = (mix * cell_rate_true).sum(1)
    sensitivity = (mix / (n + SHRINK)).max(1)          # max change from one household
    rng = np.random.default_rng(_seed(release, k))
    noise = rng.laplace(0.0, sensitivity / C.EPSILON) if private else np.zeros(A)
    rate = np.clip(rate_true + noise, 0, 1)
    cell_rate = cell_rate_true
    if private:
        LEDGER.record(f"{release} · {C.HORIZONS[k] // 7} weeks", A)
    naive = S.sum(1) / np.maximum(n.sum(1), 1)

    # Path bands (reweighted), shifted by the same privacy noise
    with np.errstate(invalid="ignore", divide="ignore"):
        path_rate = (res.counts[:, :, :, k] + SHRINK * city_type[None, :, None]) / (n[:, :, None] + SHRINK)
    path_area = (mix[:, :, None] * path_rate).sum(1)               # (A, P)
    p10, p50, p90 = np.percentile(path_area, [10, 50, 90], axis=1)
    shift = rate - rate_true
    p10, p90 = np.clip(p10 + shift, 0, 1), np.clip(p90 + shift, 0, 1)

    # Who is affected: share of expected shortfall by household type
    contrib = mix * cell_rate
    who = contrib / np.maximum(contrib.sum(1, keepdims=True), 1e-9)

    drv = res.drivers[:, k, :].astype(float)
    total_short = res.counts[:, :, :, k].sum((1, 2)).astype(float)
    drv_share = np.clip(drv / np.maximum(total_short[:, None], 1), 0, 1)   # share of shortfalls where driver was decisive
    drv_share = np.round(drv_share * 20) / 20          # released only to the nearest 5%

    customers = n.sum(1)
    out = areas[["area_id", "msoa_code", "msoa_name", "lad", "imd_score", "gm_decile", "households"]].copy()
    out["customers"] = customers.astype(int)
    out["suppressed"] = customers < C.MIN_CUSTOMERS
    out["rate"] = rate
    out["rate_p10"], out["rate_p90"] = p10, p90
    out["rate_naive"] = naive
    out["count"] = rate * out["households"]
    out["count_p10"] = p10 * out["households"]
    out["count_p90"] = p90 * out["households"]
    for i, d in enumerate(C.DRIVERS):
        out[f"drv_{d}"] = drv_share[:, i]
    for i, t in enumerate(C.TYPES):
        out[f"who_{t}"] = who[:, i]
    cols = [c for c in out.columns if c.startswith(("rate", "count", "drv_", "who_"))]
    out.loc[out["suppressed"], cols] = np.nan
    city_paths = ((path_area + shift[:, None]) * out["households"].to_numpy()[:, None])[~out["suppressed"].to_numpy()].sum(0)
    out.attrs["city_p10"], out.attrs["city_p90"] = (float(x) for x in np.percentile(city_paths, [10, 90]))
    return out


def city_summary(af: pd.DataFrame) -> dict:
    ok = af[~af["suppressed"]]
    return {
        "households_at_risk": float(ok["count"].sum()),
        "households_at_risk_p10": af.attrs.get("city_p10", float(ok["count_p10"].sum())),
        "households_at_risk_p90": af.attrs.get("city_p90", float(ok["count_p90"].sum())),
        "rate": float(ok["count"].sum() / ok["households"].sum()),
        "rate_naive": float((ok["rate_naive"] * ok["households"]).sum() / ok["households"].sum()),
        "suppressed": int(af["suppressed"].sum()),
    }
