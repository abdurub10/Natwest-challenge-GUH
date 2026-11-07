"use client";
// Activity rail: polls GET /api/activity every 3 s and lists "Plan saved 14:32",
// "Plan sent by WhatsApp 14:32". On /behind it also shows which path ran (app / n8n / fallback).
import { useEffect, useState } from "react";
import clsx from "clsx";
import { AlertTriangle, BellRing, CheckCircle2, MessageSquareText, RotateCcw, Send, Users } from "lucide-react";
import type { Activity, ActivityKind, ActivitySource } from "@/lib/forecast/types";
import { formatTime } from "@/lib/format";
import { getActivity } from "@/lib/client/api";

const KIND_ICON: Record<ActivityKind, typeof CheckCircle2> = {
  plan_created: CheckCircle2,
  message_sent: MessageSquareText,
  reminder_sent: BellRing,
  handoff_sent: Users,
  reset: RotateCcw,
  error: AlertTriangle,
};

const SOURCE_STYLE: Record<ActivitySource, string> = {
  app: "bg-[#2A3A35] text-[#CFE9E1]",
  n8n: "bg-[#3B2B4F] text-[#E6D6FF]",
  fallback: "bg-[#4A3A16] text-[#FFE2A6]",
};

export interface ActivityRailProps {
  variant?: "app" | "behind";
  /** Hide entries older than this ISO timestamp (Done screen shows this plan's activity first). */
  since?: string;
  pollMs?: number;
  emptyText?: string;
  title?: string;
  limit?: number;
  /** Hide number-check log lines (kind "error") in the customer app. */
  hideErrors?: boolean;
}

export function useActivity(pollMs = 3000) {
  const [items, setItems] = useState<Activity[] | null>(null);
  const [failed, setFailed] = useState(false);
  // Ids present on the first successful load; anything newer fades in.
  const [initialIds, setInitialIds] = useState<Set<string> | null>(null);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const tick = async () => {
      try {
        const list = await getActivity({ signal: controller.signal });
        if (!alive) return;
        const safe = Array.isArray(list) ? list : [];
        setItems(safe);
        setInitialIds((prev) => prev ?? new Set(safe.map((a) => a.id)));
        setFailed(false);
      } catch {
        if (!alive) return;
        setFailed(true);
      } finally {
        if (alive) timer = setTimeout(tick, document.visibilityState === "hidden" ? pollMs * 3 : pollMs);
      }
    };
    tick();
    return () => {
      alive = false;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [pollMs]);
  return { items, failed, initialIds };
}

export function ActivityRail({ variant = "app", since, pollMs = 3000, emptyText = "Nothing yet.", title, limit = 20, hideErrors = variant === "app" }: ActivityRailProps) {
  const { items, failed, initialIds } = useActivity(pollMs);

  const sinceMs = since ? Date.parse(since) : NaN;
  const list = (items ?? [])
    .filter((a) => (hideErrors ? a.kind !== "error" : true))
    .filter((a) => (Number.isFinite(sinceMs) ? Date.parse(a.createdAt) >= sinceMs : true))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit);

  const isFresh = (id: string) => !!initialIds && !initialIds.has(id);

  const behind = variant === "behind";

  return (
    <section aria-label={title ?? "Activity"} className={behind ? "" : "rounded-[20px] border border-line bg-card p-5"}>
      {title ? <h2 className={clsx("font-semibold", behind ? "mb-4 text-[1.375rem] text-[#E8ECE9]" : "mb-2 text-[1.0625rem] text-ink")}>{title}</h2> : null}
      {items === null && !failed ? (
        <div aria-hidden className="space-y-2">
          <div className={clsx("h-11 animate-pulse rounded-xl", behind ? "bg-white/5" : "bg-line/60")} />
          <div className={clsx("h-11 animate-pulse rounded-xl", behind ? "bg-white/5" : "bg-line/60")} />
        </div>
      ) : list.length === 0 ? (
        <p className={behind ? "text-[1.125rem] text-[#9BA7A1]" : "text-[1rem] text-muted"}>{emptyText}</p>
      ) : (
        <ol aria-live="polite" aria-relevant="additions" className={clsx(behind ? "space-y-2.5" : "divide-y divide-line")}>
          {list.map((a) => {
            const Icon = a.kind === "message_sent" && a.source !== "app" ? Send : KIND_ICON[a.kind] ?? CheckCircle2;
            return (
              <li
                key={a.id}
                className={clsx(
                  "flex items-start gap-3",
                  behind ? "rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5" : "py-3",
                  isFresh(a.id) && "animate-[hr-fade-in_600ms_cubic-bezier(0.22,1,0.36,1)]",
                )}
              >
                <Icon aria-hidden size={behind ? 24 : 20} className={clsx("mt-0.5 shrink-0", a.kind === "error" ? (behind ? "text-[#FFB4A9]" : "text-short") : behind ? "text-[#5FD3B5]" : "text-accent")} />
                <div className="min-w-0 flex-1">
                  <p className={clsx("leading-snug", behind ? "text-[1.25rem] text-[#E8ECE9]" : "text-[1.0625rem] text-ink")}>
                    <span className="font-semibold">{a.title}</span> <time dateTime={a.createdAt} className={clsx("tabular-nums", behind ? "text-[#9BA7A1]" : "text-muted")}>{formatTime(a.createdAt)}</time>
                  </p>
                  {a.detail && behind ? <p className="mt-0.5 truncate text-[1rem] text-[#9BA7A1]">{a.detail}</p> : null}
                </div>
                {behind ? <span className={clsx("shrink-0 rounded-full px-2.5 py-1 text-[0.875rem] font-semibold uppercase tracking-wide", SOURCE_STYLE[a.source] ?? SOURCE_STYLE.app)}>{a.source}</span> : null}
              </li>
            );
          })}
        </ol>
      )}
      {failed && items !== null ? <p className={clsx("mt-2 text-[0.875rem]", behind ? "text-[#9BA7A1]" : "text-muted")}>Reconnecting</p> : null}
      <style>{`@keyframes hr-fade-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}`}</style>
    </section>
  );
}
