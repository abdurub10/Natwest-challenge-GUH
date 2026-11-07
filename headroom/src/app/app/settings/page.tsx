"use client";
// Settings: language, text size, what Headroom uses, talk to a person, delete my forecast.
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Check, Database, Landmark, ShieldCheck, Trash2 } from "lucide-react";
import type { Language, TextSize } from "@/lib/forecast/types";
import { LANGUAGES } from "@/lib/i18n";
import { useAppState } from "@/components/AppState";
import { HelpCard } from "@/components/ActionCard";
import { ScreenHeader, buttonClass } from "@/components/ui";
import { demoReset } from "@/lib/client/api";

function RadioRow<T extends string>({ name, legend, options, value, onChange }: { name: string; legend: string; options: { id: T; label: string; hint?: string; lang?: string }[]; value: T; onChange: (v: T) => void }) {
  const { dir } = useAppState();
  return (
    <fieldset className="mx-5" dir={dir}>
      <legend className="mb-2 text-[1.0625rem] font-semibold text-ink">{legend}</legend>
      <div className="overflow-hidden rounded-[20px] border border-line bg-card">
        {options.map((o, k) => {
          const id = `${name}-${o.id}`;
          const checked = value === o.id;
          return (
            <label
              key={o.id}
              htmlFor={id}
              className={clsx(
                "flex min-h-14 cursor-pointer items-center gap-3 px-5 py-3 transition-colors duration-200 ease-calm has-[:focus-visible]:bg-accentSoft/60",
                k > 0 && "border-t border-line",
                checked && "bg-accentSoft/40",
              )}
            >
              <input id={id} type="radio" name={name} value={o.id} checked={checked} onChange={() => onChange(o.id)} className="peer sr-only" />
              <span
                aria-hidden
                className={clsx("flex size-6 shrink-0 items-center justify-center rounded-full border-2", checked ? "border-accent bg-accent text-white" : "border-[#9AA19D] bg-card")}
              >
                {checked ? <Check size={14} strokeWidth={3} /> : null}
              </span>
              <span className="flex-1 text-[1.0625rem] text-ink" lang={o.lang}>
                {o.label}
              </span>
              {o.hint ? <span className="text-[0.9375rem] text-muted">{o.hint}</span> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function SettingsPage() {
  const { t, dir, language, textSize, setLanguage, setTextSize, resetAll } = useAppState();
  const [confirming, setConfirming] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  // Reset transient confirm / status when the screen is hidden and shown again.
  useEffect(
    () => () => {
      setConfirming(false);
      setState("idle");
    },
    [],
  );

  async function onDelete() {
    setState("busy");
    try {
      await demoReset();
      resetAll();
      setConfirming(false);
      setState("done");
    } catch {
      setState("error");
    }
  }

  const uses = [
    { icon: Database, text: t("settings.uses1") },
    { icon: Landmark, text: t("settings.uses2") },
    { icon: ShieldCheck, text: t("settings.uses3") },
  ];

  return (
    <>
      <ScreenHeader title={t("settings.title")} />
      <div className="space-y-7 pt-3">
        <RadioRow<Language>
          name="language"
          legend={t("settings.language")}
          value={language}
          onChange={setLanguage}
          options={LANGUAGES.map((l) => ({ id: l.id, label: l.native, hint: l.native !== l.label ? l.label : undefined, lang: l.id }))}
        />
        <RadioRow<TextSize>
          name="text-size"
          legend={t("settings.textSize")}
          value={textSize}
          onChange={setTextSize}
          options={[
            { id: "normal", label: t("settings.normal") },
            { id: "large", label: t("settings.large") },
          ]}
        />

        <section aria-labelledby="uses-title" className="mx-5" dir={dir}>
          <h2 id="uses-title" className="mb-2 text-[1.0625rem] font-semibold text-ink">
            {t("settings.uses")}
          </h2>
          <ul className="divide-y divide-line rounded-[20px] border border-line bg-card">
            {uses.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3 px-5 py-3.5">
                <Icon aria-hidden size={20} className="mt-0.5 shrink-0 text-accent" />
                <p className="text-[1rem] leading-snug text-ink">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="person-title" className="mx-5">
          <h2 id="person-title" className="mb-2 text-[1.0625rem] font-semibold text-ink" dir={dir}>
            {t("settings.person")}
          </h2>
          <HelpCard />
        </section>

        <section aria-labelledby="delete-title" className="mx-5" dir={dir}>
          <h2 id="delete-title" className="sr-only">
            {t("settings.delete")}
          </h2>
          {state === "done" ? (
            <p role="status" className="rounded-[20px] border border-line bg-card p-5 text-[1rem] text-ink">
              {t("settings.deleted")}
            </p>
          ) : confirming ? (
            <div className="rounded-[20px] border border-short/30 bg-card p-5">
              <p className="text-[1rem] leading-snug text-ink">{t("settings.deleteBody")}</p>
              {state === "error" ? (
                <p role="alert" className="mt-2 text-[0.9375rem] text-short">
                  {t("settings.deleteError")}
                </p>
              ) : null}
              <div className="mt-4 flex gap-2.5">
                <button type="button" onClick={() => setConfirming(false)} className={clsx(buttonClass.secondary, "flex-1")}>
                  {t("settings.cancel")}
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={state === "busy"}
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-short px-5 text-[1.0625rem] font-semibold text-white disabled:opacity-60"
                >
                  {t("settings.deleteConfirm")}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setConfirming(true);
                setState("idle");
              }}
              className="flex min-h-14 w-full items-center gap-3 rounded-[20px] border border-line bg-card px-5 text-left text-[1.0625rem] font-semibold text-short"
            >
              <Trash2 aria-hidden size={20} />
              {t("settings.delete")}
            </button>
          )}
        </section>
      </div>
    </>
  );
}
