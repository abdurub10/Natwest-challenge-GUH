"""Undertow: forecasting financial hardship before it happens, neighbourhood by neighbourhood."""
from __future__ import annotations

import copy
import json

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import pydeck as pdk
import streamlit as st
from dotenv import load_dotenv

load_dotenv()

from engine import backtest  # noqa: E402
from engine import config as C  # noqa: E402
from engine.aggregate import LEDGER, area_forecast, city_summary  # noqa: E402
from engine.allocate import GRANT, allocate  # noqa: E402
from engine.model import World  # noqa: E402
from engine.scenarios import PRESETS, Scenario  # noqa: E402
from llm import briefing as BR  # noqa: E402

st.set_page_config(page_title="Undertow", page_icon="🌊", layout="wide")

INK, MUTED, ACCENT = "#1B1F2A", "#5B6270", "#5A2D82"
RAMP = ["#FFF5D6", "#FDD9A0", "#FBB36F", "#F2854F", "#DD5A3E", "#B7342F", "#821F2A"]
CHANGE_RAMP = ["#F3EEFA", "#D9C7EE", "#B79BDF", "#9168C9", "#6B3FAF", "#47238A"]
FOOTER = ("Household finances are synthetic. Geography (ONS), deprivation (IoD 2019) and Universal Credit rules are real. "
          "Forecasts are for directing support only, never for credit, pricing or enforcement.")

st.markdown("""
<style>
.block-container {padding-top: 1.6rem; padding-bottom: 1rem;}
h1, h2, h3 {letter-spacing: -0.01em;}
.ut-kicker {color:#5B6270; font-size:0.85rem; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:-0.4rem;}
.ut-big {font-size:2.3rem; font-weight:700; line-height:1.1; font-variant-numeric: tabular-nums;}
.ut-range {color:#5B6270; font-size:0.95rem;}
.ut-card {border:1px solid #E6E1D8; border-radius:12px; padding:0.9rem 1rem; background:#FFFFFF;}
.ut-brief h4 {margin:0 0 0.4rem 0;}
.ut-foot {color:#5B6270; font-size:0.8rem; border-top:1px solid #E6E1D8; padding-top:0.5rem; margin-top:1rem;}
.ut-pill {display:inline-block; padding:0.1rem 0.55rem; border-radius:999px; background:#F3EEFA; color:#47238A; font-size:0.8rem;}
</style>
""", unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# Data and model (cached)
# ---------------------------------------------------------------------------
@st.cache_resource(show_spinner="Simulating 36,000 households × 200 futures…")
def world() -> World:
    w = World()
    w.run(Scenario())
    w.truth(), w.previous_truth()
    for kk in range(len(C.HORIZONS)):
        w.grant_delta(kk)
    return w


@st.cache_resource
def geojson() -> dict:
    with open(C.DATA / "areas.geojson") as f:
        return json.load(f)


W = world()
FC_CACHE: dict = st.session_state.setdefault("fc_cache", {})


def forecast(s: Scenario, k: int) -> pd.DataFrame:
    key = (s.key(), k)
    if key not in FC_CACHE:
        FC_CACHE[key] = area_forecast(W.areas, W.hh, W.mix, W.run(s), k, s.name)
    return FC_CACHE[key]


def color(v: float, lo: float, hi: float, ramp=RAMP) -> list[int]:
    if v is None or np.isnan(v):
        return [200, 200, 200, 140]
    t = float(np.clip((v - lo) / max(hi - lo, 1e-9), 0, 1)) * (len(ramp) - 1)
    i = min(int(t), len(ramp) - 2)
    f = t - i
    a = [int(ramp[i][j:j + 2], 16) for j in (1, 3, 5)]
    b = [int(ramp[i + 1][j:j + 2], 16) for j in (1, 3, 5)]
    return [int(a[c] + (b[c] - a[c]) * f) for c in range(3)] + [215]


def fmt_n(x: float) -> str:
    return f"{int(round(x / 10.0) * 10):,}"


# ---------------------------------------------------------------------------
# Sidebar: horizon, metric, scenario
# ---------------------------------------------------------------------------
with st.sidebar:
    st.markdown("### 🌊 Undertow")
    st.caption("Financial hardship forecast · Greater Manchester")
    weeks = st.select_slider("Look ahead", options=[2, 4, 6, 8], value=6, format_func=lambda w: f"+{w} weeks")
    k = C.HORIZONS.index(weeks * 7)
    st.divider()
    st.markdown("**Policy & economic shocks**")
    preset = st.selectbox("Preset", list(PRESETS), index=0)
    p = PRESETS[preset]
    with st.form("scenario"):
        energy = st.slider("Energy bills", -20, 30, int(p.energy_pct * 100), format="%+d%%")
        rent = st.slider("Private rents", -10, 20, int(p.private_rent_pct * 100), format="%+d%%")
        uc = st.slider("UC standard allowance (£/month)", -50, 50, int(p.uc_standard_delta), format="%+d")
        cuts = dict(p.hours_cut)
        hosp = st.slider("Hospitality hours cut", 0, 50, int(cuts.get("hospitality", 0) * 100), format="%d%%")
        retail = st.slider("Retail hours cut", 0, 50, int(cuts.get("retail", 0) * 100), format="%d%%")
        st.form_submit_button("Run scenario", type="primary", use_container_width=True)
    if "parsed_scenario" in st.session_state and st.session_state.get("use_parsed"):
        scen = st.session_state["parsed_scenario"]
        st.info(f"Using announcement scenario: {scen.name}")
        if st.button("Clear announcement scenario"):
            st.session_state["use_parsed"] = False
            st.rerun()
    else:
        hc = tuple((s, v / 100) for s, v in (("hospitality", hosp), ("retail", retail)) if v)
        custom = Scenario(name="Custom", energy_pct=energy / 100, private_rent_pct=rent / 100,
                          uc_standard_delta=float(uc), hours_cut=hc)
        scen = PRESETS[preset] if custom == Scenario(name="Custom", **{f: getattr(PRESETS[preset], f) for f in
                                                                       ("energy_pct", "private_rent_pct", "uc_standard_delta", "hours_cut")}) \
            else custom
        if scen.is_baseline:
            scen = Scenario()
    st.divider()
    audience = st.radio("Briefing for", ["council", "foodbank"], horizontal=True,
                        format_func=lambda a: "Council" if a == "council" else "Food bank")

base = forecast(Scenario(), k)
with st.spinner(f"Re-forecasting every household under “{scen.name}”…"):
    fc = forecast(scen, k)
summary, base_summary = city_summary(fc), city_summary(base)
is_scen = not scen.is_baseline

# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------
st.markdown(f"<div class='ut-kicker'>Forecast from {C.DEMO_TODAY:%a %d %b %Y} · +{weeks} weeks · {scen.name}</div>",
            unsafe_allow_html=True)
st.markdown("## Where will households run out of money next?")
m1, m2, m3, m4 = st.columns(4)
m1.metric("Households forecast short", fmt_n(summary["households_at_risk"]),
          delta=(fmt_n(summary["households_at_risk"] - base_summary["households_at_risk"]) + " vs baseline") if is_scen else None,
          delta_color="inverse")
m1.caption(f"Likely range {fmt_n(summary['households_at_risk_p10'])}–{fmt_n(summary['households_at_risk_p90'])}")
m2.metric("Share of households", f"{summary['rate'] * 100:.1f}%")
m2.caption(f"Without census reweighting: {summary['rate_naive'] * 100:.1f}%")
m3.metric("Neighbourhoods", f"{len(fc) - summary['suppressed']} of {len(fc)}")
m3.caption(f"{summary['suppressed']} hidden: too few customers to share safely")
m4.metric("Privacy", f"ε = {C.EPSILON:g} per area")
m4.caption("Laplace noise · only area totals leave the bank")

tab_map, tab_alloc, tab_policy, tab_trust = st.tabs(["🗺️ Map", "💷 Crisis fund allocator", "📰 Policy announcement", "🔍 Trust & method"])

# ---------------------------------------------------------------------------
# Map tab
# ---------------------------------------------------------------------------
with tab_map:
    metric_opts = ["Share of households", "Households"] + (["Change vs baseline"] if is_scen else [])
    metric = st.radio("Colour by", metric_opts, horizontal=True, label_visibility="collapsed")
    fc_i = fc.set_index("area_id")
    if metric == "Share of households":
        vals = fc_i["rate"]
        lo, hi, ramp = 0.10, 0.40, RAMP
    elif metric == "Households":
        vals = fc_i["count"]
        lo, hi, ramp = float(np.nanpercentile(vals, 5)), float(np.nanpercentile(vals, 95)), RAMP
    else:
        vals = fc_i["count"] - base.set_index("area_id")["count"]
        lo, hi, ramp = 0.0, float(max(np.nanpercentile(vals, 97), 1)), CHANGE_RAMP

    gj = copy.deepcopy(geojson())
    for feat in gj["features"]:
        a = int(feat["properties"]["area_id"])
        r = fc_i.loc[a]
        feat["properties"]["fill"] = color(vals.loc[a], lo, hi, ramp)
        if r["suppressed"]:
            feat["properties"]["tip"] = f"{r['msoa_name']} ({r['lad']})<br/>Not enough customers to share safely"
        else:
            feat["properties"]["tip"] = (f"<b>{r['msoa_name']}</b> ({r['lad']})<br/>"
                                         f"{r['rate'] * 100:.0f}% of households · ≈{fmt_n(r['count'])} "
                                         f"({fmt_n(r['count_p10'])}–{fmt_n(r['count_p90'])})")

    left, right = st.columns([3, 2], gap="large")
    with left:
        layer = pdk.Layer("GeoJsonLayer", gj, id="areas", pickable=True, stroked=True, filled=True,
                          get_fill_color="properties.fill", get_line_color=[255, 255, 255, 160],
                          line_width_min_pixels=0.5, auto_highlight=True, highlight_color=[90, 45, 130, 120])
        deck = pdk.Deck(layers=[layer], map_provider="carto", map_style=pdk.map_styles.CARTO_LIGHT,
                        initial_view_state=pdk.ViewState(latitude=53.50, longitude=-2.30, zoom=9.3),
                        tooltip={"html": "{tip}", "style": {"backgroundColor": "#1B1F2A", "color": "white",
                                                             "fontSize": "12px"}})
        event = st.pydeck_chart(deck, on_select="rerun", selection_mode="single-object", key="map", height=560)
        sel = None
        try:
            objs = event.selection.objects.get("areas", [])
            if objs:
                o = objs[0]
                sel = int((o.get("properties") or o).get("area_id"))
        except Exception:
            sel = None
        legend = {"Share of households": "Light = lower share · dark = higher share (10% → 40%+). Grey = hidden for privacy.",
                  "Households": "Number of households forecast short. Grey = hidden for privacy.",
                  "Change vs baseline": "Extra households pushed into shortfall by this scenario."}[metric]
        st.caption(legend)

    ranked = fc[~fc["suppressed"]].sort_values("count" if metric != "Change vs baseline" else "rate", ascending=False)
    if metric == "Change vs baseline":
        ranked = ranked.assign(chg=vals.loc[ranked["area_id"]].to_numpy()).sort_values("chg", ascending=False)
    names = ranked["msoa_name"].tolist()
    if sel is not None and not fc_i.loc[sel, "suppressed"]:
        st.session_state["area_name"] = fc_i.loc[sel, "msoa_name"]
    default = st.session_state.get("area_name", names[0])
    with right:
        area_name = st.selectbox("Neighbourhood (click the map or pick)", names,
                                 index=names.index(default) if default in names else 0, key="area_pick")
        st.session_state["area_name"] = area_name
        row = fc[fc["msoa_name"] == area_name].iloc[0]
        a_id = int(row["area_id"])
        st.markdown(f"<div class='ut-kicker'>{row['lad']} · deprivation decile {int(row['gm_decile'])} of 10 in Greater Manchester</div>",
                    unsafe_allow_html=True)
        st.markdown(f"<div class='ut-big'>≈ {fmt_n(row['count'])} households</div>"
                    f"<div class='ut-range'>forecast unable to cover essentials within {weeks} weeks · "
                    f"likely {fmt_n(row['count_p10'])}–{fmt_n(row['count_p90'])} · {row['rate'] * 100:.0f}% of "
                    f"{fmt_n(row['households'])}</div>", unsafe_allow_html=True)
        if is_scen:
            b_row = base.set_index("area_id").loc[a_id]
            st.markdown(f"<span class='ut-pill'>{scen.name}: {int(round(row['count'] - b_row['count'])):+,} households vs baseline</span>",
                        unsafe_allow_html=True)

        # Time travel sparkline
        traj = [forecast(scen, kk).set_index("area_id").loc[a_id] for kk in range(len(C.HORIZONS))]
        xs = [f"+{h // 7}w" for h in C.HORIZONS]
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=xs + xs[::-1], y=[t["count_p90"] for t in traj] + [t["count_p10"] for t in traj][::-1],
                                 fill="toself", fillcolor="rgba(183,52,47,0.15)", line=dict(width=0), hoverinfo="skip",
                                 showlegend=False))
        fig.add_trace(go.Scatter(x=xs, y=[t["count"] for t in traj], mode="lines+markers", line=dict(color="#B7342F", width=3),
                                 showlegend=False, hovertemplate="%{x}: ≈%{y:,.0f}<extra></extra>"))
        fig.update_layout(height=150, margin=dict(l=0, r=0, t=22, b=0), title=dict(text="Households short, by weeks ahead", font=dict(size=13)),
                          yaxis=dict(rangemode="tozero", gridcolor="#EEE"), plot_bgcolor="white")
        st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

        c1, c2 = st.columns(2)
        drv = sorted(((C.DRIVER_LABELS[d], row[f"drv_{d}"]) for d in C.DRIVERS), key=lambda x: x[1])
        fig_d = go.Figure(go.Bar(x=[v * 100 for _, v in drv], y=[l for l, _ in drv], orientation="h", marker_color=ACCENT,
                                 hovertemplate="%{y}: decisive in %{x:.0f}% of shortfalls<extra></extra>"))
        fig_d.update_layout(height=210, margin=dict(l=0, r=0, t=26, b=0), title=dict(text="Why: decisive drivers (% of shortfalls)", font=dict(size=13)),
                            xaxis=dict(range=[0, 100], gridcolor="#EEE"), plot_bgcolor="white")
        c1.plotly_chart(fig_d, use_container_width=True, config={"displayModeBar": False})
        who = sorted(((C.TYPE_LABELS[t], row[f"who_{t}"]) for t in C.TYPES), key=lambda x: x[1])
        fig_w = go.Figure(go.Bar(x=[v * 100 for _, v in who], y=[l for l, _ in who], orientation="h", marker_color="#DD5A3E",
                                 hovertemplate="%{y}: %{x:.0f}% of those short<extra></extra>"))
        fig_w.update_layout(height=210, margin=dict(l=0, r=0, t=26, b=0), title=dict(text="Who: share of households short", font=dict(size=13)),
                            xaxis=dict(range=[0, 100], gridcolor="#EEE"), plot_bgcolor="white")
        c2.plotly_chart(fig_w, use_container_width=True, config={"displayModeBar": False})

        # Briefing
        bkey = (scen.key(), k, a_id, audience)
        briefs = st.session_state.setdefault("briefs", {})
        if st.button("✍️ Write briefing", type="primary", use_container_width=True) or bkey in briefs:
            if bkey not in briefs:
                with st.spinner("Claude is writing the briefing from area totals…"):
                    facts = BR.build_facts(row.to_dict(), weeks, scen.name, audience,
                                           base.set_index("area_id").loc[a_id, "count"] if is_scen else None)
                    b = BR.write(facts)
                    briefs[bkey] = b
                    stats = st.session_state.setdefault("numcheck", {"checked": 0, "rejected": 0})
                    stats["checked"] += 1
                    stats["rejected"] += len(b.rejected)
            b = briefs[bkey]
            items = "".join(f"<li>{x}</li>" for x in b.whats_happening)
            acts = "".join(f"<li>{x}</li>" for x in b.suggested_actions)
            st.markdown(f"""<div class='ut-card ut-brief'><h4>{b.headline}</h4><ul>{items}</ul>
<p><b>Who:</b> {b.who_is_affected}</p><p><b>Suggested actions</b></p><ul>{acts}</ul>
<p style='color:#5B6270'>{b.confidence_note}</p></div>""", unsafe_allow_html=True)
            src = "Written by Claude from area totals only" if b.source == "claude" else f"Fallback template ({b.source})"
            st.caption(f"{src} · every number checked against the data"
                       + (f" · {len(b.rejected)} invented number(s) caught and rewritten" if b.rejected else " · 0 rejected"))

# ---------------------------------------------------------------------------
# Allocator tab
# ---------------------------------------------------------------------------
with tab_alloc:
    st.markdown("### A council has a fixed crisis budget. Where does each pound keep the most households afloat?")
    st.caption(f"Grants of £{GRANT:.0f} paid in week 1. The engine re-runs every household with the grant, using the same random futures, "
               "so the difference is the grant's effect. Every strategy uses the same within-area targeting; they only differ in which areas they fund.")
    budget = st.number_input("Budget (£)", min_value=50_000, max_value=5_000_000, value=500_000, step=50_000)
    with st.spinner("Simulating every household with a grant…"):
        delta = W.grant_delta(k)
    res = allocate(W.hh, W.areas, base, W.run(Scenario()).p_short[:, k], delta, float(budget))
    s = res["saved"]
    a1, a2, a3 = st.columns(3)
    a1.metric("Undertow targeting", f"≈ {fmt_n(s['Undertow'])} households", help="Kept out of shortfall")
    a2.metric("Most-deprived-first", f"≈ {fmt_n(s['Deprivation rank'])}",
              delta=f"Undertow protects {s['Undertow'] / max(s['Deprivation rank'], 1):.1f}× as many")
    a3.metric("Even split by population", f"≈ {fmt_n(s['Even split'])}")
    if is_scen:
        st.caption("Allocator uses the baseline forecast.")
    cA, cB = st.columns([2, 3])
    with cA:
        figA = go.Figure(go.Bar(x=list(s.keys()), y=list(s.values()), marker_color=[ACCENT, "#B9B2C6", "#D8D3E0"],
                                text=[fmt_n(v) for v in s.values()], textposition="outside"))
        figA.update_layout(height=320, margin=dict(l=0, r=0, t=30, b=0), title="Households kept out of shortfall",
                           yaxis=dict(gridcolor="#EEE"), plot_bgcolor="white")
        st.plotly_chart(figA, use_container_width=True, config={"displayModeBar": False})
    with cB:
        plan = res["plan"].head(15).copy()
        plan["Amount"] = plan["amount"].map(lambda v: f"£{v:,.0f}")
        plan["Households protected"] = plan["protected"].map(lambda v: f"≈{v:,.0f}")
        plan["Deprivation decile"] = plan["gm_decile"].astype(int)
        st.markdown(f"**Recommended allocation** · {res['areas_funded']} neighbourhoods funded")
        st.dataframe(plan[["msoa_name", "lad", "Deprivation decile", "Amount", "Households protected"]]
                     .rename(columns={"msoa_name": "Neighbourhood", "lad": "Borough"}), hide_index=True, use_container_width=True, height=290)
    st.caption("Why it beats deprivation targeting: the most deprived areas include many households a one-off grant cannot rescue "
               "(costs exceed income) as well as many who are fine. Undertow funds the areas where a grant actually changes the outcome. "
               "Structural cases are flagged for debt advice instead.")

# ---------------------------------------------------------------------------
# Policy announcement tab
# ---------------------------------------------------------------------------
with tab_policy:
    from llm import policy_parse as PP
    st.markdown("### Paste an announcement → Claude turns it into a scenario → Undertow re-forecasts the city")
    sample = st.selectbox("Try a sample", ["(paste your own)"] + list(PP.SAMPLES))
    text = st.text_area("Announcement text", value=PP.SAMPLES.get(sample, ""), height=120)
    if st.button("Extract scenario", type="primary", disabled=not text.strip()):
        import os
        if not os.environ.get("ANTHROPIC_API_KEY"):
            st.error("Set ANTHROPIC_API_KEY in .env to use this feature.")
        else:
            try:
                with st.spinner("Claude is reading the announcement…"):
                    parsed = PP.parse(text)
                st.session_state["parsed"] = parsed
            except Exception as e:
                st.error(f"Couldn't turn this into a scenario ({type(e).__name__}). Set it manually in the sidebar.")
    if "parsed" in st.session_state:
        parsed = st.session_state["parsed"]
        st.success(parsed.summary)
        st.json({k: v for k, v in parsed.model_dump().items() if k != "summary"})
        if st.button("Run this scenario on the map"):
            st.session_state["parsed_scenario"] = parsed.scenario()
            st.session_state["use_parsed"] = True
            st.rerun()

# ---------------------------------------------------------------------------
# Trust tab
# ---------------------------------------------------------------------------
with tab_trust:
    st.markdown("### Can you trust it?")
    with st.spinner("Running the backtest…"):
        truth, prev = W.truth(), W.previous_truth()
        bt = backtest.run(W.hh, W.run(Scenario()).p_short, truth.p_short, prev.p_short, W.areas, W.mix, base, k)
    b1, b2, b3, b4 = st.columns(4)
    b1.metric("Household AUC", f"{bt['household_auc']:.2f}", help="How well risk ranks households that actually fell short")
    b2.metric("Brier score", f"{bt['household_brier']:.3f}", help="Lower is better")
    b3.metric("80% band coverage", f"{bt['coverage_80'] * 100:.0f}%", help="Share of areas whose actual rate fell inside the P10–P90 band")
    tbl = bt["table"]
    b4.metric("Top-20 areas found", f"{tbl.loc['Undertow', 'Top-20 precision'] * 20:.0f} / 20",
              delta=f"{(tbl.loc['Undertow', 'Top-20 precision'] - tbl.loc['Deprivation rank', 'Top-20 precision']) * 20:+.0f} vs deprivation")
    t1, t2 = st.columns(2)
    with t1:
        st.markdown("**Area forecasts vs what actually happened (held-out future)**")
        show = tbl.copy()
        show["MAE (pp)"] = show["MAE (pp)"].map(lambda v: f"{v:.1f}")
        show["Spearman"] = show["Spearman"].map(lambda v: f"{v:.2f}")
        show["Top-20 precision"] = show["Top-20 precision"].map(lambda v: f"{v * 100:.0f}%")
        st.dataframe(show, use_container_width=True)
        pts = bt["area_points"]
        figS = go.Figure()
        figS.add_trace(go.Scatter(x=pts["forecast"] * 100, y=pts["actual"] * 100, mode="markers",
                                  marker=dict(size=6, color=ACCENT, opacity=0.6), text=pts["name"],
                                  error_x=dict(type="data", symmetric=False, array=(pts["hi"] - pts["forecast"]) * 100,
                                               arrayminus=(pts["forecast"] - pts["lo"]) * 100, thickness=0.6, color="#C9B8E0"),
                                  hovertemplate="%{text}<br>forecast %{x:.1f}% · actual %{y:.1f}%<extra></extra>"))
        mx = float(max(pts["forecast"].max(), pts["actual"].max()) * 100 + 3)
        figS.add_trace(go.Scatter(x=[0, mx], y=[0, mx], mode="lines", line=dict(dash="dash", color="#999"), showlegend=False))
        figS.update_layout(height=330, margin=dict(l=0, r=0, t=10, b=0), showlegend=False, plot_bgcolor="white",
                           xaxis=dict(title="Forecast share short (%)", gridcolor="#EEE"),
                           yaxis=dict(title="Actual share short (%)", gridcolor="#EEE"))
        st.plotly_chart(figS, use_container_width=True, config={"displayModeBar": False})
    with t2:
        st.markdown("**Calibration: when Undertow says 30%, it happens about 30% of the time**")
        cal = bt["calibration"]
        figC = go.Figure()
        figC.add_trace(go.Scatter(x=[0, 1], y=[0, 1], mode="lines", line=dict(dash="dash", color="#999")))
        figC.add_trace(go.Scatter(x=cal["forecast"], y=cal["observed"], mode="lines+markers", marker=dict(size=8, color="#B7342F"),
                                  line=dict(color="#B7342F")))
        figC.update_layout(height=330, margin=dict(l=0, r=0, t=10, b=0), showlegend=False, plot_bgcolor="white",
                           xaxis=dict(title="Forecast probability", gridcolor="#EEE"), yaxis=dict(title="Observed frequency", gridcolor="#EEE"))
        st.plotly_chart(figC, use_container_width=True, config={"displayModeBar": False})
    st.info("Honest limit: the held-out future is simulated with the same model family, so this proves the pipeline and its uncertainty are "
            "correct — not real-world accuracy. Next step: a hindcast of the 2022 energy crisis using only 2021 data, scored against ONS claimant "
            "counts, DWP Universal Credit and Citizens Advice data by local authority.")

    st.markdown("---")
    p1, p2 = st.columns(2)
    with p1:
        st.markdown("**🔒 Privacy**")
        st.markdown(f"- Household forecasts never leave the bank; only area totals do.\n"
                    f"- Each released area rate has Laplace noise scaled to the most one household could change it (ε = {C.EPSILON:g}).\n"
                    f"- Areas with fewer than {C.MIN_CUSTOMERS} customers are hidden ({summary['suppressed']} today).\n"
                    f"- Drivers are released only to the nearest 5%.\n"
                    f"- Claude only ever sees area totals.")
        led = LEDGER.frame()
        if len(led):
            st.dataframe(led.rename(columns={"release": "Release", "statistics": "Area statistics",
                                             "epsilon_per_statistic": "ε each"}), hide_index=True, use_container_width=True)
        nc = st.session_state.get("numcheck", {"checked": 0, "rejected": 0})
        st.markdown(f"**AI number check:** {nc['checked']} briefings checked · {nc['rejected']} invented numbers caught")
    with p2:
        st.markdown("**⚖️ NatWest's customers aren't the whole population: census reweighting**")
        cmp = base[~base["suppressed"]].groupby("gm_decile").apply(
            lambda g: pd.Series({"Customers only": (g["rate_naive"] * g["households"]).sum() / g["households"].sum() * 100,
                                 "Reweighted to all households": (g["rate"] * g["households"]).sum() / g["households"].sum() * 100}),
            include_groups=False)
        figR = go.Figure()
        for name, col in (("Customers only", "#B9B2C6"), ("Reweighted to all households", ACCENT)):
            figR.add_trace(go.Bar(x=cmp.index.astype(int), y=cmp[name], name=name, marker_color=col))
        figR.update_layout(height=280, margin=dict(l=0, r=0, t=10, b=0), barmode="group", plot_bgcolor="white",
                           legend=dict(orientation="h", y=1.12), xaxis=dict(title="Deprivation decile (1 = most deprived)", dtick=1),
                           yaxis=dict(title="% households short", gridcolor="#EEE"))
        st.plotly_chart(figR, use_container_width=True, config={"displayModeBar": False})

    st.markdown("---")
    r1, r2 = st.columns(2)
    with r1:
        st.markdown("**What's real vs synthetic**")
        st.dataframe(pd.DataFrame({
            "Real": ["Greater Manchester neighbourhood boundaries (ONS MSOA 2011)",
                     "Deprivation scores and population (English Indices of Deprivation 2019)",
                     "Universal Credit rules: taper, work allowance, assessment periods, payment dates",
                     "Bank holidays and working-day payment shifts"],
            "Synthetic": ["Household finances and day-by-day cash flow", "Household-type mix per area (from deprivation)",
                          "Which households bank with NatWest", "The held-out 'actual' future used for the backtest"]}),
            hide_index=True, use_container_width=True)
    with r2:
        st.markdown("**Method**")
        st.markdown(f"- {C.N_CUSTOMERS:,} synthetic customer households × {C.N_PATHS} Monte Carlo futures × {C.HORIZON_DAYS} days.\n"
                    "- Pay regimes (normal / reduced / zero) as a weekly Markov chain; shocks shared by everyone in an area and sector.\n"
                    "- Universal Credit recalculated from each future's own wages per assessment period (the five-payday effect).\n"
                    "- Bills on real due dates, moved to the next working day; Christmas; surprise costs.\n"
                    "- Shortfall = balance + savings below the overdraft limit. Drivers are 'decisive' if removing that shock alone avoids it.")
        st.dataframe(pd.DataFrame(C.ASSUMPTIONS, columns=["Assumption", "Value"]), hide_index=True, use_container_width=True)

st.markdown(f"<div class='ut-foot'>{FOOTER}</div>", unsafe_allow_html=True)
