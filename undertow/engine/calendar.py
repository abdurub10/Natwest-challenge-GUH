"""UK working-day rules (real): credits move earlier, debits move later."""
from __future__ import annotations

import datetime as dt

from .config import BANK_HOLIDAYS


def is_working_day(d: dt.date) -> bool:
    return d.weekday() < 5 and d not in BANK_HOLIDAYS


def previous_working_day(d: dt.date) -> dt.date:
    while not is_working_day(d):
        d -= dt.timedelta(days=1)
    return d


def next_working_day(d: dt.date) -> dt.date:
    while not is_working_day(d):
        d += dt.timedelta(days=1)
    return d


def month_day(year: int, month: int, day: int) -> dt.date:
    """Date for a day-of-month, clamped to the month's length."""
    for dd in range(day, 27, -1):
        try:
            return dt.date(year, month, dd)
        except ValueError:
            continue
    return dt.date(year, month, min(day, 28))


def monthly_dates(start: dt.date, end: dt.date, day: int) -> list[dt.date]:
    """Nominal monthly dates on `day` between start (inclusive) and end (exclusive)."""
    out = []
    y, m = start.year, start.month
    for _ in range(7):
        d = month_day(y, m, day)
        if start <= d < end:
            out.append(d)
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return out
