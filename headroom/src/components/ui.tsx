"use client";
// Small shared building blocks for the customer app.
import { Fragment, type HTMLAttributes, type ReactNode } from "react";
import clsx from "clsx";
import { AlertCircle, RotateCw } from "lucide-react";
import { formatMoney, formatMoneyBand } from "@/lib/format";
import { splitTemplate } from "@/lib/i18n";
import { useAppState } from "./AppState";

/** A money figure: tabular numerals, isolated from surrounding RTL text. */
export function Money({ value, about, sign, band, className }: { value: number; about?: boolean; sign?: boolean; band?: [number, number]; className?: string }) {
  const text = band ? formatMoneyBand(value, band[0], band[1], { sign }) : formatMoney(value, { about, sign });
  return (
    <bdi className={clsx("money whitespace-nowrap tabular-nums", className)} dir="ltr">
      {text}
    </bdi>
  );
}

/** Render a translated template with rich values in its {placeholders}. */
export function Tpl({ text, vars }: { text: string; vars: Record<string, ReactNode> }) {
  return (
    <>
      {splitTemplate(text).map((part, i) => (
        <Fragment key={i}>{part.name !== undefined ? (vars[part.name] ?? `{${part.name}}`) : part.text}</Fragment>
      ))}
    </>
  );
}

/** A date like "Thu 31 Dec", kept left-to-right inside RTL text. */
export function Day({ children, iso }: { children: ReactNode; iso?: string }) {
  return (
    <time dateTime={iso} dir="ltr" className="whitespace-nowrap">
      {children}
    </time>
  );
}

export function Card({ children, className, as: As = "section", ...rest }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" | "li" } & Omit<HTMLAttributes<HTMLElement>, "children" | "className">) {
  return (
    <As className={clsx("rounded-[20px] border border-line bg-card p-5", className)} {...rest}>
      {children}
    </As>
  );
}

export const buttonClass = {
  primary:
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-[1.0625rem] font-semibold text-white transition-[background-color,transform] duration-200 ease-calm hover:bg-[#0B5A4B] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#7FA89F]",
  secondary:
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-accent/35 bg-card px-5 text-[1.0625rem] font-semibold text-accent transition-colors duration-200 ease-calm hover:bg-accentSoft active:scale-[0.98]",
  quiet:
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-3 text-[0.9375rem] font-semibold text-accent underline-offset-4 hover:underline",
};

/** Screen header: small eyebrow, serif title, optional subtitle. */
export function ScreenHeader({ eyebrow, title, subtitle, children }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; children?: ReactNode }) {
  const { dir } = useAppState();
  return (
    <header className="px-5 pb-2 pt-7" dir={dir}>
      {eyebrow ? <p className="mb-1 text-[0.9375rem] font-medium text-muted">{eyebrow}</p> : null}
      <h1 className="font-serif text-[1.875rem] font-semibold leading-[1.15] tracking-[-0.01em] text-ink">{title}</h1>
      {subtitle ? <div className="mt-2 text-[1.0625rem] leading-snug text-muted">{subtitle}</div> : null}
      {children}
    </header>
  );
}

export function SectionTitle({ children, id, className }: { children: ReactNode; id?: string; className?: string }) {
  const { dir } = useAppState();
  return (
    <h2 id={id} dir={dir} className={clsx("text-[1.0625rem] font-semibold text-ink", className)}>
      {children}
    </h2>
  );
}

export function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  const { t, dir } = useAppState();
  return (
    <div role="alert" className="mx-5 mt-6 rounded-[20px] border border-line bg-card p-6 text-center" dir={dir}>
      <AlertCircle aria-hidden className="mx-auto mb-3 size-7 text-muted" />
      <p className="text-[1.0625rem] leading-snug text-ink">{message ?? t("error.load")}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className={clsx(buttonClass.secondary, "mt-5")}>
          <RotateCw aria-hidden className="size-4" />
          {t("error.retry")}
        </button>
      ) : null}
    </div>
  );
}

/** Calm skeleton shown while the forecast loads. */
export function LoadingState({ rows = 3, chart = true }: { rows?: number; chart?: boolean }) {
  const { t } = useAppState();
  return (
    <div className="px-5 pt-4" aria-busy="true">
      <p className="sr-only" role="status">
        {t("loading")}
      </p>
      <div aria-hidden className="animate-pulse space-y-4">
        <div className="h-4 w-24 rounded-full bg-line" />
        <div className="h-10 w-56 rounded-xl bg-line" />
        {chart ? <div className="h-48 rounded-[20px] bg-line/70" /> : null}
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-20 rounded-[20px] bg-line/60" />
        ))}
      </div>
    </div>
  );
}

/** A pill-shaped label. */
export function Chip({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "accent" | "comfortable" | "tight" | "short"; className?: string }) {
  const tones = {
    neutral: "bg-canvas text-ink border-line",
    accent: "bg-accentSoft text-[#0B5A4B] border-transparent",
    comfortable: "bg-comfortable/10 text-comfortable border-transparent",
    tight: "bg-tight/10 text-tight border-transparent",
    short: "bg-short/10 text-short border-transparent",
  } as const;
  return <span className={clsx("inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-[0.875rem] font-semibold", tones[tone], className)}>{children}</span>;
}
