"""Structural Monte Carlo simulation of every household's daily cash flow.

For each household and each of N paths, simulate day by day:
  income   - pay regimes (normal / reduced / zero) as a weekly Markov chain,
             log-normal pay noise, shared area x sector shocks, pensions,
             Carer's Allowance, and Universal Credit computed from that path's
             own wages per assessment period (the real five-payday effect)
  outgoings - rent, energy, council tax, water, telecoms, BNPL on their real
             due dates (moved to the next working day), daily essentials,
             Christmas, and surprise costs (compound Poisson)
A path is in shortfall the first day balance + savings < -overdraft limit.
Each shortfall records which drivers were decisive: without that shock alone,
the household would not have fallen short.
"""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from functools import lru_cache

import numpy as np
import pandas as pd

from . import config as C
from .calendar import is_working_day, monthly_dates, next_working_day, previous_working_day
from .uc import assessment_periods, award, pay_date

REDUCED_PAY = 0.6
N_SLOTS = 3


@dataclass
class SimResult:
    p_short: np.ndarray          # (n_households, n_horizons) probability of shortfall by each horizon
    counts: np.ndarray           # (n_areas, n_types, n_paths, n_horizons) customers in shortfall per path
    drivers: np.ndarray          # (n_areas, n_horizons, n_drivers) shortfall paths by main driver
    first_day: np.ndarray        # (n_households,) median first shortfall day (or -1)
    n_paths: int


# ---------------------------------------------------------------------------
# Calendars (deterministic, cached per start date)
# ---------------------------------------------------------------------------
class Calendar:
    def __init__(self, start: dt.date, days: int = C.HORIZON_DAYS):
        self.start, self.days = start, days
        self.dates = [start + dt.timedelta(days=i) for i in range(days)]
        self.end = start + dt.timedelta(days=days)
        self.index = {d: i for i, d in enumerate(self.dates)}
        self.weekday = np.array([d.weekday() for d in self.dates])

    def _idx(self, d: dt.date) -> int | None:
        return self.index.get(d)

    @lru_cache(maxsize=None)
    def debit_days(self, day_of_month: int, skip_feb_mar: bool = False) -> tuple[int, ...]:
        out = []
        for d in monthly_dates(self.start - dt.timedelta(days=5), self.end, day_of_month):
            if skip_feb_mar and d.month in (2, 3):
                continue
            i = self._idx(next_working_day(d))
            if i is not None:
                out.append(i)
        return tuple(sorted(set(out)))

    def pay_dates(self, pay: str, ext_start: dt.date) -> list[dt.date]:
        """Actual pay dates for weekly (Friday) or monthly (28th) pay from ext_start to end."""
        out = []
        if pay == "weekly":
            d = ext_start + dt.timedelta(days=(4 - ext_start.weekday()) % 7)
            while d < self.end:
                out.append(previous_working_day(d))
                d += dt.timedelta(days=7)
        elif pay == "monthly":
            out = [previous_working_day(d) for d in monthly_dates(ext_start, self.end, 28)]
        return out

    @lru_cache(maxsize=None)
    def uc_tables(self, ap_start_day: int, pay: str):
        """For one AP start day and pay pattern:
        ap_slot[d]   which payment slot day d's wages count towards (-1 = none in window)
        pay_slot[d]  which slot's UC is paid on day d (-1 = none)
        pre_pays[s]  number of paydays in slot s's period that fall before the window
        cal_pays[s]  number of paydays in slot s's period in total (calendar)"""
        ap_slot = -np.ones(self.days, dtype=np.int8)
        pay_slot = -np.ones(self.days, dtype=np.int8)
        pre_pays = np.zeros(N_SLOTS)
        cal_pays = np.zeros(N_SLOTS)
        ext = self.start - dt.timedelta(days=70)
        paydays = self.pay_dates(pay, ext) if pay in ("weekly", "monthly") else []
        s = 0
        for first, last in assessment_periods(ap_start_day, self.start, self.end):
            pd_ = pay_date(last)
            i_pay = self._idx(pd_)
            if i_pay is None or s >= N_SLOTS:
                continue
            pay_slot[i_pay] = s
            for d in self.dates:
                if first <= d <= last:
                    ap_slot[self.index[d]] = s
            pre_pays[s] = sum(1 for p in paydays if first <= p <= last and p < self.start)
            cal_pays[s] = sum(1 for p in paydays if first <= p <= last)
            s += 1
        return ap_slot, pay_slot, pre_pays, cal_pays

    @lru_cache(maxsize=None)
    def payday_mask(self, pay: str) -> np.ndarray:
        m = np.zeros(self.days, dtype=bool)
        for p in self.pay_dates(pay, self.start):
            i = self._idx(p)
            if i is not None:
                m[i] = True
        return m

    @lru_cache(maxsize=None)
    def pension_mask(self, offset: int) -> np.ndarray:
        m = np.zeros(self.days, dtype=bool)
        anchor = dt.date(2026, 1, 5) + dt.timedelta(days=offset)  # a Monday + offset, every 28 days
        k = (self.start - anchor).days // 28
        d = anchor + dt.timedelta(days=28 * k)
        while d < self.end:
            if d >= self.start - dt.timedelta(days=4):
                i = self._idx(previous_working_day(d))
                if i is not None:
                    m[i] = True
            d += dt.timedelta(days=28)
        return m

    @lru_cache(maxsize=None)
    def christmas_days(self) -> np.ndarray:
        return np.array([1.0 if (d.month == 12 and d.day <= 24) else 0.0 for d in self.dates])


def _schedules(hh: pd.DataFrame, cal: Calendar):
    """Deterministic per-household day schedules for one chunk."""
    H, D = len(hh), cal.days
    bills = np.zeros((H, D), dtype=np.float32)
    credits = np.zeros((H, D), dtype=np.float32)
    payday = np.zeros((H, D), dtype=bool)
    ap_slot = -np.ones((H, D), dtype=np.int8)
    pay_slot = -np.ones((H, D), dtype=np.int8)
    pre_w = np.zeros((H, N_SLOTS), dtype=np.float32)
    uc_normal = np.zeros(H, dtype=np.float32)
    xmas = cal.christmas_days() / 24.0

    for j, r in enumerate(hh.itertuples(index=False)):
        for amt, day, skip in ((r.housing, r.rent_day, False), (r.energy, r.energy_day, False),
                               (r.council_tax, 1, True), (r.water, r.water_day, False),
                               (r.telecom, r.telecom_day, False), (r.bnpl, 28, False)):
            if amt:
                bills[j, list(cal.debit_days(int(day), skip))] += amt
        if r.pay == "pension":
            credits[j, cal.pension_mask(int(r.pension_offset))] += r.wage
        else:
            payday[j] = cal.payday_mask(r.pay)
        if r.carers:
            credits[j, cal.weekday == 0] += r.carers
        if r.on_uc and r.pay in ("weekly", "monthly"):
            a, p, pre, cal_n = cal.uc_tables(int(r.ap_start_day), r.pay)
            ap_slot[j], pay_slot[j] = a, p
            pre_w[j] = pre * r.wage
            normal_earn = r.wage * (52 / 12 if r.pay == "weekly" else 1.0)
            uc_normal[j] = award(r.uc_max, normal_earn, r.uc_wa)
        elif r.on_uc:
            a, p, pre, cal_n = cal.uc_tables(int(r.ap_start_day), "none")
            pay_slot[j] = p
            uc_normal[j] = r.uc_max
    return bills, credits, payday, ap_slot, pay_slot, pre_w, uc_normal, xmas


def _area_shocks(n_areas: int, n_paths: int, days: int, rng: np.random.Generator):
    S = len(C.SECTORS)
    active = rng.random((n_areas, S, n_paths)) < C.AREA_SHOCK_PROB
    active[:, C.SECTORS.index("none"), :] = False
    start = rng.integers(0, days - 7, size=(n_areas, S, n_paths))
    length = rng.integers(14, 43, size=(n_areas, S, n_paths))
    size = rng.uniform(*C.AREA_SHOCK_SIZE, size=(n_areas, S, n_paths))
    return active, start, start + length, size.astype(np.float32)


def simulate(hh: pd.DataFrame, n_areas: int, start: dt.date = C.DEMO_TODAY, n_paths: int = C.N_PATHS,
             seed: int = C.SEED_FORECAST, wage_mult: np.ndarray | None = None,
             grant: np.ndarray | None = None) -> SimResult:
    cal = Calendar(start)
    D = cal.days
    T = len(C.TYPES)
    K = len(C.HORIZONS)
    hz = np.array(C.HORIZONS)
    rng = np.random.default_rng(seed)
    shock_active, shock_start, shock_end, shock_size = _area_shocks(n_areas, n_paths, D, rng)
    sector_idx = hh["sector"].map({s: i for i, s in enumerate(C.SECTORS)}).to_numpy()
    wage_mult = np.ones(len(hh), dtype=np.float32) if wage_mult is None else wage_mult
    grant = np.zeros(len(hh), dtype=np.float32) if grant is None else grant

    p_short = np.zeros((len(hh), K), dtype=np.float32)
    first_day = -np.ones(len(hh), dtype=np.int16)
    counts = np.zeros((n_areas, T, n_paths, K), dtype=np.int32)
    drivers = np.zeros((n_areas, K, len(C.DRIVERS)), dtype=np.int32)

    for c0 in range(0, len(hh), C.CHUNK):
        sl = slice(c0, min(c0 + C.CHUNK, len(hh)))
        ch = hh.iloc[sl]
        H = len(ch)
        bills, credits, payday, ap_slot, pay_slot, pre_w, uc_normal, xmas = _schedules(ch, cal)
        a_idx = ch["area_id"].to_numpy()
        t_idx = ch["type_id"].to_numpy()
        s_idx = sector_idx[sl]
        sh_act = shock_active[a_idx, s_idx]          # (H, P)
        sh_s, sh_e, sh_z = shock_start[a_idx, s_idx], shock_end[a_idx, s_idx], shock_size[a_idx, s_idx]

        f32 = lambda col: ch[col].to_numpy(dtype=np.float32)[:, None]
        wage, cv = f32("wage"), f32("wage_cv")
        wmult = wage_mult[sl][:, None]
        p_down, p_cut, p_up, p_restart = f32("p_down"), f32("p_cut"), f32("p_up"), f32("p_restart")
        uc_max, uc_wa = f32("uc_max"), f32("uc_wa")
        spend, spend_sd = f32("spend"), f32("spend_sd")
        s_rate, s_mean = f32("surprise_rate"), f32("surprise_mean")
        xmas_total = f32("christmas") * rng.lognormal(-0.03, 0.25, size=(H, n_paths)).astype(np.float32)
        floor = -f32("overdraft")
        on_uc = ch["on_uc"].to_numpy()

        # Opening balance: money already held for bills due in the next 10 days, plus a free buffer
        held = 0.9 * bills[:, :10].sum(axis=1, keepdims=True)
        bal = (f32("balance") + f32("savings") + held) * np.ones((1, n_paths), dtype=np.float32)
        regime = np.zeros((H, n_paths), dtype=np.int8)
        ap_w = np.repeat(pre_w[:, None, :], n_paths, axis=1)          # (H, P, slots)
        inc_loss = np.zeros((H, n_paths), dtype=np.float32)
        uc_red = np.zeros_like(inc_loss)
        surprise = np.zeros_like(inc_loss)
        xmas_cum = np.zeros_like(inc_loss)
        first = np.full((H, n_paths), D, dtype=np.int16)
        driver = np.zeros((H, n_paths), dtype=np.int16)

        for d in range(D):
            if cal.weekday[d] == 0 and d > 0:  # weekly pay-regime transition
                r = rng.random((H, n_paths), dtype=np.float32)
                nxt = regime.copy()
                nxt[(regime == 0) & (r < p_down)] = 1
                nxt[(regime == 1) & (r < p_cut)] = 2
                nxt[(regime == 1) & (r > 1 - p_up)] = 0
                nxt[(regime == 2) & (r < p_restart)] = 0
                regime = nxt

            pay = payday[:, d]
            if pay.any():
                ridx = np.where(pay)[0]
                reg = regime[ridx]
                mult = np.where(reg == 0, 1.0, np.where(reg == 1, REDUCED_PAY, 0.0)).astype(np.float32)
                shock = sh_act[ridx] & (d >= sh_s[ridx]) & (d < sh_e[ridx])
                mult *= np.where(shock, 1 - sh_z[ridx], 1.0)
                sig = cv[ridx]
                noise = rng.lognormal(0, 1, size=mult.shape).astype(np.float32) ** sig * np.exp(-sig ** 2 / 2)
                real = wage[ridx] * wmult[ridx] * mult * noise
                bal[ridx] += real
                inc_loss[ridx] += wage[ridx] - real
                slots = ap_slot[ridx, d]
                for s in range(N_SLOTS):
                    m = (slots == s) & on_uc[ridx]
                    if m.any():
                        ap_w[ridx[m], :, s] += real[m]

            cr = credits[:, d]
            if cr.any():
                bal += cr[:, None]
            ps = pay_slot[:, d]
            for s in range(N_SLOTS):
                m = (ps == s) & on_uc
                if m.any():
                    got = award(uc_max[m], ap_w[m, :, s], uc_wa[m]).astype(np.float32)
                    bal[m] += got
                    uc_red[m] += np.maximum(0.0, uc_normal[m][:, None] - got)
            if d == 7:
                bal += grant[sl][:, None]

            # outgoings
            bal -= bills[:, d][:, None]
            if xmas[d]:
                x = xmas_total * xmas[d]
                bal -= x
                xmas_cum += x
            bal -= np.maximum(0.0, spend + spend_sd * rng.standard_normal((H, n_paths), dtype=np.float32))
            hit = rng.random((H, n_paths), dtype=np.float32) < s_rate
            if hit.any():
                cost = np.zeros_like(bal)
                cost[hit] = rng.lognormal(0, 0.6, size=int(hit.sum())).astype(np.float32) * \
                    np.broadcast_to(s_mean, hit.shape)[hit] * np.exp(-0.18)
                bal -= cost
                surprise += cost

            new = (bal < floor) & (first == D)
            if new.any():
                first[new] = d
                # A driver is "decisive" if, without it, the household would not have fallen short
                comps = np.stack([inc_loss[new], uc_red[new], surprise[new], xmas_cum[new]], axis=1)
                gap = (floor * np.ones_like(bal))[new] - bal[new]
                decisive = comps >= gap[:, None]
                bits = (decisive * (1 << np.arange(4))).sum(axis=1)
                bits[bits == 0] = 1 << 4                      # nothing alone explains it: costs > income
                driver[new] = bits

        short = first[:, :, None] < hz[None, None, :]                 # (H, P, K)
        p_short[sl] = short.mean(axis=1)
        med = np.median(np.where(first < D, first, 10_000), axis=1)
        first_day[sl] = np.where(med < D, med, -1)
        np.add.at(counts, (a_idx, t_idx), short.astype(np.int32))
        for k in range(K):
            sk = short[:, :, k]
            for v in range(len(C.DRIVERS)):
                np.add.at(drivers[:, k, v], a_idx, (sk & ((driver >> v) & 1).astype(bool)).sum(axis=1))

    return SimResult(p_short=p_short, counts=counts, drivers=drivers, first_day=first_day, n_paths=n_paths)
