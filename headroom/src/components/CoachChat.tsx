"use client";
// Chat coach: message list, four suggestion chips, input and send. History is kept on the
// client and sent with every request (the server is stateless). Replies that passed the
// number check show "checked against your forecast".
import { useEffect, useRef, useState, type FormEvent } from "react";
import clsx from "clsx";
import { ArrowUp, BadgeCheck, RotateCcw } from "lucide-react";
import { coach, isAbortError, type ChatMessage } from "@/lib/client/api";
import { ASK_CHIP_KEYS } from "@/lib/i18n";
import { useAppState } from "./AppState";

interface Msg extends ChatMessage {
  id: number;
  checked?: boolean;
  failed?: boolean;
}

export function CoachChat() {
  const { t, language, dir } = useAppState();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!messages.length && !pending) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ block: "end", behavior: reduced ? "auto" : "smooth" });
  }, [messages, pending]);

  async function send(text: string, base: Msg[] = messages) {
    const content = text.trim();
    if (!content || pending) return;
    const userMsg: Msg = { id: nextId.current++, role: "user", content };
    // Only real turns go to the server; failed placeholders are not part of the conversation.
    const history = [...base.filter((m) => !m.failed), userMsg];
    setMessages([...base, userMsg]);
    setDraft("");
    setPending(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await coach(
        language,
        // The server keeps no state; send the recent conversation each time (it accepts up to 40 turns).
        history.slice(-20).map(({ role, content }) => ({ role, content: content.slice(0, 4000) })),
        { signal: controller.signal },
      );
      setMessages((m) => [...m, { id: nextId.current++, role: "assistant", content: res.reply, checked: !!res.checked }]);
    } catch (e) {
      if (isAbortError(e)) return;
      setMessages((m) => [...m, { id: nextId.current++, role: "assistant", content: t("ask.error"), failed: true }]);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setPending(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(draft);
  }

  function clear() {
    abortRef.current?.abort();
    setMessages([]);
    setPending(false);
    inputRef.current?.focus();
  }

  const chips = ASK_CHIP_KEYS.map((k) => t(k));
  const empty = messages.length === 0;

  return (
    <div className="flex flex-col">
      <div className="px-5">
        {empty ? (
          <section aria-labelledby="chips-title" className="mt-2" dir={dir}>
            <h2 id="chips-title" className="text-[0.9375rem] font-semibold text-muted">
              {t("ask.chipsLabel")}
            </h2>
            <ul className="mt-2.5 flex flex-col gap-2">
              {chips.map((c) => (
                <li key={c}>
                  <button
                    type="button"
                    onClick={() => void send(c)}
                    className="flex min-h-12 w-full items-center rounded-2xl border border-line bg-card px-4 py-2.5 text-left text-[1rem] leading-snug text-ink transition-colors duration-200 ease-calm hover:border-accent/40 hover:bg-accentSoft/50"
                  >
                    {c}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <ol aria-live="polite" aria-relevant="additions" className="mt-2 space-y-3">
            {messages.map((m) => (
              <li key={m.id} className={clsx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  dir={dir}
                  className={clsx(
                    "max-w-[86%] rounded-[20px] px-4 py-3 text-[1.0625rem] leading-relaxed",
                    m.role === "user" ? "rounded-br-md bg-accent text-white" : "rounded-bl-md border border-line bg-card text-ink",
                  )}
                >
                  <span className="sr-only">{m.role === "user" ? t("ask.you") : t("ask.coach")}: </span>
                  <p className="whitespace-pre-line">{m.content}</p>
                  {m.role === "assistant" && m.checked ? (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-comfortable">
                      <BadgeCheck aria-hidden size={16} />
                      {t("ask.checked")}
                    </p>
                  ) : null}
                  {m.failed ? (
                    <button
                      type="button"
                      className="mt-2 inline-flex min-h-11 items-center font-semibold text-accent underline underline-offset-4"
                      onClick={() => {
                        const lastUser = [...messages].reverse().find((x) => x.role === "user");
                        if (!lastUser) return;
                        void send(lastUser.content, messages.filter((x) => x.id !== m.id && x.id !== lastUser.id));
                      }}
                    >
                      {t("error.retry")}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
            {pending ? (
              <li className="flex justify-start" role="status">
                <div className="inline-flex items-center gap-2.5 rounded-[20px] rounded-bl-md border border-line bg-card px-4 py-3 text-[1rem] text-muted" dir={dir}>
                  <span aria-hidden className="flex gap-1">
                    <span className="size-1.5 animate-pulse rounded-full bg-accent" />
                    <span className="size-1.5 animate-pulse rounded-full bg-accent [animation-delay:150ms]" />
                    <span className="size-1.5 animate-pulse rounded-full bg-accent [animation-delay:300ms]" />
                  </span>
                  {t("ask.thinking")}
                </div>
              </li>
            ) : null}
          </ol>
        )}
        {!empty ? (
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={clear} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[0.9375rem] font-semibold text-muted hover:text-ink">
              <RotateCcw aria-hidden size={16} />
              {t("ask.clear")}
            </button>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSubmit} className="sticky bottom-0 z-10 mt-4 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur">
        <label htmlFor="ask-input" className="sr-only">
          {t("ask.placeholder")}
        </label>
        <div className="flex items-end gap-2 rounded-[24px] border border-line bg-card p-1.5 pl-4 focus-within:border-accent focus-within:shadow-[0_0_0_2px_rgba(15,110,92,0.2)]">
          <textarea
            id="ask-input"
            ref={inputRef}
            rows={1}
            value={draft}
            dir={dir}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send(draft);
              }
            }}
            placeholder={t("ask.placeholder")}
            className="max-h-32 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-[1.0625rem] leading-snug text-ink outline-none placeholder:text-muted [field-sizing:content] focus-visible:outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim() || pending}
            aria-label={t("ask.send")}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-colors duration-200 ease-calm disabled:bg-line disabled:text-muted"
          >
            <ArrowUp aria-hidden size={20} />
          </button>
        </div>
      </form>
    </div>
  );
}
