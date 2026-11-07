// Explanation of the warning (plan section 15.2). Never throws: any failure falls back to the template.
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Explanation, Facts, Forecast, Language } from "@/lib/forecast/types";
import { buildFacts } from "@/lib/forecast/facts";
import { EXPLAIN_MAX_TOKENS, MODEL, effortConfig, getClaude, supportsForcedToolChoice, thinkingConfig, tokenBudget } from "@/lib/coach/client";
import { EXPLAIN_SYSTEM, EXPLAIN_TOOL_INSTRUCTION, EXPLAIN_USER_PREFIX, bannedRetryMessage, explainRetryMessage } from "@/lib/coach/prompts";
import { checkNumbers, findBannedWords } from "@/lib/coach/numberCheck";
import { templateExplanation } from "@/lib/coach/template";
import { logNumberCheck } from "@/lib/coach/log";

export type ExplanationSource = "claude" | "template";
export interface ExplainResult { explanation: Explanation; source: ExplanationSource; checked: boolean; }

const ExplanationSchema = z.object({
  headline: z.string().min(1).max(300),
  why: z.array(z.string().min(1).max(300)).min(1).max(6),
  whatThisMeans: z.string().min(1).max(600),
  reassurance: z.string().min(1).max(400),
  nextStep: z.string().min(1).max(400),
  language: z.string().max(10).optional(),
});

export const WRITE_EXPLANATION_TOOL: Anthropic.Tool = {
  name: "write_explanation",
  description: "Write the plain-English explanation of the forecast warning. Use only numbers and dates from the facts.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      headline: { type: "string", description: "At most 20 words. What will happen and when." },
      why: { type: "array", items: { type: "string" }, description: "2 to 4 bullets, one cause each, each with its pound amount from the facts." },
      whatThisMeans: { type: "string", description: "1 or 2 sentences on what the person would notice." },
      reassurance: { type: "string", description: "1 true, calm sentence." },
      nextStep: { type: "string", description: "1 sentence naming the best option by its title." },
      language: { type: "string", description: "en, ur or pl, matching facts.language." },
    },
    required: ["headline", "why", "whatThisMeans", "reassurance", "nextStep", "language"],
    additionalProperties: false,
  },
};

// ---------------------------------------------------------------------------
// Cache per (persona, today, lang, warning id, scenario). Claude results are kept;
// template results expire after a minute so a transient outage does not stick.
// ---------------------------------------------------------------------------

interface CacheEntry { promise: Promise<ExplainResult>; expires: number; }
const g = globalThis as typeof globalThis & { __headroomExplainCache?: Map<string, CacheEntry> };
const cache = (g.__headroomExplainCache ??= new Map());
const TEMPLATE_TTL_MS = 60_000;
const MAX_CACHE = 200;

export function explainCacheKey(forecast: Forecast, language: Language): string {
  const w = forecast.warnings[0];
  return [forecast.personaId, forecast.today, language, w?.id ?? "none", forecast.scenario ? JSON.stringify(forecast.scenario) : ""].join("|");
}

export function clearExplainCache(): void {
  cache.clear();
}

export async function explainForecast(forecast: Forecast, language: Language): Promise<Explanation> {
  return (await explainForecastDetailed(forecast, language)).explanation;
}

export async function explainForecastDetailed(forecast: Forecast, language: Language): Promise<ExplainResult> {
  const key = explainCacheKey(forecast, language);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.promise;

  const promise = (async (): Promise<ExplainResult> => {
    let facts: Facts;
    try {
      facts = buildFacts(forecast, language);
    } catch (err) {
      console.error("[explain] buildFacts failed:", err);
      return { explanation: minimalExplanation(forecast), source: "template", checked: true };
    }
    try {
      const fromClaude = await explainWithClaude(facts, forecast.personaId);
      if (fromClaude) return { explanation: fromClaude, source: "claude", checked: true };
    } catch (err) {
      console.error("[explain] Claude failed, using template:", err instanceof Error ? err.message : err);
    }
    return { explanation: templateExplanation(facts), source: "template", checked: true };
  })();

  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
  cache.set(key, { promise, expires: Number.POSITIVE_INFINITY });
  promise
    .then((res) => {
      if (res.source === "template") cache.set(key, { promise, expires: Date.now() + TEMPLATE_TTL_MS });
    })
    .catch(() => cache.delete(key));
  return promise;
}

/** Strip the checker's whitelist before sending facts to Claude (it does not need it). */
export function factsForClaude(facts: Facts): Omit<Facts, "allowedNumbers"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { allowedNumbers, ...rest } = facts;
  return rest;
}

function explanationTexts(e: Explanation): string[] {
  return [e.headline, ...e.why, e.whatThisMeans, e.reassurance, e.nextStep];
}

/** Returns a checked Explanation, or null when Claude is unavailable or failed twice. */
async function explainWithClaude(facts: Facts, profileId: string): Promise<Explanation | null> {
  const client = getClaude();
  if (!client) return null;

  const forced = supportsForcedToolChoice();
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `${EXPLAIN_USER_PREFIX}\n${JSON.stringify(factsForClaude(facts))}` },
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: tokenBudget(EXPLAIN_MAX_TOKENS),
      system: forced ? EXPLAIN_SYSTEM : `${EXPLAIN_SYSTEM}\n${EXPLAIN_TOOL_INSTRUCTION}`,
      tools: [WRITE_EXPLANATION_TOOL],
      tool_choice: forced ? { type: "tool", name: WRITE_EXPLANATION_TOOL.name } : { type: "auto", disable_parallel_tool_use: true },
      messages,
      ...effortConfig(),
      ...thinkingConfig(),
    });
    if (res.stop_reason === "refusal") return null;

    const toolUse = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === WRITE_EXPLANATION_TOOL.name);
    messages.push({ role: "assistant", content: res.content });

    if (!toolUse) {
      messages.push({ role: "user", content: "Please answer by calling write_explanation." });
      continue;
    }
    const parsed = ExplanationSchema.safeParse(toolUse.input);
    if (!parsed.success) {
      messages.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: toolUse.id, is_error: true, content: `The tool input was not valid: ${z.prettifyError(parsed.error)}. Call write_explanation again.` }],
      });
      continue;
    }
    const explanation: Explanation = {
      headline: parsed.data.headline.trim(),
      why: parsed.data.why.map((s) => s.trim()).filter(Boolean).slice(0, 4),
      whatThisMeans: parsed.data.whatThisMeans.trim(),
      reassurance: parsed.data.reassurance.trim(),
      nextStep: parsed.data.nextStep.trim(),
      language: facts.language,
    };
    const texts = explanationTexts(explanation);
    const check = checkNumbers(texts, facts.allowedNumbers);
    const banned = findBannedWords(texts);
    await logNumberCheck(profileId, "explanation", check, banned);
    if (check.ok && banned.length === 0) return explanation;

    const problems: string[] = [];
    if (!check.ok) problems.push(explainRetryMessage(check.rejected));
    if (banned.length) problems.push(bannedRetryMessage(banned));
    messages.push({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: toolUse.id, is_error: true, content: problems.join(" ") }],
    });
  }
  return null;
}

/** Last-resort text if even the facts could not be built. Uses no numbers at all. */
function minimalExplanation(forecast: Forecast): Explanation {
  return {
    headline: forecast.warnings.length ? "Money may be short for a few days soon." : "Your next few months look covered.",
    why: ["We are still working out the details of your forecast."],
    whatThisMeans: "Open the chart to see each day.",
    reassurance: "This is predictable and there are things you can do.",
    nextStep: "Look at what you can do on the Plan screen.",
    language: "en",
  };
}
