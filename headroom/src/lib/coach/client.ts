// Anthropic client (plan section 15.1). Server only: reads ANTHROPIC_API_KEY.
import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
export const EXPLAIN_MAX_TOKENS = 600;
export const CHAT_MAX_TOKENS = 800;
/** Per request. Timeouts are not retried (maxRetries 0) so the demo never waits longer than this. */
export const REQUEST_TIMEOUT_MS = 12_000;

/*
 * Note on temperature: the plan asks for 0.3, but the installed SDK (1.6.0) no longer has a
 * `temperature` parameter, and Sonnet 5.5-class models reject non-default sampling values.
 * Output is kept steady by the strict tool schema, low effort and the number check instead.
 */

export function claudeConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

const g = globalThis as typeof globalThis & { __headroomAnthropic?: { key: string; client: Anthropic } };

export function getClaude(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  if (g.__headroomAnthropic?.key !== key) {
    g.__headroomAnthropic = { key, client: new Anthropic({ apiKey: key, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 }) };
  }
  return g.__headroomAnthropic.client;
}

/**
 * Some current models reject a forced tool_choice ({type:"tool"} / {type:"any"}) with a 400.
 * For those we use {type:"auto"} plus a strict tool and a system instruction, and treat a
 * missing tool call as a failed attempt.
 */
export function supportsForcedToolChoice(model = MODEL): boolean {
  return !/claude-(sonnet-5-5|opus-5-5|fable-5-1|mythos-5-1)/.test(model);
}

/** Effort is only accepted by newer model families; low effort keeps replies fast for the demo. */
export function effortConfig(model = MODEL): { output_config?: { effort: "low" } } {
  return /claude-(sonnet|opus|fable|mythos|haiku)-5|claude-opus-4-(5|6|7|8)/.test(model) ? { output_config: { effort: "low" } } : {};
}

/** Models whose thinking cannot be switched off (it shares the max_tokens budget). */
function thinkingAlwaysOn(model = MODEL): boolean {
  return /claude-(opus-5-5|opus-5\b|fable-5|mythos-5|haiku-5-5)/.test(model);
}

/**
 * Sonnet 5.5 runs adaptive thinking by default and rejects {type:"disabled"}; {type:"between_tools"}
 * is its documented way to switch thinking off, which keeps these short replies fast and inside max_tokens.
 */
export function thinkingConfig(model = MODEL): { thinking?: { type: "between_tools" } } {
  return /claude-sonnet-5-5/.test(model) ? { thinking: { type: "between_tools" } } : {};
}

/** max_tokens: the plan's budget, plus room for thinking on models where it is always on. */
export function tokenBudget(base: number, model = MODEL): number {
  return thinkingAlwaysOn(model) ? base + 2000 : base;
}

export function textOf(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
