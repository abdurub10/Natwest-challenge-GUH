"use client";
// Plan: ranked options with live what-if toggles. Each change (debounced 150 ms) calls
// POST /api/whatif with { actionIds }; the chart and the subtitle update from the response.
// "Set this up" calls POST /api/plan and moves to /app/done.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import clsx from "clsx";
import type { Forecast } from "@/lib/forecast/types";
import { useAppState } from "@/components/AppState";
import { ActionCard, HelpCard } from "@/components/ActionCard";
import { Chart90 } from "@/components/Chart90";
import { ErrorState, LoadingState, Money, ScreenHeader, Tpl, buttonClass } from "@/components/ui";
import { useForecast } from "@/lib/client/useForecast";
import { acceptPlan, isAbortError, whatIf } from "@/lib/client/api";
import { shortMonth } from "@/lib/client/forecastText";

const HELP_ID = "talk_to_someone";

export default function PlanPage() {
  const router = useRouter();
  const { t, language, dir, actionIds, setActionIds, setLastPlan } = useAppState();
  const { data: base, loading, error, reload } = useForecast(language);

  const options = useMemo(() => (base?.actions ?? []).filter((a) => a.id !== HELP_ID), [base]);
  const help = base?.actions.find((a) => a.id === HELP_ID);
  const helpFirst = base?.actions[0]?.id === HELP_ID;

  // Ticked actions: saved choice, else the engine's defaultOn. Only ids that still exist.
  const ticked = useMemo(() => {
    const valid = new Set(options.map((a) => a.id));
    const chosen = actionIds ?? options.filter((a) => a.defaultOn).map((a) => a.id);
    return options.map((a) => a.id).filter((id) => valid.has(id) && chosen.includes(id));
  }, [actionIds, options]);
  const tickedKey = ticked.join(",");
  const defaultKey = options.filter((a) => a.defaultOn).map((a) => a.id).join(",");

  const [result, setResult] = useState<{ key: string; forecast: Forecast } | null>(null);
  const [whatIfFailed, setWhatIfFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // Debounced what-if on every change of the ticked set.
  const reqRef = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!base || !tickedKey) return;
    if (result?.key === tickedKey) return;
    const timer = setTimeout(() => {
      reqRef.current?.abort();
      const controller = new AbortController();
      reqRef.current = controller;
      whatIf({ actionIds: tickedKey.split(",") }, { signal: controller.signal })
        .then((forecast) => {
          setResult({ key: tickedKey, forecast });
          setWhatIfFailed(false);
        })
        .catch((e) => {
          if (!isAbortError(e) && !controller.signal.aborted) setWhatIfFailed(true);
        });
    }, 150);
    return () => clearTimeout(timer);
  }, [base, tickedKey, result?.key]);
  useEffect(() => () => reqRef.current?.abort(), []);

  // Reset stale "couldn't set up" message when the page is hidden and shown again.
  useEffect(() => () => setSaveError(false), []);

  if (loading)
    return (
      <>
        <ScreenHeader title={t("plan.title")} />
        <LoadingState rows={3} />
      </>
    );
  if (error || !base)
    return (
      <>
        <ScreenHeader title={t("plan.title")} />
        <ErrorState onRetry={reload} />
      </>
    );

  const none = ticked.length === 0;
  const current = none ? base : result?.key === tickedKey ? result.forecast : null;
  const shown = current ?? result?.forecast ?? base; // keep the last line on screen while the next one loads
  const before = base.headroom.lowest;
  const provisionalAfter = !current && tickedKey === defaultKey ? base.headroom.afterPlan : undefined;
  const after = current ? current.headroom.lowest : provisionalAfter;
  const pending = !none && !current;
  const warning = base.warnings[0];
  const byMonth = shortMonth(warning?.endDate ?? base.headroom.lowestDate);

  function toggle(id: string, on: boolean) {
    const next = on ? [...ticked, id] : ticked.filter((x) => x !== id);
    setActionIds(options.map((a) => a.id).filter((x) => next.includes(x)));
    setSaveError(false);
  }

  async function setUp() {
    if (none || saving) return;
    setSaving(true);
    setSaveError(false);
    try {
      const res = await acceptPlan(ticked);
      setLastPlan(res);
      router.push("/app/done");
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  const subtitle = (
    <p aria-live="polite" className="text-[1.0625rem] text-ink">
      {none ? (
        <Tpl text={t("plan.subtitleNone")} vars={{ before: <Money value={before} className="font-semibold" /> }} />
      ) : after !== undefined ? (
        <Tpl
          text={t("plan.subtitle")}
          vars={{
            before: <Money value={before} className="font-semibold" />,
            after: <Money value={after} sign className={clsx("font-semibold", after < 0 ? "text-short" : "text-comfortable")} />,
          }}
        />
      ) : (
        <span className="text-muted">{t("plan.subtitleLoading")}</span>
      )}
    </p>
  );

  return (
    <>
      <ScreenHeader title={t("plan.title")} subtitle={subtitle} />
      <div className="space-y-5 pt-2">
        <div className={clsx("px-3 transition-opacity duration-300 ease-calm", pending && "opacity-70")}>
          <Chart90
            days={shown.days}
            compareDays={none ? undefined : base.days}
            warning={shown.warnings[0]}
            label={`${t("home.chartTitle")}. ${t("plan.after")}.`}
            todayLabel={t("day.today")}
            mainLabel={t("plan.after")}
            compareLabel={t("plan.before")}
            height={180}
          />
        </div>
        {whatIfFailed ? (
          <p role="status" className="px-5 text-[0.9375rem] text-muted">
            {t("error.load")}
          </p>
        ) : null}

        {helpFirst ? (
          <div className="px-5">
            <HelpCard summary={help?.summary} prominent />
          </div>
        ) : null}

        <ul className="space-y-3 px-5" aria-label={t("plan.title")}>
          {options.map((a) => (
            <li key={a.id}>
              <ActionCard action={a} checked={ticked.includes(a.id)} onToggle={(on) => toggle(a.id, on)} byMonth={byMonth} />
            </li>
          ))}
        </ul>

        {!helpFirst ? (
          <div className="px-5">
            <HelpCard />
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-0 z-10 mt-5 border-t border-line bg-canvas/95 px-5 pb-4 pt-3 backdrop-blur" dir={dir}>
        {saveError ? (
          <p role="alert" className="mb-2 text-[0.9375rem] text-short">
            {t("plan.setUpError")}
          </p>
        ) : null}
        <button type="button" onClick={setUp} disabled={none || saving} className={clsx(buttonClass.primary, "w-full")}>
          {saving ? <Loader2 aria-hidden size={18} className="animate-spin" /> : null}
          {saving ? t("plan.settingUp") : t("plan.setUp")}
        </button>
        <p className="mt-1.5 text-center text-[0.875rem] text-muted">{t("plan.ticked").replace("{n}", String(ticked.length))}</p>
      </div>
    </>
  );
}
