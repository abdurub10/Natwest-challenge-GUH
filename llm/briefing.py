"""Area briefings written by Claude from area totals only, with every number checked."""
from __future__ import annotations

import json
import os

from pydantic import BaseModel, Field

from engine import config as C

from .numbercheck import check

ALLOWED_ACTIONS = [
    "Pre-allocate crisis support funds to this area",
    "Ask food banks to increase stock and opening hours",
    "Proactive bank contact for at-risk customers (payment holidays, benefits checks)",
    "Run a benefits take-up campaign (Universal Credit, Council Tax Support, social tariffs)",
    "Energy advice and grants outreach",
    "Refer households to free debt advice (Citizens Advice, StepChange)",
]

SYSTEM = """You write short, factual briefings for council officers and food bank managers about forecast financial hardship in one Greater Manchester neighbourhood.
Rules:
- Use ONLY the numbers in the facts, written exactly as they appear there. Never calculate, round differently, or add a number that is not there.
- When you give a household count, also give its range from the facts.
- Plain English, no jargon. Under 120 words in total across all fields.
- Describe groups, never individuals. Never suggest using the forecast for credit, pricing, enforcement or eligibility decisions.
- Choose suggested actions only from allowed_actions, copied exactly.
- The forecast comes from simulated futures of bank customers' cash flow, reweighted to the whole area and protected with differential privacy."""

TOOL = {
    "name": "write_briefing",
    "description": "Write the area briefing.",
    "input_schema": {
        "type": "object",
        "properties": {
            "headline": {"type": "string", "description": "At most 20 words: what is forecast and when."},
            "whats_happening": {"type": "array", "items": {"type": "string"}, "description": "2-3 bullets on the main drivers."},
            "who_is_affected": {"type": "string", "description": "One sentence on the household groups most affected."},
            "suggested_actions": {"type": "array", "items": {"type": "string"}, "description": "2-3 items copied from allowed_actions."},
            "confidence_note": {"type": "string", "description": "One sentence on uncertainty."},
        },
        "required": ["headline", "whats_happening", "who_is_affected", "suggested_actions", "confidence_note"],
    },
}


class Briefing(BaseModel):
    headline: str
    whats_happening: list[str] = Field(min_length=1, max_length=4)
    who_is_affected: str
    suggested_actions: list[str] = Field(min_length=1, max_length=4)
    confidence_note: str
    source: str = "claude"
    rejected: list[str] = []


def _r10(x: float) -> int:
    return int(round(x / 10.0) * 10)


def build_facts(row: dict, weeks: int, scenario: str, audience: str, baseline_count: float | None = None) -> dict:
    drivers = sorted(((C.DRIVER_LABELS[d], row[f"drv_{d}"]) for d in C.DRIVERS), key=lambda x: -x[1])
    who = sorted(((C.TYPE_LABELS[t], row[f"who_{t}"]) for t in C.TYPES), key=lambda x: -x[1])
    facts = {
        "area": row["msoa_name"], "borough": row["lad"], "audience": audience,
        "weeks_ahead": weeks, "scenario": scenario,
        "households_in_area": f"{_r10(row['households']):,}",
        "households_forecast_short": f"{_r10(row['count']):,}",
        "range_low": f"{_r10(row['count_p10']):,}", "range_high": f"{_r10(row['count_p90']):,}",
        "share_of_households": f"{round(row['rate'] * 100)}%",
        "deprivation_decile_in_greater_manchester": int(row["gm_decile"]),
        "drivers_share_of_shortfalls_where_decisive": {k: f"{round(v * 100)}%" for k, v in drivers[:4]},
        "most_affected_groups_share": {k: f"{round(v * 100)}%" for k, v in who[:3]},
        "allowed_actions": ALLOWED_ACTIONS,
    }
    if baseline_count is not None:
        facts["change_vs_baseline_households"] = f"{_r10(row['count'] - baseline_count):+,}"
    allowed = [str(weeks), str(int(row["gm_decile"])), "10"]
    for v in facts.values():
        if isinstance(v, str):
            allowed.append(v.lstrip("+"))
        elif isinstance(v, dict):
            allowed.extend(v.values())
    facts["_allowed"] = allowed
    return facts


def template(f: dict) -> Briefing:
    drv = list(f["drivers_share_of_shortfalls_where_decisive"].items())
    who = list(f["most_affected_groups_share"].items())
    return Briefing(
        headline=f"About {f['households_forecast_short']} households in {f['area']} may be unable to cover essentials within {f['weeks_ahead']} weeks.",
        whats_happening=[f"{k}: decisive in {v} of forecast shortfalls." for k, v in drv[:2] if k != C.DRIVER_LABELS["structural"]]
                        or [f"{drv[0][0]}: {drv[0][1]} of forecast shortfalls."],
        who_is_affected=f"Most affected: {who[0][0].lower()} ({who[0][1]}) and {who[1][0].lower()} ({who[1][1]}).",
        suggested_actions=ALLOWED_ACTIONS[:2],
        confidence_note=f"Likely range {f['range_low']} to {f['range_high']} households.",
        source="template",
    )


def _text(b: dict) -> str:
    return " ".join([b.get("headline", ""), *b.get("whats_happening", []), b.get("who_is_affected", ""),
                     b.get("confidence_note", "")])


def write(facts: dict) -> Briefing:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return template(facts)
    try:
        import anthropic
        client = anthropic.Anthropic(timeout=15.0)
        public = {k: v for k, v in facts.items() if not k.startswith("_")}
        messages = [{"role": "user", "content": "Here are the facts. Write the briefing.\n" + json.dumps(public, ensure_ascii=False)}]
        rejected: list[str] = []
        for _ in range(2):
            resp = client.messages.create(
                model=os.environ.get("CLAUDE_MODEL", "claude-sonnet-5-5"), max_tokens=600, temperature=0.3,
                system=SYSTEM, tools=[TOOL], tool_choice={"type": "tool", "name": "write_briefing"},
                messages=messages)
            block = next(b for b in resp.content if b.type == "tool_use")
            out = dict(block.input)
            out["suggested_actions"] = [a for a in out.get("suggested_actions", []) if a in ALLOWED_ACTIONS] or ALLOWED_ACTIONS[:2]
            bad = check(_text(out), facts["_allowed"])
            if not bad:
                return Briefing(**out, rejected=rejected)
            rejected += bad
            messages += [{"role": "assistant", "content": resp.content},
                         {"role": "user", "content": [{"type": "tool_result", "tool_use_id": block.id, "is_error": True,
                                                       "content": f"You used numbers not in the facts: {', '.join(bad)}. Rewrite using only the given numbers."}]}]
        t = template(facts)
        t.rejected = rejected
        return t
    except Exception as e:  # network, auth, timeout: never break the demo
        t = template(facts)
        t.source = f"template ({type(e).__name__})"
        return t
