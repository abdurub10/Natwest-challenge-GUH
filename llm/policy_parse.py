"""Turn a policy announcement into a validated Scenario using Claude (forced tool call)."""
from __future__ import annotations

import os

from pydantic import BaseModel, Field

from engine.scenarios import Scenario

SAMPLES = {
    "Energy price cap rise (sample)": (
        "Ofgem has announced that the energy price cap will rise by 9% from 1 January, adding around "
        "£150 a year to the typical household's dual fuel bill. The regulator cited higher wholesale gas prices."),
    "Hospitality slowdown + UC uplift (sample)": (
        "Industry figures show hospitality employers cutting staff hours by around a quarter this winter. "
        "Separately, the government confirmed the Universal Credit standard allowance will increase by £15 a month."),
}

SCHEMA = {
        "type": "object",
        "properties": {
            "summary": {"type": "string", "description": "One plain-English sentence describing the scenario."},
            "energy_pct": {"type": "number", "description": "Change in household energy bills as a fraction, e.g. 0.09 for +9%. 0 if not mentioned."},
            "private_rent_pct": {"type": "number", "description": "Change in private rents as a fraction. 0 if not mentioned."},
            "uc_standard_delta": {"type": "number", "description": "Change in the Universal Credit standard allowance in £ per month. 0 if not mentioned."},
            "hospitality_hours_cut": {"type": "number", "description": "Fractional cut in hours for hospitality workers, e.g. 0.25. 0 if not mentioned."},
            "retail_hours_cut": {"type": "number", "description": "Fractional cut in hours for retail workers. 0 if not mentioned."},
            "logistics_hours_cut": {"type": "number", "description": "Fractional cut in hours for logistics/delivery workers. 0 if not mentioned."},
            "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
        },
        "required": ["summary", "energy_pct", "private_rent_pct", "uc_standard_delta",
                     "hospitality_hours_cut", "retail_hours_cut", "logistics_hours_cut", "confidence"],
        "additionalProperties": False,
}


class Parsed(BaseModel):
    summary: str
    energy_pct: float = Field(ge=-0.5, le=0.5)
    private_rent_pct: float = Field(ge=-0.3, le=0.3)
    uc_standard_delta: float = Field(ge=-200, le=200)
    hospitality_hours_cut: float = Field(ge=0, le=0.8)
    retail_hours_cut: float = Field(ge=0, le=0.8)
    logistics_hours_cut: float = Field(ge=0, le=0.8)
    confidence: str

    def scenario(self) -> Scenario:
        cuts = tuple((s, v) for s, v in (("hospitality", self.hospitality_hours_cut), ("retail", self.retail_hours_cut),
                                          ("logistics", self.logistics_hours_cut)) if v)
        return Scenario(name=f"Announcement: {self.summary[:60]}", energy_pct=round(self.energy_pct, 3),
                        private_rent_pct=round(self.private_rent_pct, 3),
                        uc_standard_delta=round(self.uc_standard_delta, 1), hours_cut=cuts)


def parse(text: str) -> Parsed:
    import json

    import anthropic
    client = anthropic.Anthropic(timeout=30.0)
    resp = client.messages.create(
        model=os.environ.get("CLAUDE_MODEL", "claude-sonnet-5-5"), max_tokens=4000,
        system="You convert UK policy or economic announcements into numeric household-finance scenarios. "
               "Only use values stated or directly implied by the text; use 0 for anything not mentioned.",
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": SCHEMA}},
        messages=[{"role": "user", "content": text}])
    if resp.stop_reason == "refusal":
        raise ValueError("refused")
    return Parsed(**json.loads(next(b.text for b in resp.content if b.type == "text")))
