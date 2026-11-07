"""Backtest the forecast against a hidden 'actual future' and two baselines.

Truth: one extra simulated path per household with a separate seed (the
forecast never sees it). Baselines a council could use today:
  persistence  - last period's hardship rate (truth for the previous 8 weeks)
  deprivation  - a line fitted on last period's rate vs deprivation score
Honest limit: truth comes from the same model family, so this checks the
pipeline and calibration, not real-world accuracy.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import config as C
from .aggregate import SHRINK


def auc(y: np.ndarray, p: np.ndarray) -> float:
    order = np.argsort(p)
    ranks = np.empty(len(p))
    ranks[order] = np.arange(1, len(p) + 1)
    # average ties
    s = pd.Series(ranks).groupby(p).transform("mean").to_numpy()
    pos = y == 1
    n1, n0 = pos.sum(), (~pos).sum()
    return float((s[pos].sum() - n1 * (n1 + 1) / 2) / (n1 * n0))


def spearman(a: np.ndarray, b: np.ndarray) -> float:
    return float(pd.Series(a).rank().corr(pd.Series(b).rank()))


def top_k_precision(pred: np.ndarray, truth: np.ndarray, k: int = 20) -> float:
    return len(set(np.argsort(-pred)[:k]) & set(np.argsort(-truth)[:k])) / k


def run(hh: pd.DataFrame, forecast_p: np.ndarray, truth_p: np.ndarray, prev_truth_p: np.ndarray,
        areas: pd.DataFrame, mix: np.ndarray, forecast_area: pd.DataFrame, k: int) -> dict:
    y = truth_p[:, k].astype(int)
    p = forecast_p[:, k]

    # Calibration
    bins = np.clip((p * 10).astype(int), 0, 9)
    calib = pd.DataFrame({"bin": bins, "p": p, "y": y}).groupby("bin").agg(
        forecast=("p", "mean"), observed=("y", "mean"), n=("y", "size")).reset_index()

    def area_rate(values: np.ndarray) -> np.ndarray:
        A, T = len(areas), len(C.TYPES)
        n = np.zeros((A, T)); s = np.zeros((A, T))
        a, t = hh["area_id"].to_numpy(), hh["type_id"].to_numpy()
        np.add.at(n, (a, t), 1); np.add.at(s, (a, t), values)
        city = s.sum(0) / np.maximum(n.sum(0), 1)
        r = (s + SHRINK * city[None, :]) / (n + SHRINK)   # same estimator as the released forecast
        return (mix * r).sum(1)

    ok = ~forecast_area["suppressed"].to_numpy()
    true_rate = area_rate(y)[ok]
    fc = forecast_area["rate"].to_numpy()[ok]
    lo, hi = forecast_area["rate_p10"].to_numpy()[ok], forecast_area["rate_p90"].to_numpy()[ok]
    persist = area_rate(prev_truth_p[:, k])[ok]
    imd = areas["imd_score"].to_numpy()[ok]
    b1, b0 = np.polyfit(imd, persist, 1)
    depriv = b0 + b1 * imd

    def scores(pred):
        return {"MAE (pp)": float(np.abs(pred - true_rate).mean() * 100),
                "Spearman": spearman(pred, true_rate),
                "Top-20 precision": top_k_precision(pred, true_rate)}

    table = pd.DataFrame({
        "Undertow": scores(fc),
        "Deprivation rank": scores(depriv),
        "Last period (persistence)": scores(persist),
    }).T
    return {
        "household_auc": auc(y, p),
        "household_brier": float(np.mean((p - y) ** 2)),
        "base_rate": float(y.mean()),
        "coverage_80": float(np.mean((true_rate >= lo) & (true_rate <= hi))),
        "calibration": calib,
        "table": table,
        "area_points": pd.DataFrame({"forecast": fc, "actual": true_rate, "lo": lo, "hi": hi,
                                     "name": forecast_area["msoa_name"].to_numpy()[ok]}),
        "n_areas": int(ok.sum()),
    }
