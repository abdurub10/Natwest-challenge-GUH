"""Orchestration: build the population once, run scenarios, truth and backtest."""
from __future__ import annotations

import datetime as dt

import numpy as np

from . import config as C
from .allocate import GRANT
from .population import area_type_mix, build_population, load_areas
from .scenarios import Scenario, apply
from .simulate import SimResult, simulate


class World:
    def __init__(self):
        self.areas = load_areas()
        self.mix = area_type_mix(self.areas)
        self.hh = build_population(self.areas)
        self.n_areas = len(self.areas)
        self._cache: dict[str, SimResult] = {}

    def run(self, s: Scenario) -> SimResult:
        key = s.key()
        if key not in self._cache:
            hh, wage_mult = apply(self.hh, s)
            grant = np.full(len(hh), s.grant, dtype=np.float32) if s.grant else None
            self._cache[key] = simulate(hh, self.n_areas, wage_mult=wage_mult, grant=grant)
        return self._cache[key]

    def truth(self) -> SimResult:
        if "truth" not in self._cache:
            self._cache["truth"] = simulate(self.hh, self.n_areas, n_paths=1, seed=C.SEED_TRUTH)
        return self._cache["truth"]

    def previous_truth(self) -> SimResult:
        if "prev" not in self._cache:
            start = C.DEMO_TODAY - dt.timedelta(days=C.HORIZON_DAYS)
            self._cache["prev"] = simulate(self.hh, self.n_areas, start=start, n_paths=1, seed=C.SEED_TRUTH + 1)
        return self._cache["prev"]

    def grant_delta(self, k: int) -> np.ndarray:
        with_grant = self.run(Scenario(name=f"£{GRANT:.0f} grant", grant=GRANT))
        return np.clip(self.run(Scenario()).p_short[:, k] - with_grant.p_short[:, k], 0, None)
