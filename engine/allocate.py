"""Crisis fund allocator: which areas should a fixed crisis budget go to?

The engine is re-run once with a one-off £GRANT payment to every customer
household, using the same random numbers, so the difference is the grant's
effect: delta_i = drop in household i's shortfall probability.

Councils allocate to areas, and within an area support goes to the households
who come forward, roughly in proportion to their risk. So for each area:
  value per grant = sum(p_i * delta_i) / sum(p_i)   (risk-weighted, per customer)
  capacity        = expected at-risk households in the area (no area gets more
                    grants than it has households at risk)
Every strategy uses this same within-area mechanism; they only differ in which
areas they fund first:
  Undertow     - highest forecast value per grant first (greedy; optimal for equal-cost grants)
  Deprivation  - most deprived areas first
  Even split   - in proportion to households
"""
from __future__ import annotations

import numpy as np
import pandas as pd

GRANT = 150.0


def allocate(hh: pd.DataFrame, areas: pd.DataFrame, area_fc: pd.DataFrame, p: np.ndarray,
             delta: np.ndarray, budget: float) -> dict:
    A = len(areas)
    a = hh["area_id"].to_numpy()
    sp = np.bincount(a, weights=p, minlength=A)
    value = np.where(sp > 0, np.bincount(a, weights=p * delta, minlength=A) / np.maximum(sp, 1e-9), 0.0)
    capacity = np.nan_to_num(area_fc["count"].to_numpy(), nan=0.0)
    value[area_fc["suppressed"].to_numpy()] = 0.0
    n_grants = budget / GRANT

    def fill(order: np.ndarray) -> np.ndarray:
        g = np.zeros(A)
        left = n_grants
        for i in order:
            if left <= 0:
                break
            take = min(capacity[i], left)
            g[i] = take
            left -= take
        return g

    g_u = fill(np.argsort(-value))
    g_d = fill(np.argsort(-areas["imd_score"].to_numpy()))
    hhs = areas["households"].to_numpy().astype(float)
    g_e = np.minimum(capacity, n_grants * hhs / hhs.sum())

    saved = {name: float((g * value).sum()) for name, g in
             (("Undertow", g_u), ("Deprivation rank", g_d), ("Even split", g_e))}
    plan = areas[["area_id", "msoa_name", "lad", "gm_decile"]].copy()
    plan["grants"], plan["value_per_grant"] = g_u, value
    plan["amount"] = plan["grants"] * GRANT
    plan["protected"] = plan["grants"] * value
    plan = plan[plan["grants"] >= 1].sort_values("amount", ascending=False)
    return {"budget": budget, "grant": GRANT, "grants": n_grants, "saved": saved, "plan": plan,
            "value": value, "areas_funded": int((g_u >= 1).sum())}
