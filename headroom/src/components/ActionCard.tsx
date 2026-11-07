"use client";
// One option on the Plan screen: title, pound chips ("+£150 by Feb", "+£17 a month"), effort,
// eligibility label, expandable steps and link, and an accessible toggle switch.
import { useId, useState } from "react";
import clsx from "clsx";
import { ChevronDown, Clock, ExternalLink, Phone } from "lucide-react";
import type { ActionCandidate, Eligibility } from "@/lib/forecast/types";
import { eligibilityLabel } from "@/lib/i18n";
import { useAppState } from "./AppState";
import { Chip, Money, Tpl } from "./ui";

const eligTone: Record<Eligibility, "comfortable" | "accent" | "neutral"> = { yes: "comfortable", likely: "accent", check: "neutral" };

function normaliseLink(link: string): string {
  return /^https?:\/\//i.test(link) ? link : `https://${link.replace(/^\/+/, "")}`;
}

export function Switch({ checked, onChange, labelledBy, describedBy }: { checked: boolean; onChange: (v: boolean) => void; labelledBy: string; describedBy?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onClick={() => onChange(!checked)}
      className="group relative -m-1.5 inline-flex size-14 shrink-0 items-center justify-center rounded-full"
    >
      <span
        aria-hidden
        className={clsx(
          "relative h-[30px] w-[50px] rounded-full border-2 transition-colors duration-300 ease-calm",
          checked ? "border-accent bg-accent" : "border-[#9AA19D] bg-[#ECE8E1]",
        )}
      >
        <span
          className={clsx(
            "absolute top-[2px] size-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform duration-300 ease-calm",
            checked ? "translate-x-[22px]" : "translate-x-[2px]",
          )}
        />
      </span>
    </button>
  );
}

export function ActionCard({ action, checked, onToggle, byMonth }: { action: ActionCandidate; checked: boolean; onToggle: (v: boolean) => void; byMonth: string }) {
  const { t, language, dir } = useAppState();
  const [open, setOpen] = useState(false);
  const uid = useId();
  const titleId = `${uid}-title`;
  const chipsId = `${uid}-chips`;
  const stepsId = `${uid}-steps`;

  return (
    <article className={clsx("rounded-[20px] border bg-card transition-[border-color,box-shadow] duration-300 ease-calm", checked ? "border-accent/50 shadow-[0_0_0_1px_rgba(15,110,92,0.35)]" : "border-line")} dir={dir}>
      <div className="flex items-start gap-3 p-5 pb-3">
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="text-[1.125rem] font-semibold leading-snug text-ink">
            {action.title}
          </h3>
          <div id={chipsId} className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {action.effectByCliff > 0 ? (
              <Chip tone="accent">
                <Tpl text={t("plan.byWhen")} vars={{ amount: <Money value={action.effectByCliff} />, month: byMonth }} />
              </Chip>
            ) : null}
            {action.effectMonthly > 0 ? (
              <Chip tone="accent">
                <Tpl text={t("plan.monthly")} vars={{ amount: <Money value={action.effectMonthly} /> }} />
              </Chip>
            ) : null}
            <Chip>
              <Clock aria-hidden size={14} />
              <Tpl text={t("plan.effort")} vars={{ n: action.effortMinutes }} />
            </Chip>
            <Chip tone={eligTone[action.eligibility]}>{eligibilityLabel(language, action.eligibility)}</Chip>
          </div>
        </div>
        <Switch checked={checked} onChange={onToggle} labelledBy={titleId} describedBy={chipsId} />
      </div>

      <div className="px-5 pb-2">
        {action.summary ? <p className="text-[1rem] leading-snug text-muted">{action.summary}</p> : null}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={stepsId}
          onClick={() => setOpen((o) => !o)}
          className="-mx-2 mt-1 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[0.9375rem] font-semibold text-accent"
        >
          {open ? t("plan.hideSteps") : t("plan.steps")}
          <ChevronDown aria-hidden size={18} className={clsx("transition-transform duration-200 ease-calm", open && "rotate-180")} />
        </button>
      </div>
      <div id={stepsId} hidden={!open} className="px-5 pb-5">
        {action.steps.length ? (
          <ol className="space-y-2">
            {action.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-[1rem] leading-snug text-ink">
                <span aria-hidden className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accentSoft text-[0.8125rem] font-semibold text-[#0B5A4B]">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        ) : null}
        {action.needs.length ? <p className="mt-3 text-[0.9375rem] text-muted">{action.needs.join(" · ")}</p> : null}
        {action.link ? (
          <a href={normaliseLink(action.link)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-1.5 font-semibold text-accent underline underline-offset-4">
            {t("plan.findOut")}
            <ExternalLink aria-hidden size={16} />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : null}
      </div>
    </article>
  );
}

export const HELP_CONTACTS = [
  { name: "Citizens Advice Manchester", tel: "0808 278 7800" },
  { name: "StepChange", tel: "0800 138 1111" },
  { name: "MoneyHelper", tel: "0800 138 7777" },
];

/** talk_to_someone: a quiet card with three contacts. */
export function HelpCard({ summary, prominent = false }: { summary?: string; prominent?: boolean }) {
  const { t, dir } = useAppState();
  return (
    <section aria-labelledby="help-title" className={clsx("rounded-[20px] border p-5", prominent ? "border-accent/40 bg-card" : "border-line bg-canvas")} dir={dir}>
      <h3 id="help-title" className="text-[1.125rem] font-semibold text-ink">
        {t("help.title")}
      </h3>
      <p className="mt-1 text-[1rem] leading-snug text-muted">{summary ?? t("help.intro")}</p>
      {summary ? <p className="mt-1 text-[1rem] leading-snug text-muted">{t("help.intro")}</p> : null}
      <ul className="mt-3 divide-y divide-line">
        {HELP_CONTACTS.map((c) => (
          <li key={c.name}>
            <a href={`tel:${c.tel.replace(/\s/g, "")}`} className="flex min-h-12 items-center justify-between gap-3 py-2 text-ink">
              <span className="text-[1rem] font-medium">{c.name}</span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-accent tabular-nums" dir="ltr">
                <Phone aria-hidden size={16} />
                {c.tel}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
