import { cleanup, json, preflight, readState } from "../lib.mjs";

export default async (req) => {
  const p = preflight(req);
  if (p) return p;
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const state = cleanup(await readState());
  return json(state.spawns || []);
};
