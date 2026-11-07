"use client";
// "How we worked this out": one accordion row per Cause, with the rule in words and the
// transaction counts behind it (from forecast.recurring). Native <details> for accessibility.
import { ChevronDown, Scale } from "lucide-react";
import type { Forecast, Warning } from "@/lib/forecast/types";
import { RULE_WORDS, countsPhrase, seriesForCause } from "@/lib/client/forecastText";
import { useAppState } from "./AppState";
import { Money, Tpl } from "./ui";

export function HowWeWorkedItOut({ forecast, warning }: { forecast: Forecast; warning?: Warning }) {
  const { t, tf, language, dir } = useAppState();
  const causes = warning?.causes ?? [];
  const regular = forecast.recurring.filter((s) => s.cadence !== "annual").length;

  return (
    <section aria-labelledby="how-title" className="mx-5" dir={dir}>
      <h2 id="how-title" className="flex items-center gap-2 text-[1.25rem] font-semibold text-ink">
        <Scale aria-hidden size={20} className="text-accent" />
        {t("how.title")}
      </h2>
      <p className="mt-1.5 text-[1rem] leading-snug text-muted">{t("how.intro")}</p>

      {causes.length ? (
        <div className="mt-4 overflow-hidden rounded-[20px] border border-line bg-card">
          {causes.map((c, k) => {
            const series = seriesForCause(c, forecast.recurring);
            const counts = countsPhrase(series, language);
            const notes = c.ruleId ? forecast.rulesFired.filter((r) => r.ruleId === c.ruleId && r.note && r.note !== c.detail).slice(0, 2) : [];
            return (
              <details key={c.id} className="group border-line [&:not(:first-child)]:border-t" open={k === 0}>
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 flex-1 text-[1.0625rem] font-medium leading-snug text-ink">{c.label}</span>
                  <Money value={c.amount} about className="shrink-0 text-[1rem] font-semibold text-ink" />
                  <ChevronDown aria-hidden size={18} className="shrink-0 text-muted transition-transform duration-200 ease-calm group-open:rotate-180" />
                </summary>
                <div className="space-y-2 px-5 pb-4 text-[1rem] leading-snug">
                  {c.ruleId ? (
                    <p className="text-ink">
                      <span className="font-semibold">{RULE_WORDS[c.ruleId] ?? t("how.ruleUsed")}:</span> {c.detail}
                    </p>
                  ) : (
                    <p className="text-ink">{c.detail}</p>
                  )}
                  {notes.map((n, i) => (
                    <p key={i} className="text-muted">
                      {n.note}
                    </p>
                  ))}
                  <p className="text-muted">
                    <Tpl text={t("how.effect")} vars={{ amount: <Money value={c.amount} /> }} />
                  </p>
                  {counts ? <p className="text-muted">{tf("how.basedOn", { counts })}</p> : null}
                </div>
              </details>
            );
          })}
        </div>
      ) : null}

      <p className="mt-3 text-[0.9375rem] leading-snug text-muted">{tf("how.regular", { n: regular })}</p>
    </section>
  );
}
