"""Central configuration: dates, seeds, household types and stated assumptions.

Every assumption that shapes the synthetic population lives here so it can be
shown on the Trust tab. Real inputs (geography, deprivation, UC rules, bank
holidays) are labelled as such.
"""
from __future__ import annotations

import datetime as dt
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "processed"

DEMO_TODAY = dt.date.fromisoformat(os.environ.get("DEMO_TODAY", "2026-11-07"))
HORIZON_DAYS = 56                      # 8 weeks
HORIZONS = (14, 28, 42, 56)           # 2, 4, 6, 8 weeks
N_PATHS = 200                          # Monte Carlo paths per household
N_CUSTOMERS = 36_000                   # synthetic NatWest customer households
CHUNK = 3_000                          # households simulated at once

SEED_POPULATION = 20261107
SEED_FORECAST = 7
SEED_TRUTH = 99_991                    # hidden "actual future" - never seen by the forecast

# ---- Privacy -------------------------------------------------------------
EPSILON = 1.0                          # per released area statistic (Laplace mechanism)
MIN_CUSTOMERS = 50                     # areas below this are suppressed

# ---- Real rules: Universal Credit (2025/26 rates, illustrative) -----------
UC_STANDARD_SINGLE = 400.14
UC_STANDARD_COUPLE = 628.10
UC_CHILD_ELEMENT = 292.81
UC_HOUSING_CAP = 750.00                # stand-in for the local housing allowance cap (assumption)
UC_WORK_ALLOWANCE_HOUSING = 411.00
UC_WORK_ALLOWANCE_NO_HOUSING = 684.00
UC_TAPER = 0.55
UC_PAY_LAG_DAYS = 7

# England and Wales bank holidays (gov.uk)
BANK_HOLIDAYS = {
    dt.date(2026, 1, 1), dt.date(2026, 4, 3), dt.date(2026, 4, 6), dt.date(2026, 5, 4),
    dt.date(2026, 5, 25), dt.date(2026, 8, 31), dt.date(2026, 12, 25), dt.date(2026, 12, 28),
    dt.date(2027, 1, 1), dt.date(2027, 3, 26), dt.date(2027, 3, 29),
}

# ---- Household types (synthetic, all money in £) ------------------------
TYPES = ["gig_worker", "zero_hours", "uc_family", "carer", "pensioner_low", "salaried_stretched"]
TYPE_LABELS = {
    "gig_worker": "Gig / delivery workers",
    "zero_hours": "Zero-hours workers",
    "uc_family": "Working families on Universal Credit",
    "carer": "Carers",
    "pensioner_low": "Pensioners on low incomes",
    "salaried_stretched": "Stretched salaried households",
}
SECTORS = ["hospitality", "retail", "logistics", "care", "office", "none"]

# pay: weekly (Friday), monthly (28th), pension (every 4 weeks)
PERSONAS = {
    "gig_worker": dict(pay="weekly", wage=345, wage_cv=0.30, p_uc=0.5, children=(0, 1),
                       p_down=0.10, p_cut=0.15, p_up=0.40, p_restart=0.35,
                       spend=13, spend_sd=6, christmas=230, surprise_per_month=0.8, surprise_mean=110,
                       balance=320, savings=80, p_overdraft=0.5, sectors=["logistics", "hospitality"]),
    "zero_hours": dict(pay="weekly", wage=305, wage_cv=0.22, p_uc=0.6, children=(0, 2),
                       p_down=0.07, p_cut=0.10, p_up=0.45, p_restart=0.45,
                       spend=12, spend_sd=5, christmas=250, surprise_per_month=0.7, surprise_mean=100,
                       balance=300, savings=90, p_overdraft=0.5, sectors=["retail", "hospitality"]),
    "uc_family": dict(pay="weekly", wage=280, wage_cv=0.10, p_uc=1.0, children=(1, 3),
                      p_down=0.04, p_cut=0.05, p_up=0.55, p_restart=0.55,
                      spend=19, spend_sd=7, christmas=300, surprise_per_month=0.75, surprise_mean=110,
                      balance=280, savings=60, p_overdraft=0.6, sectors=["care", "retail"]),
    "carer": dict(pay="weekly", wage=115, wage_cv=0.20, p_uc=0.7, children=(0, 1), carers_allowance=83.30,
                  p_down=0.05, p_cut=0.05, p_up=0.5, p_restart=0.5,
                  spend=10, spend_sd=4, christmas=180, surprise_per_month=0.65, surprise_mean=100,
                  balance=260, savings=120, p_overdraft=0.4, sectors=["care", "retail"]),
    "pensioner_low": dict(pay="pension", wage=900, wage_cv=0.0, p_uc=0.0, children=(0, 0),
                          p_down=0.0, p_cut=0.0, p_up=1.0, p_restart=1.0,
                          spend=11, spend_sd=4, christmas=150, surprise_per_month=0.45, surprise_mean=130,
                          balance=450, savings=700, p_overdraft=0.2, sectors=["none"], energy_mult=1.25),
    "salaried_stretched": dict(pay="monthly", wage=2650, wage_cv=0.03, p_uc=0.1, children=(0, 2),
                               p_down=0.01, p_cut=0.01, p_up=0.6, p_restart=0.6,
                               spend=19, spend_sd=7, christmas=480, surprise_per_month=0.7, surprise_mean=150,
                               balance=700, savings=600, p_overdraft=0.7, sectors=["office", "retail", "logistics"],
                               bnpl=60),
}

# Household-type mix by deprivation (decile 1 = most deprived). Stands in for census
# household composition. Interpolated linearly between the two ends.
MIX_MOST_DEPRIVED = {"gig_worker": 0.14, "zero_hours": 0.18, "uc_family": 0.26, "carer": 0.10,
                     "pensioner_low": 0.17, "salaried_stretched": 0.15}
MIX_LEAST_DEPRIVED = {"gig_worker": 0.05, "zero_hours": 0.06, "uc_family": 0.06, "carer": 0.06,
                      "pensioner_low": 0.12, "salaried_stretched": 0.65}

# Who banks with NatWest (deliberately biased, so census reweighting matters)
CUSTOMER_PROPENSITY_BY_TYPE = {"gig_worker": 0.75, "zero_hours": 0.85, "uc_family": 0.8, "carer": 0.9,
                               "pensioner_low": 1.0, "salaried_stretched": 1.2}
CUSTOMER_PROPENSITY_MOST_DEPRIVED = 0.7
CUSTOMER_PROPENSITY_LEAST_DEPRIVED = 1.2

# Shared area x sector shocks (per Monte Carlo path)
AREA_SHOCK_PROB = 0.18                 # chance an area/sector has a bad stretch in the window
AREA_SHOCK_SIZE = (0.15, 0.40)         # wage reduction range during the shock

DRIVERS = ["income_drop", "uc_timing", "surprise_cost", "christmas", "structural"]
DRIVER_LABELS = {
    "income_drop": "Pay dropped or hours cut",
    "uc_timing": "Universal Credit lower or late",
    "surprise_cost": "Surprise costs (repairs, school, etc.)",
    "christmas": "Christmas spending",
    "structural": "Costs higher than income",
}

ASSUMPTIONS = [
    ("Household size", "2.4 people per household (to convert population to households)"),
    ("Household mix", "Interpolated by deprivation between the two mixes in config.py; stands in for census tables"),
    ("Customer base", f"{N_CUSTOMERS:,} synthetic customers; less likely in deprived areas and for gig/UC households"),
    ("UC rates", "2025/26 published rates, illustrative; housing element capped at £750/month"),
    ("Area shocks", f"{int(AREA_SHOCK_PROB*100)}% chance per area and sector of a 15-40% pay drop during the window"),
    ("Shortfall", "Balance + savings falls below the overdraft limit (cannot cover essentials)"),
]
