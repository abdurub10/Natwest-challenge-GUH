"""Synthetic population of NatWest customer households, grounded in real
Greater Manchester deprivation data."""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import config as C


def load_areas() -> pd.DataFrame:
    return pd.read_parquet(C.DATA / "areas.parquet").sort_values("area_id").reset_index(drop=True)


def _t(decile: np.ndarray) -> np.ndarray:
    """0 for the most deprived decile, 1 for the least deprived."""
    return (np.asarray(decile, dtype=float) - 1.0) / 9.0


def area_type_mix(areas: pd.DataFrame) -> np.ndarray:
    """True household-type mix per area, shape (n_areas, n_types). Stands in for census."""
    t = _t(areas["gm_decile"].to_numpy())[:, None]
    most = np.array([C.MIX_MOST_DEPRIVED[k] for k in C.TYPES])[None, :]
    least = np.array([C.MIX_LEAST_DEPRIVED[k] for k in C.TYPES])[None, :]
    mix = (1 - t) * most + t * least
    # Older areas have more pensioners (real: share aged 60+)
    older = (areas["share_60plus"].to_numpy() / areas["share_60plus"].mean())[:, None]
    mix[:, C.TYPES.index("pensioner_low")] *= older[:, 0]
    return mix / mix.sum(axis=1, keepdims=True)


def build_population(areas: pd.DataFrame, n: int = C.N_CUSTOMERS, seed: int = C.SEED_POPULATION) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    mix = area_type_mix(areas)
    t_area = _t(areas["gm_decile"].to_numpy())
    area_prop = C.CUSTOMER_PROPENSITY_MOST_DEPRIVED + t_area * (
        C.CUSTOMER_PROPENSITY_LEAST_DEPRIVED - C.CUSTOMER_PROPENSITY_MOST_DEPRIVED)
    type_prop = np.array([C.CUSTOMER_PROPENSITY_BY_TYPE[k] for k in C.TYPES])

    cell = areas["households"].to_numpy()[:, None] * mix * area_prop[:, None] * type_prop[None, :]
    cell_p = (cell / cell.sum()).ravel()
    idx = rng.choice(cell_p.size, size=n, p=cell_p)
    area_id, type_id = np.divmod(idx, len(C.TYPES))

    rows = []
    for i in range(n):
        a, ti = int(area_id[i]), int(type_id[i])
        typ = C.TYPES[ti]
        P = C.PERSONAS[typ]
        t = t_area[a]
        couple = rng.random() < {"uc_family": 0.4, "salaried_stretched": 0.5}.get(typ, 0.15)
        lo, hi = P["children"]
        children = int(rng.integers(lo, hi + 1))

        # Tenure and housing cost
        if typ == "pensioner_low":
            tenure = "owner" if rng.random() < 0.45 else ("social" if rng.random() < 0.6 else "private")
        elif typ == "salaried_stretched":
            tenure = "owner" if rng.random() < 0.3 + 0.4 * t else "private"
        else:
            tenure = "social" if rng.random() < 0.55 - 0.25 * t else "private"
        if tenure == "private":
            housing = rng.uniform(780, 1000) + 220 * t
        elif tenure == "social":
            housing = rng.uniform(420, 560)
        else:
            housing = 0.0 if typ == "pensioner_low" else rng.uniform(650, 950)
        if typ == "pensioner_low" and tenure != "owner":
            housing *= 0.25  # Housing Benefit covers most rent for low-income pensioners
        rent_day = 1 if rng.random() < 0.5 else int(rng.integers(1, 29))

        # Income
        wage = P["wage"] * rng.uniform(0.85, 1.15) * (0.92 + 0.16 * t)
        on_uc = rng.random() < P["p_uc"]
        renter = tenure in ("private", "social")
        max_award = (C.UC_STANDARD_COUPLE if couple else C.UC_STANDARD_SINGLE) \
            + C.UC_CHILD_ELEMENT * min(children, 2) \
            + (min(housing, C.UC_HOUSING_CAP) if renter else 0.0)
        carers = P.get("carers_allowance", 0.0)
        if carers:  # Carer's Allowance is deducted in full from UC (unearned income)
            max_award -= carers * 52 / 12
        has_wa = children > 0 or typ == "carer"
        work_allowance = (C.UC_WORK_ALLOWANCE_HOUSING if renter else C.UC_WORK_ALLOWANCE_NO_HOUSING) if has_wa else 0.0

        # Bills
        energy = rng.uniform(85, 130) * P.get("energy_mult", 1.0) * (1 + 0.1 * children)
        council_tax = rng.uniform(95, 125) + 45 * t
        if on_uc or (typ == "pensioner_low" and rng.random() < 0.6):
            council_tax *= 0.3  # Council Tax Support
        water = rng.uniform(30, 45)
        telecom = rng.uniform(35, 60)
        bnpl = P.get("bnpl", 0.0) if rng.random() < 0.7 else (30.0 if rng.random() < 0.25 else 0.0)

        spend = P["spend"] * (1 + (0.35 if couple else 0) + 0.18 * children) * rng.uniform(0.85, 1.15)
        rows.append(dict(
            area_id=a, type_id=ti, type=typ, sector=str(rng.choice(P["sectors"])),
            couple=couple, children=children, tenure=tenure,
            pay=P["pay"], wage=wage, wage_cv=P["wage_cv"],
            p_down=P["p_down"], p_cut=P["p_cut"], p_up=P["p_up"], p_restart=P["p_restart"],
            on_uc=on_uc, uc_max=max(max_award, 0.0) if on_uc else 0.0, uc_wa=work_allowance,
            ap_start_day=int(rng.integers(1, 29)), carers=carers,
            pension_offset=int(rng.integers(0, 28)),
            housing=housing, rent_day=rent_day,
            energy=energy, energy_day=int(rng.integers(1, 29)),
            council_tax=council_tax, water=water, water_day=int(rng.integers(1, 29)),
            telecom=telecom, telecom_day=int(rng.integers(1, 29)), bnpl=bnpl,
            spend=spend, spend_sd=P["spend_sd"],
            christmas=P["christmas"] * (1 + 0.3 * children) * rng.uniform(0.6, 1.4),
            surprise_rate=P["surprise_per_month"] / 30.0, surprise_mean=P["surprise_mean"],
            balance=float(rng.lognormal(np.log(P["balance"] * (0.7 + 0.6 * t)), 0.6)),
            savings=float(rng.exponential(P["savings"] * (0.6 + 0.8 * t))),
            overdraft=float(rng.choice([250.0, 500.0])) if rng.random() < P["p_overdraft"] else 0.0,
        ))
    hh = pd.DataFrame(rows)
    hh["private_renter"] = hh["tenure"] == "private"
    return hh
