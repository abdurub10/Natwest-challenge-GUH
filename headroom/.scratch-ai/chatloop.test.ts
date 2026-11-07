import { describe, expect, it, vi, beforeEach } from "vitest";
import { runCoach } from "@/lib/coach/chat";

const calls: any[] = [];
let script: any[] = [];
const fake = { messages: { create: async (req: any) => { calls.push(JSON.parse(JSON.stringify(req))); const r = script.shift(); if (!r) throw new Error("no script"); return r; } } };
const msg = (stop: string, content: any[]) => ({ id: "m", type: "message", role: "assistant", model: "x", stop_reason: stop, content });
beforeEach(() => { process.env.ANTHROPIC_API_KEY = "k"; (globalThis as any).__headroomAnthropic = { key: "k", client: fake }; calls.length = 0; });

describe("claude loop", () => {
  it("runs a simulate round then answers", async () => {
    script = [
      msg("tool_use", [{ type: "text", text: "Let me check.", citations: null }, { type: "tool_use", id: "t1", name: "simulate_scenario", input: { income: { hoursPerWeek: 16, fromDate: "2027-01-01" } } }]),
      msg("end_turn", [{ type: "text", text: "Your lowest point would go down a lot. One thing that helps: Apply for free school meals.", citations: null }]),
    ];
    const r = await runCoach({ personaId: "aisha", language: "en", messages: [{ role: "assistant", content: "Hi" }, { role: "user", content: "hours 16 in jan?" }] });
    console.log(r.reply, r.toolCalls, r.checked);
    expect(r.checked).toBe(true);
    expect(r.toolCalls).toEqual(["simulate_scenario"]);
    expect(calls[0].messages[0].role).toBe("user");
    const tr = calls[1].messages.at(-1).content[0];
    expect(tr.type).toBe("tool_result");
    console.log(JSON.parse(tr.content).delta); expect(typeof JSON.parse(tr.content).delta.change).toBe("number");
    expect(calls[0].system[0].cache_control).toBeTruthy();
  });
  it("replaces a reply with an invented number", async () => {
    script = [msg("end_turn", [{ type: "text", text: "You will be short by £999.", citations: null }])];
    const r = await runCoach({ personaId: "aisha", language: "en", messages: [{ role: "user", content: "how bad?" }] });
    console.log(r.reply);
    expect(r.reply.startsWith("I can only quote the numbers in your forecast. Here is what it shows:")).toBe(true);
    expect(r.checked).toBe(true);
  });
  it("rewrites banned words", async () => {
    script = [
      msg("end_turn", [{ type: "text", text: "You could use your overdraft.", citations: null }]),
      msg("end_turn", [{ type: "text", text: "You could apply for free school meals.", citations: null }]),
    ];
    const r = await runCoach({ personaId: "aisha", language: "en", messages: [{ role: "user", content: "help" }] });
    expect(r.reply).toBe("You could apply for free school meals.");
    expect(calls[1].tool_choice).toEqual({ type: "none" });
  });
  it("stops after 4 tool rounds with tool_choice none", async () => {
    const tu = (i: number) => msg("tool_use", [{ type: "tool_use", id: "t" + i, name: "get_forecast", input: {} }]);
    script = [tu(1), tu(2), tu(3), tu(4), msg("end_turn", [{ type: "text", text: "Your lowest point is in late January.", citations: null }])];
    const r = await runCoach({ personaId: "aisha", language: "en", messages: [{ role: "user", content: "?" }] });
    expect(calls.length).toBe(5);
    expect(calls[4].tool_choice).toEqual({ type: "none" });
    expect(r.checked).toBe(true);
  });
  it("falls back when Claude throws", async () => {
    script = [];
    const r = await runCoach({ personaId: "aisha", language: "en", messages: [{ role: "user", content: "Why is my Universal Credit lower in January?" }] });
    console.log("FALLBACK:", r.reply);
    expect(r.reply).toMatch(/Universal Credit/);
  });
  it("invalid scenario input returns is_error", async () => {
    script = [
      msg("tool_use", [{ type: "tool_use", id: "t1", name: "simulate_scenario", input: { income: { hoursPerWeek: 16 } } }]),
      msg("end_turn", [{ type: "text", text: "Sorry.", citations: null }]),
    ];
    await runCoach({ personaId: "aisha", language: "en", messages: [{ role: "user", content: "?" }] });
    expect(calls[1].messages.at(-1).content[0].is_error).toBe(true);
  });
});
