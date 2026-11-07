"use client";
// Status is never colour alone: an icon (Sun, CloudSun, CloudRain) plus a word.
import clsx from "clsx";
import { CloudRain, CloudSun, Sun, type LucideIcon } from "lucide-react";
import type { Status } from "@/lib/forecast/types";
import { statusWord } from "@/lib/i18n";
import { useAppState } from "./AppState";

export const STATUS_ICON: Record<Status, LucideIcon> = { comfortable: Sun, tight: CloudSun, short: CloudRain };
export const STATUS_TEXT: Record<Status, string> = { comfortable: "text-comfortable", tight: "text-tight", short: "text-short" };

export function StatusIcon({
  status,
  showWord = true,
  size = 20,
  className,
  wordClassName,
}: {
  status: Status;
  showWord?: boolean;
  size?: number;
  className?: string;
  wordClassName?: string;
}) {
  const { language } = useAppState();
  const Icon = STATUS_ICON[status];
  const word = statusWord(language, status);
  return (
    <span className={clsx("inline-flex items-center gap-1.5", STATUS_TEXT[status], className)}>
      {showWord ? <Icon aria-hidden size={size} strokeWidth={2} className="shrink-0" /> : <Icon role="img" aria-label={word} size={size} strokeWidth={2} className="shrink-0" />}
      {showWord ? <span className={clsx("font-semibold", wordClassName)}>{word}</span> : null}
    </span>
  );
}
