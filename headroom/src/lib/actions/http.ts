// Small helpers for the API routes this track owns: JSON errors and zod-validated bodies.
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const PersonaSchema = z
  .string()
  .regex(/^[a-z0-9_-]{1,32}$/, "persona must be a short lowercase id")
  .default("aisha");
export const LanguageSchema = z.enum(["en", "ur", "pl"]).default("en");

export function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export function json<T>(data: T, init: ResponseInit = {}): Response {
  return Response.json(data, { ...init, headers: { "Cache-Control": "no-store", ...(init.headers ?? {}) } });
}

/** Parse and validate a JSON body. Returns the data, or a 400 Response. An empty body counts as {}. */
export async function readBody<S extends z.ZodType>(req: Request, schema: S): Promise<{ data: z.infer<S> } | { error: Response }> {
  let raw: unknown = {};
  try {
    const text = await req.text();
    if (text.trim()) raw = JSON.parse(text);
  } catch {
    return { error: jsonError(400, "Body must be valid JSON") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: jsonError(400, describeZodError(parsed.error)) };
  return { data: parsed.data };
}

/** "lang: Invalid option: expected one of ..." for the first problem; enough for a 400. */
export function describeZodError(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "Invalid request";
  const where = issue.path.length ? `${issue.path.join(".")}: ` : "";
  return `${where}${issue.message}`;
}

/** Constant-time string comparison for shared secrets. */
export function secretsMatch(given: string | null, expected: string | undefined): boolean {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Engine errors for unknown personas become 404s; anything else is a 500 with a calm message. */
export function engineError(err: unknown, persona: string): Response {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[api] engine failed for ${persona}:`, msg);
  if (/unknown persona|not found|no persona/i.test(msg)) return jsonError(404, `Unknown persona: ${persona}`);
  return jsonError(500, "We couldn't load your forecast. Try again in a moment.");
}
