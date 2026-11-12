export const UA = "FootballDataBuilder/0.1 (data build script)";
const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function api(lang, params, host) {
  const base = host || `https://${lang}.wikipedia.org/w/api.php`;
  const clean = {}; for (const [k, v] of Object.entries(params)) if (v !== undefined) clean[k] = v;
  const body = new URLSearchParams({ format: "json", formatversion: "2", ...clean });
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(base, { method: "POST", headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" }, body });
      if (r.status === 429 || r.status >= 500) { await sleep(2000 * (i + 1)); continue; }
      const j = await r.json();
      await sleep(150);
      return j;
    } catch (e) { await sleep(2000 * (i + 1)); }
  }
  throw new Error("api failed " + JSON.stringify(params).slice(0, 200));
}
