"use client";
// The headroom figure: "Lowest point: about −£140", the date under it, and today's status chip.
import clsx from "clsx";
import type { Forecast, Status } from "@/lib/forecast/types";
import { formatDay } from "@/lib/format";
import { statusWord } from "@/lib/i18n";
import { useAppState } from "./AppState";
import { Day, Label, Money, Tpl } from "./ui";
import { STATUS_ICON } from "./StatusIcon";

const chipTone: Record<Status, string> = {
  comfortable: "bg-comfortable/10 text-comfortable",
  tight: "bg-tight/10 text-tight",
  short: "bg-short/10 text-short",
};

export function HeadroomFigure({ forecast }: { forecast: Forecast }) {
  const { t, language, dir } = useAppState();
  const { headroom, balanceToday } = forecast;
  const todayStatus: Status = forecast.days[0]?.status ?? "comfortable";
  const Icon = STATUS_ICON[todayStatus];
  const negative = headroom.lowest < 0;
  return (
    <div className="hr-enter-2 px-5 lg:flex lg:items-end lg:justify-between lg:gap-6" dir={dir}>
      <div>
        <Label as="h2" n={1}>
          {t("home.lowest")}
        </Label>
        <p
          className={clsx(
            "mt-1 font-serif text-[2.375rem] font-semibold leading-[1.02] tracking-[-0.035em] lg:mt-2 lg:text-[clamp(2.75rem,4.6vw,4.75rem)]",
            negative ? "text-short" : "text-ink",
          )}
        >
          <Money value={headroom.lowest} band={[headroom.lowestP20, headroom.lowestP80]} />
        </p>
        <p className="mt-1 text-[1.0625rem] text-ink lg:mt-2 lg:text-[1.25rem]">
          <Day iso={headroom.lowestDate}>{formatDay(headroom.lowestDate)}</Day>
        </p>
      </div>
      <p className="mt-4 lg:mb-1 lg:mt-0 lg:shrink-0">
        <span className={clsx("inline-flex min-h-9 items-center gap-2 rounded-full px-3.5 text-[0.9375rem] font-semibold", chipTone[todayStatus])}>
          <Icon aria-hidden size={18} />
          <span>
            <Tpl text={t("home.todayChip")} vars={{ status: statusWord(language, todayStatus), amount: <Money value={balanceToday} /> }} />
          </span>
        </span>
      </p>
    </div>
  );
}
