import { getStore } from "@netlify/blobs";

const DEFAULT_TTL = 25;

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization,content-type,x-radarms-token",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    },
  });
}

export function preflight(req) {
  if (req.method === "OPTIONS") return json({ ok: true });
  return null;
}

export function authorized(req) {
  const expected = process.env.RADARMS_TOKEN;
  if (!expected) return false;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const custom = req.headers.get("x-radarms-token");
  return bearer === expected || custom === expected;
}

export function store() {
  return getStore({ name: "pokems-state", consistency: "strong" });
}

export async function readState() {
  const s = store();
  const state = await s.get("state", { type: "json", consistency: "strong" });
  return state || { spawns: [], scanner: {}, updated_at: null };
}

export async function writeState(state) {
  state.updated_at = new Date().toISOString();
  await store().setJSON("state", state);
  return state;
}

export function cleanup(state) {
  const ttl = Math.max(5, Number(process.env.SPAWN_TTL_MINUTES || DEFAULT_TTL));
  const cutoff = Date.now() - ttl * 60_000;
  state.spawns = (state.spawns || []).filter((s) => {
    const t = new Date(s.last_seen || s.first_seen || 0).getTime();
    return Number.isFinite(t) && t >= cutoff;
  });
  return state;
}

export function normalizeSpecies(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 80);
}
