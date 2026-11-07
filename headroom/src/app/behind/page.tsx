"use client";
// /behind: the projector page. Left: what the engine found (recurring series, rules fired,
// last 12 months). Right: live activity rail with its source, health badges and demo controls.
import { useCallback, useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";
import { BellRing, Bot, Database, Loader2, RotateCcw, ShieldCheck, Workflow } from "lucide-react";
import type { ForecastResponse } from "@/lib/forecast/types";
import { formatDay, formatMoney, formatTime } from "@/lib/format";
import { demoN8n, demoReminderNow, demoReset, getForecast, getHealth, type HealthInfo } from "@/lib/client/api";
import { resetPrefs } from "@/lib/client/prefs";
import { CADENCE_WORDS, RULE_WORDS } from "@/lib/client/forecastText";
import { ActivityRail } from "@/components/ActivityRail";
import { HistoryChart } from "@/components/HistoryChart";

function Panel({ title, children, aside, className }: { title: string; children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <section className={clsx("rounded-[20px] border border-white/10 bg-[#141C19] p-6", className)} aria-label={title}>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-[1.375rem] font-semibold text-[#E8ECE9]">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Badge({ icon: Icon, label, value, tone }: { icon: typeof Database; label: string; value: string; tone: "good" | "warn" | "off" }) {
  const tones = {
    good: "border-[#5FD3B5]/40 text-[#5FD3B5]",
    warn: "border-[#F2C46D]/40 text-[#F2C46D]",
    off: "border-white/15 text-[#9BA7A1]",
  };
  return (
    <div className={clsx("flex items-center gap-3 rounded-2xl border bg-white/[0.03] px-4 py-3", tones[tone])}>
      <Icon aria-hidden size={22} className="shrink-0" />
      <div className="min-w-0">
        <p className="text-[0.875rem] uppercase tracking-[0.08em] text-[#9BA7A1]">{label}</p>
        <p className="truncate text-[1.125rem] font-semibold">{value}</p>
      </div>
    </div>
  );
}

function DemoButton({ onClick, busy, children, icon: Icon, tone = "default" }: { onClick: () => void; busy?: boolean; children: ReactNode; icon: typeof Database; tone?: "default" | "danger" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={clsx(
        "inline-flex min-h-14 items-center justify-center gap-2.5 rounded-2xl px-5 text-[1.125rem] font-semibold transition-colors duration-200 disabled:opacity-60",
        tone === "danger" ? "bg-[#3A1F1C] text-[#FFB4A9] hover:bg-[#4A2622]" : "bg-[#1F2B27] text-[#E8ECE9] hover:bg-[#283732]",
      )}
    >
      {busy ? <Loader2 aria-hidden size={20} className="animate-spin" /> : <Icon aria-hidden size={20} />}
      {children}
    </button>
  );
}

export default function BehindPage() {
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [forecastError, setForecastError] = useState(false);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [n8nOn, setN8nOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const loadForecast = useCallback(() => {
    setForecastError(false);
    getForecast("en").then(setForecast, () => setForecastError(true));
  }, []);
  useEffect(() => {
    let alive = true;
    getForecast("en").then(
      (f) => alive && setForecast(f),
      () => alive && setForecastError(true),
    );
    return () => {
      alive = false;
    };
  }, []);

  // Health badges: poll every 5 s.
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const h = await getHealth();
        if (!alive) return;
        setHealth(h);
        setHealthError(false);
      } catch {
        if (alive) setHealthError(true);
      } finally {
        if (alive) timer = setTimeout(tick, 5000);
      }
    };
    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Toggle state: last answer from POST /api/demo/n8n, else what /api/health reports.
  const n8nEnabled = n8nOn ?? health?.n8nEnabled ?? health?.n8n ?? false;
  const n8nBadge = !health ? "Checking" : health.n8n ? "On" : n8nEnabled && health.n8nConfigured === false ? "Not set up, fallback" : "Off, fallback";

  async function run(key: string, fn: () => Promise<unknown>, done: string) {
    setBusy(key);
    setNote(null);
    try {
      await fn();
      setNote(`${done} at ${formatTime(new Date().toISOString())}.`);
    } catch (e) {
      setNote(`That did not work: ${e instanceof Error ? e.message : "unknown error"}.`);
    } finally {
      setBusy(null);
    }
  }

  const f = forecast;
  const series = f ? [...f.recurring].sort((a, b) => (a.direction === b.direction ? b.amountP50 - a.amountP50 : a.direction === "in" ? -1 : 1)) : [];
  const fivePaydayCount = f?.history.months.filter((m) => m.fivePayday).length ?? 0;

  return (
    <div className="min-h-dvh bg-[#0E1412] font-sans text-[#E8ECE9]">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 px-8 py-6">
        <div>
          <p className="text-[1rem] font-semibold uppercase tracking-[0.12em] text-[#5FD3B5]">Headroom · behind the scenes</p>
          <h1 className="mt-1 font-serif text-[2.25rem] font-semibold leading-tight">How the forecast is built</h1>
        </div>
        <div className="flex items-center gap-4 text-[1.0625rem] text-[#9BA7A1]">
          {f ? (
            <span>
              Today <span className="font-semibold text-[#E8ECE9]">{formatDay(f.today)}</span> · Balance <span className="font-semibold tabular-nums text-[#E8ECE9]">{formatMoney(f.balanceToday)}</span> · Lowest{" "}
              <span className="font-semibold tabular-nums text-[#FFB4A9]">{formatMoney(f.headroom.lowest)}</span> on {formatDay(f.headroom.lowestDate)}
            </span>
          ) : null}
          <label className="flex items-center gap-2">
            <span className="sr-only">Persona</span>
            <select disabled className="min-h-11 rounded-xl border border-white/15 bg-[#141C19] px-3 text-[1rem] text-[#9BA7A1]" defaultValue="aisha" aria-label="Persona (switch available in a later version)">
              <option value="aisha">Aisha Rahman, 34</option>
              <option value="derek">Derek, 71</option>
            </select>
          </label>
        </div>
      </header>

      <div className="grid gap-6 p-8 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {/* Left column: what the engine found */}
        <div className="space-y-6">
          {forecastError ? (
            <div role="alert" className="rounded-[20px] border border-white/10 bg-[#141C19] p-6 text-[1.125rem]">
              We couldn&apos;t load the forecast.{" "}
              <button type="button" onClick={loadForecast} className="ml-2 font-semibold text-[#5FD3B5] underline underline-offset-4">
                Try again
              </button>
            </div>
          ) : null}

          <Panel title="What the engine found" aside={f ? <span className="text-[1rem] text-[#9BA7A1]">{f.recurring.length} recurring series from 12 months of transactions</span> : null}>
            {f ? (
              <div className="max-h-[520px] overflow-auto rounded-xl">
                <table className="w-full border-collapse text-left text-[1.0625rem]">
                  <thead className="sticky top-0 bg-[#141C19] text-[0.875rem] uppercase tracking-[0.08em] text-[#9BA7A1]">
                    <tr>
                      <th scope="col" className="py-2 pr-4 font-semibold">Series</th>
                      <th scope="col" className="py-2 pr-4 font-semibold">Cadence</th>
                      <th scope="col" className="py-2 pr-4 text-right font-semibold">Amount</th>
                      <th scope="col" className="py-2 pr-4 font-semibold">Confidence</th>
                      <th scope="col" className="py-2 text-right font-semibold">Seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {series.map((s) => {
                      const pct = Math.round(Math.max(0, Math.min(1, s.confidence)) * 100);
                      const range = Math.round(s.amountP20) !== Math.round(s.amountP80);
                      return (
                        <tr key={s.id} className="border-t border-white/[0.07]">
                          <th scope="row" className="py-2.5 pr-4 font-medium">
                            <span className={clsx("mr-2 inline-block w-8 text-[0.875rem] font-semibold", s.direction === "in" ? "text-[#5FD3B5]" : "text-[#9BA7A1]")}>{s.direction === "in" ? "IN" : "OUT"}</span>
                            {s.label}
                          </th>
                          <td className="py-2.5 pr-4 text-[#C9D2CD]">{CADENCE_WORDS[s.cadence] ?? s.cadence}</td>
                          <td className="py-2.5 pr-4 text-right tabular-nums">
                            {formatMoney(s.amountP50)}
                            {range ? <span className="block text-[0.875rem] text-[#9BA7A1]">{`${formatMoney(s.amountP20)} to ${formatMoney(s.amountP80)}`}</span> : null}
                          </td>
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2.5">
                              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10" aria-hidden>
                                <div className="h-full rounded-full bg-[#5FD3B5]" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="tabular-nums text-[#C9D2CD]">{pct}%</span>
                            </div>
                          </td>
                          <td className="py-2.5 text-right tabular-nums text-[#C9D2CD]">{s.count}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div aria-hidden className="h-64 animate-pulse rounded-xl bg-white/5" />
            )}
          </Panel>

          <Panel title="Rules that fired">
            {f ? (
              <ol className="space-y-2.5">
                {[...f.rulesFired]
                  .sort((a, b) => (a.date < b.date ? -1 : 1))
                  .map((r, k) => (
                    <li key={`${r.ruleId}-${r.date}-${k}`} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4 rounded-xl bg-white/[0.03] px-4 py-3">
                      <time dateTime={r.date} className="tabular-nums text-[1.0625rem] font-semibold text-[#5FD3B5]">
                        {formatDay(r.date)}
                      </time>
                      <div>
                        <p className="text-[1.0625rem] font-semibold">{RULE_WORDS[r.ruleId] ?? r.ruleId}</p>
                        <p className="text-[1rem] text-[#C9D2CD]">{r.note}</p>
                        <p className="mt-0.5 font-mono text-[0.8125rem] text-[#7E8A84]">{r.ruleId}</p>
                      </div>
                    </li>
                  ))}
              </ol>
            ) : (
              <div aria-hidden className="h-40 animate-pulse rounded-xl bg-white/5" />
            )}
          </Panel>

          <Panel title="Last 12 months" aside={f ? <span className="text-[1rem] text-[#9BA7A1]">{fivePaydayCount} five-payday months</span> : null}>
            {f ? <HistoryChart months={f.history.months} /> : <div aria-hidden className="h-64 animate-pulse rounded-xl bg-white/5" />}
          </Panel>
        </div>

        {/* Right column: live activity, health, demo controls */}
        <div className="space-y-6">
          <Panel title="Health" aside={healthError ? <span className="text-[1rem] text-[#FFB4A9]">Health check not answering</span> : null}>
            <div className="grid grid-cols-2 gap-3">
              <Badge icon={Database} label="Store" value={health ? (health.store === "supabase" ? "Supabase" : "In memory") : "Checking"} tone={health ? (health.store === "supabase" ? "good" : "warn") : "off"} />
              <Badge icon={Workflow} label="n8n" value={n8nBadge} tone={health ? (health.n8n ? "good" : "warn") : "off"} />
              <Badge icon={Bot} label="Claude" value={health ? (health.claude ? "Writing words" : "Template words") : "Checking"} tone={health ? (health.claude ? "good" : "warn") : "off"} />
              <Badge
                icon={ShieldCheck}
                label="Numbers checked"
                value={health ? `${health.numbersChecked ?? 0} checked, ${health.numbersRejected ?? 0} rejected` : "Checking"}
                tone={health ? ((health.numbersRejected ?? 0) > 0 ? "warn" : "good") : "off"}
              />
            </div>
          </Panel>

          <Panel title="Live activity" className="min-h-[360px]">
            <ActivityRail variant="behind" hideErrors={false} emptyText="Nothing yet. Set up a plan on the phone." limit={12} />
          </Panel>

          <Panel title="Demo controls">
            <div className="grid gap-3 sm:grid-cols-2">
              <DemoButton
                icon={RotateCcw}
                tone="danger"
                busy={busy === "reset"}
                onClick={() =>
                  run(
                    "reset",
                    async () => {
                      await demoReset();
                      resetPrefs(); // also clears the mirrored /app tab in this browser
                      setN8nOn(null); // the server turns n8n back on as part of the reset
                    },
                    "Demo reset",
                  )
                }
              >
                Reset demo
              </DemoButton>
              <DemoButton icon={BellRing} busy={busy === "reminder"} onClick={() => run("reminder", demoReminderNow, "Friday reminder sent")}>
                Send Friday reminder now
              </DemoButton>
            </div>
            <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-white/[0.03] px-5 py-4">
              <div>
                <p id="n8n-label" className="text-[1.125rem] font-semibold">
                  n8n workflows
                </p>
                <p className="text-[1rem] text-[#9BA7A1]">{n8nEnabled ? "Messages go through n8n." : "Off: messages use the built-in fallback."}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={n8nEnabled}
                aria-labelledby="n8n-label"
                disabled={busy === "n8n"}
                onClick={() =>
                  run(
                    "n8n",
                    async () => {
                      const r = await demoN8n(!n8nEnabled);
                      setN8nOn(r.enabled);
                    },
                    !n8nEnabled ? "n8n turned on" : "n8n turned off",
                  )
                }
                className="inline-flex size-14 shrink-0 items-center justify-center rounded-full disabled:opacity-60"
              >
                <span aria-hidden className={clsx("relative h-8 w-14 rounded-full transition-colors duration-300", n8nEnabled ? "bg-[#5FD3B5]" : "bg-white/20")}>
                  <span className={clsx("absolute top-1 size-6 rounded-full bg-white transition-transform duration-300", n8nEnabled ? "translate-x-7" : "translate-x-1")} />
                </span>
              </button>
            </div>
            <p role="status" className="mt-3 min-h-6 text-[1rem] text-[#C9D2CD]">
              {note}
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
