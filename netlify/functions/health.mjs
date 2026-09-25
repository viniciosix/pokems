import { json, preflight } from "./_lib.mjs";

export default async (req) => {
  const p = preflight(req);
  if (p) return p;
  return json({
    ok: true,
    service: "PokeMS",
    runtime: "netlify-functions",
    time: new Date().toISOString(),
  });
};
