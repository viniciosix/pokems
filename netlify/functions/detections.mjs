import crypto from "node:crypto";
import {
  authorized, cleanup, json, normalizeSpecies, preflight, readState, writeState
} from "../lib.mjs";

export default async (req) => {
  const p = preflight(req);
  if (p) return p;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!authorized(req)) return json({ error: "unauthorized" }, 401);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: "invalid_json" }, 400); }

  const items = Array.isArray(body) ? body : [body];
  const state = cleanup(await readState());
  state.spawns ||= [];
  let accepted = 0;

  for (const raw of items.slice(0, 100)) {
    const species = normalizeSpecies(raw.species);
    const lat = Number(raw.lat);
    const lon = Number(raw.lon);
    if (!species || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;

    const confidence = Math.max(0, Math.min(1, Number(raw.confidence ?? 0.5)));
    const seen = raw.seen_at || new Date().toISOString();
    const key = `${species.toLowerCase()}|${lat.toFixed(4)}|${lon.toFixed(4)}`;

    let spawn = state.spawns.find((s) =>
      s.key === key &&
      Date.now() - new Date(s.last_seen || 0).getTime() < 15 * 60_000
    );

    if (!spawn) {
      spawn = {
        id: crypto.randomUUID(),
        key,
        species,
        lat,
        lon,
        first_seen: seen,
        last_seen: seen,
        confidence,
        accuracy_m: Math.max(10, Math.min(3000, Number(raw.accuracy_m || 120))),
        source: String(raw.source || "alt-scanner").slice(0, 50),
        count: 1,
      };
      state.spawns.push(spawn);
    } else {
      spawn.last_seen = seen;
      spawn.confidence = Math.max(Number(spawn.confidence || 0), confidence);
      spawn.count = Number(spawn.count || 1) + 1;
      spawn.lat = (Number(spawn.lat) * (spawn.count - 1) + lat) / spawn.count;
      spawn.lon = (Number(spawn.lon) * (spawn.count - 1) + lon) / spawn.count;
    }
    accepted += 1;
  }

  await writeState(cleanup(state));
  return json({ ok: true, accepted, active: state.spawns.length });
};
