"use client";
// Why panel: the plain-English explanation (written from engine facts), "How we worked this out",
// and "This happened before" from the 12-month history.
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, History } from "lucide-react";
import clsx from "clsx";
import { useAppState } from "@/components/AppState";
import { HowWeWorkedItOut } from "@/components/HowWeWorkedItOut";
import { ErrorState, LoadingState, Money, ScreenHeader, Tpl, buttonClass } from "@/components/ui";
import { useForecast } from "@/lib/client/useForecast";
import { monthLabel } from "@/lib/client/forecastText";
import { explain } from "@/lib/client/api";
import { formatDay, formatMoney } from "@/lib/format";
import type { Explanation, Forecast, Language } from "@/lib/forecast/types";

/** Template from plan section 15.5, used only if the server sent no explanation and /api/explain failed. */
function templateExplanation(f: Forecast, lang: Language): Explanation | undefined {
  const w = f.warnings[0];
  if (!w) return undefined;
  const days = f.days.filter((d) => d.date >= w.startDate && d.date <= w.endDate).length;
  const options = f.actions.filter((a) => a.id !== "talk_to_someone");
  return {
    headline: `You may be short by about ${formatMoney(Math.abs(w.depthP50))} from ${formatDay(w.startDate)} to ${formatDay(w.endDate)}.`,
    why: w.causes.map((c) => `${c.label}: about ${formatMoney(c.amount)}.`),
    whatThisMeans: `Your balance is likely to go below zero for ${days} days unless something changes.`,
    reassurance: `This is predictable and there are ${options.length} things you can do.`,
    nextStep: options[0] ? `The biggest help is: ${options[0].title}.` : "",
    language: lang,
  };
}

/** The explanation from GET /api/forecast, or POST /api/explain if it was missing. */
function useExplanation(f: Forecast & { explanation?: Explanation } | undefined, lang: Language) {
  const [fetched, setFetched] = useState<{ key: string; ex?: Explanation; failed?: boolean } | null>(null);
  const key = f ? `${lang}:${f.warnings[0]?.id ?? "none"}` : "";
  const need = !!f && !!f.warnings[0] && !f.explanation;
  useEffect(() => {
    if (!need || fetched?.key === key) return;
    const controller = new AbortController();
    explain(lang, { signal: controller.signal }).then(
      (ex) => setFetched({ key, ex }),
      () => {
        if (!controller.signal.aborted) setFetched({ key, failed: true });
      },
    );
    return () => controller.abort();
  }, [need, key, lang, fetched?.key]);
  if (!f) return { ex: undefined, pending: false };
  if (f.explanation) return { ex: f.explanation, pending: false };
  if (fetched?.key === key) return { ex: fetched.ex ?? templateExplanation(f, lang), pending: false };
  return { ex: undefined, pending: need };
}

export default function WhyPage() {
  const { t, language, dir } = useAppState();
  const { data, loading, error, reload } = useForecast(language);
  const { ex } = useExplanation(data, language);

  const back = (
    <div className="px-3 pt-3">
      <Link href="/app" className={buttonClass.quiet}>
        <ArrowLeft aria-hidden size={18} className={dir === "rtl" ? "rotate-180" : undefined} />
        {t("why.back")}
      </Link>
    </div>
  );

  if (loading)
    return (
      <>
        {back}
        <ScreenHeader title={t("why.title")} />
        <LoadingState chart={false} rows={3} />
      </>
    );
  if (error || !data)
    return (
      <>
        {back}
        <ScreenHeader title={t("why.title")} />
        <ErrorState onRetry={reload} />
      </>
    );

  const warning = data.warnings[0];
  const past = data.history.months.filter((m) => m.overdraftDays > 0);

  return (
    <>
      {back}
      <ScreenHeader title={t("why.title")} />
      <div className="space-y-7 pb-2 pt-3">
        {warning && ex ? (
          <article className="mx-5 rounded-[20px] border border-line bg-card p-5" dir={dir} aria-labelledby="ex-headline">
            <h2 id="ex-headline" className="font-serif text-[1.375rem] font-semibold leading-snug text-ink">
              {ex.headline}
            </h2>
            {ex.why.length ? (
              <ul className="mt-4 space-y-2.5">
                {ex.why.map((w, k) => (
                  <li key={k} className="flex gap-3 text-[1.0625rem] leading-snug text-ink">
                    <span aria-hidden className="mt-[0.55em] size-2 shrink-0 rounded-full bg-accent" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {ex.whatThisMeans ? <p className="mt-4 text-[1.0625rem] leading-relaxed text-ink">{ex.whatThisMeans}</p> : null}
            {ex.reassurance ? <p className="mt-3 text-[1.0625rem] leading-relaxed text-muted">{ex.reassurance}</p> : null}
            {ex.nextStep ? (
              <div className="mt-5 rounded-2xl bg-accentSoft p-4">
                <p className="text-[0.875rem] font-semibold uppercase tracking-[0.06em] text-[#0B5A4B]">{t("why.bestNext")}</p>
                <p className="mt-1 text-[1.0625rem] leading-snug text-ink">{ex.nextStep}</p>
                <Link href="/app/plan" className={clsx(buttonClass.primary, "mt-3 w-full")}>
                  {t("warning.plan")}
                  <ArrowRight aria-hidden size={18} className={dir === "rtl" ? "rotate-180" : undefined} />
                </Link>
              </div>
            ) : null}
          </article>
        ) : warning ? (
          <div className="mx-5 rounded-[20px] border border-line bg-card p-5" dir={dir}>
            <p className="text-[1.0625rem] text-ink">{t("loading")}</p>
          </div>
        ) : (
          <div className="mx-5 rounded-[20px] border border-line bg-card p-5" dir={dir}>
            <p className="text-[1.0625rem] leading-snug text-ink">{t("why.nothing")}</p>
          </div>
        )}

        <HowWeWorkedItOut forecast={data} warning={warning} />

        {past.length ? (
          <section aria-labelledby="before-title" className="mx-5" dir={dir}>
            <h2 id="before-title" className="flex items-center gap-2 text-[1.25rem] font-semibold text-ink">
              <History aria-hidden size={20} className="text-accent" />
              {t("why.happenedBefore")}
            </h2>
            <p className="mt-1.5 text-[1rem] text-muted">{t("why.happenedBeforeIntro")}</p>
            <ul className="mt-3 divide-y divide-line rounded-[20px] border border-line bg-card">
              {past.map((m) => (
                <li key={m.month} className="px-5 py-3.5">
                  <p className="text-[1.0625rem] font-semibold text-ink">{monthLabel(m.month)}</p>
                  <p className="mt-0.5 text-[1rem] text-muted">
                    <Tpl text={t("why.monthRow")} vars={{ days: m.overdraftDays, low: <Money value={m.low} /> }} />
                  </p>
                  {m.fivePayday ? <p className="mt-0.5 text-[0.9375rem] text-muted">{t("why.fivePaydays")}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
