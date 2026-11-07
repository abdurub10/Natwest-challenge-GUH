"""Read a briefing aloud with ElevenLabs text-to-speech."""
from __future__ import annotations

import os

VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb")  # calm British voice
MODEL_ID = os.environ.get("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")


def available() -> bool:
    return bool(os.environ.get("ELEVENLABS_API_KEY"))


def speech_text(b) -> str:
    """Turn a Briefing into something natural to listen to."""
    parts = [b.headline, *b.whats_happening, b.who_is_affected,
             "Suggested actions: " + "; ".join(b.suggested_actions) + ".", b.confidence_note]
    return " ".join(p.strip() for p in parts if p).replace("%", " percent").replace(" · ", ", ")


def synthesize(text: str) -> bytes:
    from elevenlabs.client import ElevenLabs
    client = ElevenLabs(api_key=os.environ["ELEVENLABS_API_KEY"])
    audio = client.text_to_speech.convert(voice_id=VOICE_ID, text=text, model_id=MODEL_ID,
                                          output_format="mp3_44100_128")
    return b"".join(audio)
