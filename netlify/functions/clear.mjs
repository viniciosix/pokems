import { authorized, json, preflight, readState, writeState } from "../lib.mjs";

export default async (req) => {
  const p = preflight(req);
  if (p) return p;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!authorized(req)) return json({ error: "unauthorized" }, 401);

  const state = await readState();
  state.spawns = [];
  await writeState(state);
  return json({ ok: true });
};
