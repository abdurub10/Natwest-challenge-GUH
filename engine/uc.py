"""Universal Credit rules (real, gov.uk): monthly assessment periods, 55% taper,
work allowance, payment 7 days after the period ends (earlier if that is not a
working day)."""
from __future__ import annotations

import datetime as dt

import numpy as np

from .calendar import month_day, previous_working_day
from .config import UC_PAY_LAG_DAYS, UC_TAPER


def award(max_award, earnings, work_allowance):
    """Vectorised UC award for one assessment period."""
    return np.maximum(0.0, max_award - UC_TAPER * np.maximum(0.0, earnings - work_allowance))


def assessment_periods(ap_start_day: int, start: dt.date, end: dt.date) -> list[tuple[dt.date, dt.date]]:
    """Assessment periods (first day, last day) overlapping [start, end)."""
    periods = []
    y, m = start.year, start.month - 1
    if m == 0:
        y, m = y - 1, 12
    for _ in range(5):
        first = month_day(y, m, ap_start_day)
        ny, nm = (y + 1, 1) if m == 12 else (y, m + 1)
        last = month_day(ny, nm, ap_start_day) - dt.timedelta(days=1)
        if last >= start - dt.timedelta(days=40) and first < end:
            periods.append((first, last))
        y, m = ny, nm
    return periods


def pay_date(period_last_day: dt.date) -> dt.date:
    return previous_working_day(period_last_day + dt.timedelta(days=UC_PAY_LAG_DAYS))
