import datetime as dt

import numpy as np
import pandas as pd

from engine import config as C
from engine.aggregate import SHRINK
from engine.calendar import next_working_day, previous_working_day
from engine.simulate import Calendar
from engine.uc import award
from llm.numbercheck import check


def test_working_day_shifts():
    assert previous_working_day(dt.date(2027, 1, 2)) == dt.date(2026, 12, 31)   # Sat, and 1 Jan is a bank holiday
    assert next_working_day(dt.date(2026, 12, 5)) == dt.date(2026, 12, 7)
    assert previous_working_day(dt.date(2026, 12, 25)) == dt.date(2026, 12, 24)


def test_five_payday_uc_cut():
    four = award(1342.95, 4 * 280, 411)
    five = award(1342.95, 5 * 280, 411)
    assert round(float(four)) == 953
    assert round(float(five)) == 799
    assert 150 < float(four - five) < 160


def test_uc_payment_dates_and_paydays():
    cal = Calendar(dt.date(2026, 11, 7))
    ap_slot, pay_slot, pre, total = cal.uc_tables(27, "weekly")
    pay_days = [cal.dates[i] for i in range(cal.days) if pay_slot[i] >= 0]
    # AP 27 Nov - 26 Dec: paid 7 days later, moved earlier past the 1 Jan bank holiday
    assert dt.date(2026, 12, 31) in pay_days
    assert total[1] == 5          # Fridays 27 Nov, 4, 11, 18 and 24 Dec (25 Dec moved earlier)


def test_number_check():
    allowed = ["1,820", "30%", "6"]
    assert check("About 1,820 households (30%) within 6 weeks", allowed) == []
    assert check("About 2,000 households", allowed) == ["2,000"]


def test_privacy_sensitivity_bounds():
    mix = np.array([[0.5, 0.5]])
    n = np.array([[10, 40]])
    sens = (mix / (n + SHRINK)).max()
    assert abs(sens - 0.5 / (10 + SHRINK)) < 1e-12
    rng = np.random.default_rng(0)
    draws = rng.laplace(0, sens / C.EPSILON, 20_000)
    assert abs(draws.std() - np.sqrt(2) * sens / C.EPSILON) < 0.01
