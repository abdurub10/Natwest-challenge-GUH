// POST /api/demo/n8n { enabled } -> { enabled }: in-memory toggle that forces the built-in fallback.
// GET returns the current state.
import { connection } from "next/server";
import { z } from "zod";
import { n8nEnabled, n8nUrl, setN8nEnabled } from "@/lib/n8n";
import { json, readBody } from "@/lib/actions/http";

export async function GET() {
  await connection();
  return json({ enabled: n8nEnabled(), configured: !!n8nUrl("plan") });
}

const Body = z.object({ enabled: z.boolean() });

export async function POST(req: Request) {
  const body = await readBody(req, Body);
  if ("error" in body) return body.error;
  return json({ enabled: setN8nEnabled(body.data.enabled), configured: !!n8nUrl("plan") });
}
