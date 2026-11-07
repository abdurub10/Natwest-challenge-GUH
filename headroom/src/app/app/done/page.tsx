"use client";
// Done: "Done. Your plan is set." What was scheduled and sent, the live activity rail,
// and two buttons: Back to forecast, Ask a question.
import Link from "next/link";
import clsx from "clsx";
import { BellRing, CalendarCheck2, CheckCircle2, MessageSquareText } from "lucide-react";
import { useAppState } from "@/components/AppState";
import { ActivityRail } from "@/components/ActivityRail";
import { Day, LoadingState, Money, ScreenHeader, Tpl, buttonClass } from "@/components/ui";
import { useForecast } from "@/lib/client/useForecast";
import { formatDay } from "@/lib/format";

export default function DonePage() {
  const { t, language, dir, lastPlan, ready } = useAppState();
  const { data } = useForecast(language);

  if (!ready) return <LoadingState chart={false} rows={2} />;

  if (!lastPlan) {
    return (
      <>
        <ScreenHeader title={t("plan.title")} />
        <div className="mx-5 mt-3 rounded-[20px] border border-line bg-card p-5" dir={dir}>
          <p className="text-[1.0625rem] text-ink">{t("done.empty")}</p>
          <Link href="/app/plan" className={clsx(buttonClass.primary, "mt-4 w-full")}>
            {t("done.emptyLink")}
          </Link>
        </div>
      </>
    );
  }

  const { plan } = lastPlan;
  const actions = plan.actionIds.map((id) => data?.actions.find((a) => a.id === id) ?? { id, title: id.replace(/_/g, " "), date: undefined });
  // Show this plan's activity: entries from a few seconds before it was created onwards.
  const since = new Date(new Date(plan.createdAt).getTime() - 5000).toISOString();

  return (
    <>
      <div className="px-5 pt-8" dir={dir}>
        <CheckCircle2 aria-hidden size={40} className="text-comfortable" strokeWidth={1.75} />
      </div>
      <ScreenHeader
        title={t("done.title")}
        subtitle={
          <Tpl
            text={t("done.lowestNow")}
            vars={{ amount: <Money value={lastPlan.lowestAfter} sign className={clsx("font-semibold", lastPlan.lowestAfter < 0 ? "text-short" : "text-comfortable")} /> }}
          />
        }
      />

      <div className="space-y-5 pt-3">
        <section aria-labelledby="scheduled-title" className="mx-5 rounded-[20px] border border-line bg-card p-5" dir={dir}>
          <h2 id="scheduled-title" className="text-[1.0625rem] font-semibold text-ink">
            {t("done.scheduled")}
          </h2>
          <ul className="mt-2 divide-y divide-line">
            {actions.map((a) => (
              <li key={a.id} className="flex gap-3 py-3">
                <CalendarCheck2 aria-hidden size={20} className="mt-0.5 shrink-0 text-accent" />
                <div>
                  <p className="text-[1.0625rem] leading-snug text-ink">{a.title}</p>
                  {a.date ? (
                    <p className="mt-0.5 text-[0.9375rem] text-muted">
                      <Tpl text={t("done.reminder")} vars={{ date: <Day iso={a.date}>{formatDay(a.date)}</Day> }} />
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
            <li className="flex gap-3 py-3">
              <BellRing aria-hidden size={20} className="mt-0.5 shrink-0 text-accent" />
              <p className="text-[1.0625rem] leading-snug text-ink">{t("done.everyFriday")}</p>
            </li>
            <li className="flex gap-3 py-3">
              <MessageSquareText aria-hidden size={20} className="mt-0.5 shrink-0 text-accent" />
              <p className="text-[1.0625rem] leading-snug text-ink">{t("done.sent")}</p>
            </li>
          </ul>
        </section>

        <div className="mx-5">
          <ActivityRail title={t("done.activity")} since={since} emptyText={t("activity.empty")} />
        </div>

        <div className="mx-5 flex flex-col gap-2.5">
          <Link href="/app" className={clsx(buttonClass.primary, "w-full")}>
            {t("done.back")}
          </Link>
          <Link href="/app/ask" className={clsx(buttonClass.secondary, "w-full")}>
            {t("done.ask")}
          </Link>
        </div>
      </div>
    </>
  );
}
