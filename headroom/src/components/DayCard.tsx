"use client";
// Day card under the scrubber: date, events with amounts and notes, projected balance with
// its band, and the status sentence. Content updates immediately as the scrubber moves.
import clsx from "clsx";
import type { Forecast } from "@/lib/forecast/types";
import { formatDay } from "@/lib/format";
import { statusSentence } from "@/lib/i18n";
import { nextUniversalCredit, sortedEvents, warningForDay } from "@/lib/client/forecastText";
import { useAppState } from "./AppState";
import { StatusIcon } from "./StatusIcon";
import { Day, Money, Tpl } from "./ui";

export function DayCard({ forecast, index }: { forecast: Forecast; index: number }) {
  const { t, language, dir } = useAppState();
  const day = forecast.days[index];
  if (!day) return null;
  const isToday = index === 0;
  const events = sortedEvents(day.events);
  const warning = warningForDay(forecast, day.date);
  const nextUc = warning ? nextUniversalCredit(forecast, index) : undefined;
  const wide = Math.abs(day.p80 - day.p20) > 40;

  return (
    <section aria-labelledby="day-card-title" className="mx-5 rounded-[20px] border border-line bg-card p-5" dir={dir}>
      <div className="flex items-start justify-between gap-3">
        <h3 id="day-card-title" className="text-[1.25rem] font-semibold text-ink">
          <Day iso={day.date}>{formatDay(day.date)}</Day>
          {isToday ? <span className="ml-2 text-[0.9375rem] font-medium text-muted">{t("day.today")}</span> : null}
        </h3>
        <StatusIcon status={day.status} className="mt-0.5 text-[0.9375rem]" size={18} />
      </div>

      {events.length ? (
        <ul className="mt-3 divide-y divide-line">
          {events.map((e, k) => (
            <li key={`${e.label}-${k}`} className="py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[1.0625rem] leading-snug text-ink">{e.label}</span>
                {e.amount !== 0 ? (
                  <Money value={e.amount} sign className={clsx("shrink-0 text-[1.0625rem] font-semibold", e.amount > 0 ? "text-comfortable" : "text-ink")} />
                ) : null}
              </div>
              {e.note ? <p className="mt-0.5 text-[0.9375rem] leading-snug text-muted">{e.note}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[1.0625rem] text-muted">{t("day.nothingDue")}</p>
      )}

      <div className="mt-3 rounded-2xl bg-canvas px-4 py-3">
        <p className="text-[0.9375rem] text-muted">{isToday ? t("day.balanceToday") : t("day.balanceAfter")}</p>
        <p className={clsx("mt-0.5 text-[1.5rem] font-semibold leading-tight", day.p50 < 0 ? "text-short" : "text-ink")}>
          <Money value={day.p50} about={!isToday && wide} />
        </p>
        {!isToday && wide ? (
          <p className="mt-0.5 text-[0.9375rem] text-muted">
            <Tpl text={t("day.between")} vars={{ low: <Money value={day.p20} />, high: <Money value={day.p80} /> }} />
          </p>
        ) : null}
      </div>

      <p className="mt-3 text-[1.0625rem] leading-snug text-ink">{statusSentence(language, day.status)}</p>
      {warning ? (
        <p className="mt-1.5 text-[1.0625rem] leading-snug text-ink">
          <Tpl text={t("day.inStretch")} vars={{ start: <Day iso={warning.startDate}>{formatDay(warning.startDate).split(" ").slice(1).join(" ")}</Day> }} />
          {nextUc ? (
            <>
              {" "}
              <Tpl text={t("day.ucNext")} vars={{ date: <Day iso={nextUc.date}>{formatDay(nextUc.date)}</Day> }} />
            </>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
