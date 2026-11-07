"use client";
// Voice coach: the ElevenLabs "Headroom Coach" agent. Starts a session with a signed URL and the
// forecast summary from GET /api/voice/token, registers the agent's client tools (they run on our
// server through /api/voice/tool), and shows a live transcript so the room can follow along.
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { AudioLines, Mic, PhoneOff } from "lucide-react";
import {
  ConversationProvider,
  useConversationClientTool,
  useConversationControls,
  useConversationMode,
  useConversationStatus,
  type MessagePayload,
} from "@elevenlabs/react";
import { voiceSession, voiceTool } from "@/lib/client/api";
import { useAppState } from "./AppState";
import { buttonClass } from "./ui";

interface Line { id: number; role: "user" | "agent"; text: string }

const CONNECT_TIMEOUT_MS = 10_000;

export function VoiceCoach() {
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const nextId = useRef(1);

  const onMessage = useCallback((m: MessagePayload) => {
    const text = m.message?.trim();
    if (!text) return;
    setLines((ls) => [...ls, { id: nextId.current++, role: m.role, text }]);
  }, []);

  return (
    <ConversationProvider onMessage={onMessage} onError={(msg) => console.error("[voice]", msg)}>
      <VoicePanel lines={lines} clearLines={() => setLines([])} error={error} setError={setError} />
    </ConversationProvider>
  );
}

function VoicePanel({ lines, clearLines, error, setError }: { lines: Line[]; clearLines: () => void; error: string | null; setError: (e: string | null) => void }) {
  const { t, language, dir } = useAppState();
  const { startSession, endSession } = useConversationControls();
  const { status } = useConversationStatus();
  const { isSpeaking } = useConversationMode();
  const [preparing, setPreparing] = useState(false);
  const [busyTool, setBusyTool] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);

  // Every client tool goes to the same server route; the agent gets the result as a JSON string.
  const run = useCallback(
    async (name: string, params: Record<string, unknown>) => {
      setBusyTool(true);
      try {
        const res = await voiceTool(language, name, params ?? {});
        return JSON.stringify(res.result);
      } catch {
        return JSON.stringify({ error: "The forecast could not be reached. Say so honestly and offer to try again." });
      } finally {
        setBusyTool(false);
      }
    },
    [language],
  );
  useConversationClientTool("get_forecast", (p) => run("get_forecast", p));
  useConversationClientTool("simulate_scenario", (p) => run("simulate_scenario", p));
  useConversationClientTool("list_actions", (p) => run("list_actions", p));
  useConversationClientTool("accept_actions", (p) => run("accept_actions", p));
  useConversationClientTool("request_human_help", (p) => run("request_human_help", p));

  const connecting = preparing || status === "connecting";
  const connected = status === "connected";

  // Give up if the agent does not connect in time, so the demo never hangs.
  useEffect(() => {
    if (status !== "connecting") return;
    const timer = setTimeout(() => {
      endSession();
      setError(t("voice.unavailable"));
    }, CONNECT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [status, endSession, setError, t]);

  useEffect(() => {
    if (status === "error") setError(t("voice.unavailable"));
  }, [status, setError, t]);

  // End the call if the person leaves the screen.
  useEffect(() => () => endSession(), [endSession]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  async function start() {
    setError(null);
    clearLines();
    setPreparing(true);
    try {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch {
        setError(t("voice.micDenied"));
        return;
      }
      const session = await voiceSession(language);
      startSession({ signedUrl: session.signedUrl, dynamicVariables: session.dynamicVariables });
    } catch {
      setError(t("voice.unavailable"));
    } finally {
      setPreparing(false);
    }
  }

  const statusText = busyTool ? t("voice.checking") : isSpeaking ? t("voice.speaking") : t("voice.listening");

  return (
    <section aria-labelledby="voice-title" className="mx-5 mb-5 rounded-xl border border-line bg-card p-5" dir={dir}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-accentSoft text-accent">
            <AudioLines size={20} />
          </span>
          <div className="min-w-0">
            <h2 id="voice-title" className="text-[1.125rem] font-semibold text-ink">
              {t("voice.title")}
            </h2>
            <p className="mt-0.5 text-[0.9375rem] leading-snug text-muted">{t("voice.subtitle")}</p>
          </div>
        </div>

        {connected ? (
          <button type="button" onClick={() => endSession()} className={buttonClass.secondary}>
            <PhoneOff aria-hidden size={18} />
            {t("voice.stop")}
          </button>
        ) : (
          <button type="button" onClick={() => void start()} disabled={connecting} className={buttonClass.primary}>
            <Mic aria-hidden size={18} />
            {connecting ? t("voice.connecting") : t("voice.start")}
          </button>
        )}
      </div>

      {connected ? (
        <p role="status" className="mt-4 inline-flex items-center gap-2 text-[0.9375rem] font-medium text-ink">
          <span aria-hidden className={clsx("size-2 rounded-full", busyTool ? "animate-pulse bg-tight" : isSpeaking ? "animate-pulse bg-accent" : "bg-comfortable")} />
          {statusText}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 text-[0.9375rem] font-medium text-short">
          {error}
        </p>
      ) : null}

      {lines.length ? (
        <ol ref={listRef} aria-live="polite" aria-relevant="additions" className="mt-4 max-h-80 space-y-2.5 overflow-y-auto pr-1">
          {lines.map((l) => (
            <li key={l.id} className={clsx("flex", l.role === "user" ? "justify-end" : "justify-start")}>
              <p
                className={clsx(
                  "max-w-[88%] whitespace-pre-line rounded-xl px-3.5 py-2.5 text-[1rem] leading-relaxed text-ink",
                  l.role === "user" ? "rounded-br-md border border-lineStrong bg-raised" : "rounded-bl-md border border-line bg-canvas",
                )}
              >
                <span className="sr-only">{l.role === "user" ? t("ask.you") : t("ask.coach")}: </span>
                {l.text}
              </p>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
