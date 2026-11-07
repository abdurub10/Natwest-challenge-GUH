// Server-only persistence for profiles, plans and activity (plan section 10).
// Two implementations behind one interface:
//   - Supabase (service role key, server only) when STORE_MODE=supabase and keys are set
//   - an in-memory Map store otherwise (also used as a safety net if Supabase errors)
// Never import this from a client component.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Activity, ActivityKind, ActivitySource, Language, Plan, Profile, TextSize } from "@/lib/forecast/types";
import { PERSONA_ID } from "@/lib/config";

export interface Store {
  getProfile(id: string): Promise<Profile>;
  updateProfile(id: string, patch: Partial<Profile>): Promise<Profile>;
  createPlan(p: Omit<Plan, "id" | "createdAt">): Promise<Plan>;
  listPlans(profileId: string): Promise<Plan[]>;
  addActivity(a: Omit<Activity, "id" | "createdAt">): Promise<Activity>;
  listActivity(profileId: string, limit?: number): Promise<Activity[]>;
  reset(profileId: string): Promise<void>;
}

export type StoreMode = "supabase" | "memory";

const DEFAULT_ACTIVITY_LIMIT = 20;

function defaultProfile(id: string): Profile {
  const displayName = id === PERSONA_ID ? "Aisha" : id.charAt(0).toUpperCase() + id.slice(1);
  return {
    id,
    displayName,
    language: "en",
    textSize: "normal",
    whatsappTo: null,
    createdAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Memory store. State lives on globalThis so it survives Next.js dev module reloads.
// ---------------------------------------------------------------------------

interface MemoryState {
  profiles: Map<string, Profile>;
  plans: Map<string, Plan[]>; // newest last
  activity: Map<string, Activity[]>; // newest last
}

const g = globalThis as typeof globalThis & {
  __headroomMemoryState?: MemoryState;
  __headroomStore?: { mode: StoreMode; store: Store };
};

function memoryState(): MemoryState {
  if (!g.__headroomMemoryState) {
    g.__headroomMemoryState = {
      profiles: new Map([[PERSONA_ID, defaultProfile(PERSONA_ID)]]),
      plans: new Map(),
      activity: new Map(),
    };
  }
  return g.__headroomMemoryState;
}

/** Monotonic ISO timestamps so two writes in the same millisecond still sort correctly. */
let lastTs = 0;
function nowISO(): string {
  const t = Math.max(Date.now(), lastTs + 1);
  lastTs = t;
  return new Date(t).toISOString();
}

export function createMemoryStore(): Store {
  const s = memoryState();
  const ensureProfile = (id: string): Profile => {
    let p = s.profiles.get(id);
    if (!p) {
      p = defaultProfile(id);
      s.profiles.set(id, p);
    }
    return p;
  };
  return {
    async getProfile(id) {
      return { ...ensureProfile(id) };
    },
    async updateProfile(id, patch) {
      const current = ensureProfile(id);
      const next: Profile = { ...current, ...stripUndefined(patch), id: current.id, createdAt: current.createdAt };
      s.profiles.set(id, next);
      return { ...next };
    },
    async createPlan(p) {
      ensureProfile(p.profileId);
      const plan: Plan = { ...p, actionIds: [...p.actionIds], id: crypto.randomUUID(), createdAt: nowISO() };
      const list = s.plans.get(p.profileId) ?? [];
      list.push(plan);
      s.plans.set(p.profileId, list);
      return { ...plan };
    },
    async listPlans(profileId) {
      return [...(s.plans.get(profileId) ?? [])].reverse().map((p) => ({ ...p }));
    },
    async addActivity(a) {
      ensureProfile(a.profileId);
      const act: Activity = { ...a, detail: a.detail ?? null, id: crypto.randomUUID(), createdAt: nowISO() };
      const list = s.activity.get(a.profileId) ?? [];
      list.push(act);
      // Keep memory bounded during a long demo day.
      if (list.length > 500) list.splice(0, list.length - 500);
      s.activity.set(a.profileId, list);
      return { ...act };
    },
    async listActivity(profileId, limit = DEFAULT_ACTIVITY_LIMIT) {
      const list = s.activity.get(profileId) ?? [];
      return list.slice(-limit).reverse().map((a) => ({ ...a }));
    },
    async reset(profileId) {
      s.plans.delete(profileId);
      s.activity.delete(profileId);
      const current = ensureProfile(profileId);
      s.profiles.set(profileId, { ...defaultProfile(profileId), createdAt: current.createdAt, whatsappTo: current.whatsappTo ?? null });
    },
  };
}

// ---------------------------------------------------------------------------
// Supabase store (snake_case rows <-> camelCase types).
// ---------------------------------------------------------------------------

interface ProfileRow { id: string; display_name: string; language: string; text_size: string; whatsapp_to: string | null; created_at: string; }
interface PlanRow { id: string; profile_id: string; action_ids: string[]; lowest_before: number | string; lowest_after: number | string; lowest_date: string; created_at: string; }
interface ActivityRow { id: string; profile_id: string; kind: string; title: string; detail: string | null; source: string; created_at: string; }

const LANGS: Language[] = ["en", "ur", "pl"];
const SIZES: TextSize[] = ["normal", "large"];

function rowToProfile(r: ProfileRow): Profile {
  return {
    id: r.id,
    displayName: r.display_name,
    language: (LANGS as string[]).includes(r.language) ? (r.language as Language) : "en",
    textSize: (SIZES as string[]).includes(r.text_size) ? (r.text_size as TextSize) : "normal",
    whatsappTo: r.whatsapp_to,
    createdAt: r.created_at,
  };
}
function rowToPlan(r: PlanRow): Plan {
  return {
    id: r.id,
    profileId: r.profile_id,
    actionIds: r.action_ids ?? [],
    lowestBefore: Number(r.lowest_before),
    lowestAfter: Number(r.lowest_after),
    lowestDate: String(r.lowest_date).slice(0, 10),
    createdAt: r.created_at,
  };
}
function rowToActivity(r: ActivityRow): Activity {
  return {
    id: r.id,
    profileId: r.profile_id,
    kind: r.kind as ActivityKind,
    title: r.title,
    detail: r.detail,
    source: r.source as ActivitySource,
    createdAt: r.created_at,
  };
}

function fail(op: string, error: { message: string } | null): never {
  throw new Error(`Supabase ${op} failed: ${error?.message ?? "no data"}`);
}

export function createSupabaseStore(url: string, serviceKey: string): Store {
  const db: SupabaseClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  async function ensureProfile(id: string): Promise<Profile> {
    const { data, error } = await db.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error) fail("getProfile", error);
    if (data) return rowToProfile(data as ProfileRow);
    const d = defaultProfile(id);
    const ins = await db
      .from("profiles")
      .upsert({ id, display_name: d.displayName, language: d.language, text_size: d.textSize }, { onConflict: "id" })
      .select("*")
      .single();
    if (ins.error || !ins.data) fail("createProfile", ins.error);
    return rowToProfile(ins.data as ProfileRow);
  }

  return {
    getProfile: ensureProfile,
    async updateProfile(id, patch) {
      await ensureProfile(id);
      const row: Partial<ProfileRow> = {};
      if (patch.displayName !== undefined) row.display_name = patch.displayName;
      if (patch.language !== undefined) row.language = patch.language;
      if (patch.textSize !== undefined) row.text_size = patch.textSize;
      if (patch.whatsappTo !== undefined) row.whatsapp_to = patch.whatsappTo;
      if (Object.keys(row).length === 0) return ensureProfile(id);
      const { data, error } = await db.from("profiles").update(row).eq("id", id).select("*").single();
      if (error || !data) fail("updateProfile", error);
      return rowToProfile(data as ProfileRow);
    },
    async createPlan(p) {
      await ensureProfile(p.profileId);
      const { data, error } = await db
        .from("plans")
        .insert({
          profile_id: p.profileId,
          action_ids: p.actionIds,
          lowest_before: p.lowestBefore,
          lowest_after: p.lowestAfter,
          lowest_date: p.lowestDate,
        })
        .select("*")
        .single();
      if (error || !data) fail("createPlan", error);
      return rowToPlan(data as PlanRow);
    },
    async listPlans(profileId) {
      const { data, error } = await db
        .from("plans")
        .select("*")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false });
      if (error) fail("listPlans", error);
      return ((data ?? []) as PlanRow[]).map(rowToPlan);
    },
    async addActivity(a) {
      await ensureProfile(a.profileId);
      const { data, error } = await db
        .from("activity")
        .insert({ profile_id: a.profileId, kind: a.kind, title: a.title, detail: a.detail ?? null, source: a.source })
        .select("*")
        .single();
      if (error || !data) fail("addActivity", error);
      return rowToActivity(data as ActivityRow);
    },
    async listActivity(profileId, limit = DEFAULT_ACTIVITY_LIMIT) {
      const { data, error } = await db
        .from("activity")
        .select("*")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) fail("listActivity", error);
      return ((data ?? []) as ActivityRow[]).map(rowToActivity);
    },
    async reset(profileId) {
      const a = await db.from("activity").delete().eq("profile_id", profileId);
      if (a.error) fail("reset activity", a.error);
      const p = await db.from("plans").delete().eq("profile_id", profileId);
      if (p.error) fail("reset plans", p.error);
      await ensureProfile(profileId);
      const u = await db.from("profiles").update({ language: "en", text_size: "normal" }).eq("id", profileId);
      if (u.error) fail("reset profile", u.error);
    },
  };
}

/**
 * Wraps the Supabase store so a database outage never breaks the demo: every failed call
 * is logged and served from the memory store instead.
 */
function withMemoryFallback(primary: Store, backup: Store): Store {
  const wrap =
    <K extends keyof Store>(key: K) =>
    async (...args: Parameters<Store[K]>): Promise<Awaited<ReturnType<Store[K]>>> => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await (primary[key] as any)(...args);
      } catch (err) {
        console.error(`[store] ${String(key)} failed, using memory store:`, err instanceof Error ? err.message : err);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (backup[key] as any)(...args);
      }
    };
  return {
    getProfile: wrap("getProfile"),
    updateProfile: wrap("updateProfile"),
    createPlan: wrap("createPlan"),
    listPlans: wrap("listPlans"),
    addActivity: wrap("addActivity"),
    listActivity: wrap("listActivity"),
    reset: wrap("reset"),
  };
}

/** "supabase" only when STORE_MODE=supabase AND both keys are set. */
export function storeMode(): StoreMode {
  const wantSupabase = (process.env.STORE_MODE ?? "").trim().toLowerCase() === "supabase";
  return wantSupabase && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "memory";
}

export function getStore(): Store {
  const mode = storeMode();
  if (g.__headroomStore && g.__headroomStore.mode === mode) return g.__headroomStore.store;
  const store =
    mode === "supabase"
      ? withMemoryFallback(
          createSupabaseStore(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string),
          createMemoryStore(),
        )
      : createMemoryStore();
  g.__headroomStore = { mode, store };
  return store;
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  return out;
}
