"use client";
// Home: "Your next 90 days". Headroom figure, 90-day chart, scrubber + day card,
// weekly strip and the one warning card. All numbers come from GET /api/forecast.
import { useState } from "react";
import { Sun } from "lucide-react";
import { Chart90 } from "@/components/Chart90";
import { DayCard } from "@/components/DayCard";
import { HeadroomFigure } from "@/components/HeadroomFigure";
import { Scrubber } from "@/components/Scrubber";
import { WarningCard } from "@/components/WarningCard";
import { WeekStrip } from "@/components/WeekStrip";
import { useAppState } from "@/components/AppState";
import { ErrorState, LoadingState, ScreenHeader, SectionTitle } from "@/components/ui";
import { useForecast } from "@/lib/client/useForecast";
import { dayHeadline } from "@/lib/client/forecastText";
import { formatDay, formatMoneyBand } from "@/lib/format";

export default function HomePage() {
  const { t, language, dir } = useAppState();
  const { data, loading, error, reload } = useForecast(language);
  const [index, setIndex] = useState(0);

  const header = <ScreenHeader eyebrow={t("home.greeting")} title={t("home.title")} />;

  if (loading) {
    return (
      <>
        {header}
        <LoadingState rows={2} />
      </>
    );
  }
  if (error || !data) {
    return (
      <>
        {header}
        <ErrorState onRetry={reload} />
      </>
    );
  }

  const i = Math.min(index, Math.max(0, data.days.length - 1));
  const warning = data.warnings[0];
  const chartLabel = `${t("home.chartTitle")}: ${t("home.title")}. ${t("home.lowest")}: ${formatMoneyBand(data.headroom.lowest, data.headroom.lowestP20, data.headroom.lowestP80)}, ${formatDay(data.headroom.lowestDate)}.`;

  return (
    <>
      {header}
      <div className="space-y-6 pb-2 pt-3">
        <HeadroomFigure forecast={data} />

        <section aria-labelledby="chart-title" className="space-y-1">
          <h2 id="chart-title" className="sr-only">
            {t("home.chartTitle")}
          </h2>
          <div className="px-3">
            <Chart90 days={data.days} index={i} onIndexChange={setIndex} warning={warning} label={chartLabel} todayLabel={t("day.today")} />
          </div>
          <Scrubber days={data.days} index={i} onChange={setIndex} valueText={dayHeadline(data, i, language)} />
        </section>

        <DayCard forecast={data} index={i} />

        <section aria-labelledby="weeks-title" className="space-y-2.5">
          <SectionTitle id="weeks-title" className="px-5">
            {t("home.weeksTitle")}
          </SectionTitle>
          <WeekStrip forecast={data} index={i} onSelect={setIndex} />
        </section>

        {warning ? (
          <WarningCard warning={warning} />
        ) : (
          <section className="mx-5 rounded-[20px] border border-line bg-card p-5" dir={dir}>
            <p className="flex items-center gap-2 text-[1.125rem] font-semibold text-comfortable">
              <Sun aria-hidden size={20} />
              {t("home.noWarning")}
            </p>
            <p className="mt-1 text-[1rem] text-muted">{t("home.noWarningBody")}</p>
          </section>
        )}
      </div>
    </>
  );
}
