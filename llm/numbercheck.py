"""Reject any number in Claude's text that is not in the facts it was given."""
from __future__ import annotations

import re

NUM = re.compile(r"£?\d[\d,]*(?:\.\d+)?%?")


def _val(tok: str) -> float:
    return float(tok.replace("£", "").replace(",", "").replace("%", ""))


def check(text: str, allowed: list[str], tol: float = 1.0) -> list[str]:
    """Return the number tokens in `text` that are not in `allowed` (within tol)."""
    allowed_vals = [_val(a) for a in allowed if NUM.fullmatch(a.strip())]
    bad = []
    for tok in NUM.findall(text):
        v = _val(tok)
        if not any(abs(v - a) <= tol for a in allowed_vals):
            bad.append(tok)
    return bad
