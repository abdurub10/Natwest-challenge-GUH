"use client";
// "You're not alone": the Undertow neighbourhood forecast for Aisha's area.
// Only the released, privacy-protected area total is shown (exported by
// undertow/scripts/export_headroom.py). Nothing here comes from Aisha's own data.
import { Users } from "lucide-react";
import type { I18nKey } from "@/lib/i18n";
import area from "@/lib/undertow/area.json";
import { useAppState } from "./AppState";
import { Tpl } from "./ui";

type Horizon = { weeks: number; suppressed: boolean; rate?: number; drivers?: { id: string; share: number }[] };

export const UNDERTOW_URL = process.env.NEXT_PUBLIC_UNDERTOW_URL || "http://localhost:8501";

export function NearbyCard() {
  const { t, dir } = useAppState();
  const h = [...(area.horizons as Horizon[])].reverse().find((x) => !x.suppressed && x.rate != null);
  if (!h || h.rate == null) return null;
  const inN = Math.max(2, Math.round(1 / h.rate));
  const driver = h.drivers?.[0]?.id;
  const place = area.place;
  return (
    <section className="mx-5 rounded-xl border border-line bg-card p-5" dir={dir}>
      <p className="flex items-center gap-2 text-[0.9375rem] font-semibold text-ink">
        <Users aria-hidden size={18} />
        {t("nearby.title")}
      </p>
      <p className="mt-2 text-[1rem] leading-snug text-ink">
        <Tpl text={t("nearby.text")} vars={{ n: String(inN), place, weeks: String(h.weeks) }} />
      </p>
      {driver ? (
        <p className="mt-1 text-[0.9375rem] text-muted">
          <Tpl text={t("nearby.driver")} vars={{ label: t(`nearby.drv.${driver}` as I18nKey) }} />
        </p>
      ) : null}
      <p className="mt-3 text-[0.8125rem] text-muted">{t("nearby.source")}</p>
    </section>
  );
}
