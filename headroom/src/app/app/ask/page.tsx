"use client";
// Ask: the chat coach. Answers come from POST /api/coach, which runs the forecast as a tool.
import { CoachChat } from "@/components/CoachChat";
import { useAppState } from "@/components/AppState";
import { ScreenHeader } from "@/components/ui";

export default function AskPage() {
  const { t } = useAppState();
  return (
    <>
      <ScreenHeader title={t("ask.title")} subtitle={t("ask.subtitle")} />
      <CoachChat />
    </>
  );
}
