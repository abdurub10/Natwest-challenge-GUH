"use client";
// One calm warning: "You're likely to be short from Mon 25 Jan to Mon 1 Feb, by about £140."
// Built from the warning's own numbers. Two buttons: Why, See what you can do.
import Link from "next/link";
import { ArrowRight, CloudRain } from "lucide-react";
import clsx from "clsx";
import type { Warning } from "@/lib/forecast/types";
import { formatDay } from "@/lib/format";
import { useAppState } from "./AppState";
import { Day, Money, Tpl, buttonClass } from "./ui";

export function WarningCard({ warning }: { warning: Warning }) {
  const { t, dir } = useAppState();
  const biggest = warning.causes[0];
  return (
    <section aria-labelledby="warning-title" className="mx-5 overflow-hidden rounded-[20px] border border-short/25 bg-card" dir={dir}>
      <div className="flex items-center gap-2 bg-short/[0.07] px-5 py-2.5 text-short">
        <CloudRain aria-hidden size={18} />
        <span className="text-[0.9375rem] font-semibold">{t("status.short")}</span>
      </div>
      <div className="p-5">
        <h2 id="warning-title" className="font-serif text-[1.375rem] font-semibold leading-snug text-ink">
          <Tpl
            text={t("warning.text")}
            vars={{
              start: <Day iso={warning.startDate}>{formatDay(warning.startDate)}</Day>,
              end: <Day iso={warning.endDate}>{formatDay(warning.endDate)}</Day>,
              amount: <Money value={Math.abs(warning.depthP50)} />,
            }}
          />
        </h2>
        {biggest ? (
          <p className="mt-2 text-[1rem] leading-snug text-muted">
            <Tpl text={t("warning.biggest")} vars={{ label: biggest.label }} />
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2.5">
          <Link href="/app/why" className={clsx(buttonClass.secondary, "flex-1 basis-[30%]")}>
            {t("warning.why")}
          </Link>
          <Link href="/app/plan" className={clsx(buttonClass.primary, "flex-[2] basis-[60%]")}>
            {t("warning.plan")}
            <ArrowRight aria-hidden size={18} className={dir === "rtl" ? "rotate-180" : undefined} />
          </Link>
        </div>
      </div>
    </section>
  );
}
