// Logging of number-check results: counters for /api/health and activity rows for /behind.
import { getStore } from "@/lib/store";
import { recordNumberCheck } from "@/lib/coach/counters";
import type { NumberCheckResult } from "@/lib/coach/numberCheck";

/** Count the check, and log a rejection to activity as kind "error", source "app". Never throws. */
export async function logNumberCheck(
  profileId: string,
  where: "explanation" | "coach",
  result: NumberCheckResult,
  bannedWords: string[] = [],
): Promise<void> {
  recordNumberCheck(result.checked, result.rejected.length);
  if (result.ok && bannedWords.length === 0) return;
  const problems: string[] = [];
  if (result.rejected.length) problems.push(`not in the forecast: ${result.rejected.join(", ")}`);
  if (bannedWords.length) problems.push(`banned words: ${bannedWords.join(", ")}`);
  try {
    await getStore().addActivity({
      profileId,
      kind: "error",
      title: result.rejected.length ? "Number check rejected a reply" : "Word filter rewrote a reply",
      detail: `${where === "explanation" ? "Explanation" : "Coach reply"} ${problems.join("; ")}`.slice(0, 300),
      source: "app",
    });
  } catch (err) {
    console.error("[numberCheck] could not log rejection:", err);
  }
}
