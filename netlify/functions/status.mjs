import { authorized, json, preflight, readState, writeState } from "./_lib.mjs";

export default async (req) => {
  const p = preflight(req);
  if (p) return p;

  const state = await readState();

  if (req.method === "GET") {
    return json(state.scanner || {});
  }

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!authorized(req)) return json({ error: "unauthorized" }, 401);

  let body = {};
  try { body = await req.json(); } catch {}
  state.scanner = {
    ...(state.scanner || {}),
    ...body,
    updated_at: new Date().toISOString(),
  };
  await writeState(state);
  return json({ ok: true, scanner: state.scanner });
};
