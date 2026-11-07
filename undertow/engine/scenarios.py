"""Policy and economic shock scenarios."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class Scenario:
    name: str = "Baseline"
    energy_pct: float = 0.0            # +0.10 = energy bills up 10% from the next bill
    private_rent_pct: float = 0.0      # applied to private renters
    uc_standard_delta: float = 0.0     # £/month change to the UC standard allowance
    hours_cut: tuple = ()              # ((sector, fraction), ...)
    grant: float = 0.0                 # one-off grant paid on day 7 to households flagged by `grant_mask`

    def key(self) -> str:
        return repr(asdict(self))

    @property
    def is_baseline(self) -> bool:
        return (self.energy_pct == 0 and self.private_rent_pct == 0 and self.uc_standard_delta == 0
                and not any(f for _, f in self.hours_cut) and self.grant == 0)


PRESETS = {
    "Baseline": Scenario(),
    "Energy bills +10%": Scenario(name="Energy bills +10%", energy_pct=0.10),
    "Private rents +6%": Scenario(name="Private rents +6%", private_rent_pct=0.06),
    "Hospitality hours −20%": Scenario(name="Hospitality hours −20%", hours_cut=(("hospitality", 0.20),)),
    "UC standard allowance +£20/month": Scenario(name="UC standard allowance +£20/month", uc_standard_delta=20.0),
}


def apply(hh: pd.DataFrame, s: Scenario) -> tuple[pd.DataFrame, np.ndarray]:
    """Return (modified households, wage multiplier per household)."""
    out = hh.copy()
    if s.energy_pct:
        out["energy"] = out["energy"] * (1 + s.energy_pct)
    if s.private_rent_pct:
        out.loc[out["private_renter"], "housing"] *= (1 + s.private_rent_pct)
    if s.uc_standard_delta:
        out.loc[out["on_uc"], "uc_max"] += s.uc_standard_delta
    wage_mult = np.ones(len(out), dtype=np.float32)
    for sector, frac in s.hours_cut:
        wage_mult[(out["sector"] == sector).to_numpy()] *= (1 - frac)
    return out, wage_mult


def affected_mask(hh: pd.DataFrame, s: Scenario) -> np.ndarray:
    """Households whose inputs change under the scenario (only these need re-running)."""
    m = np.zeros(len(hh), dtype=bool)
    if s.energy_pct:
        m |= True
    if s.private_rent_pct:
        m |= hh["private_renter"].to_numpy()
    if s.uc_standard_delta:
        m |= hh["on_uc"].to_numpy()
    for sector, frac in s.hours_cut:
        if frac:
            m |= (hh["sector"] == sector).to_numpy()
    return m
