import { api } from "./api.mjs";
import fs from "fs";
import crypto from "crypto";
fs.mkdirSync("cache", { recursive: true });
export async function capi(lang, params, host) {
  const key = crypto.createHash("md5").update(lang + JSON.stringify(params) + (host || "")).digest("hex");
  const f = `cache/${key}.json`;
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  const j = await api(lang, params, host);
  if (!j.error || j.error.code === "missingtitle") fs.writeFileSync(f, JSON.stringify(j));
  return j;
}
export async function sections(lang, page) {
  const j = await capi(lang, { action: "parse", page, prop: "sections", redirects: "1" });
  if (j.error) return null;
  return { title: j.parse.title, sections: j.parse.sections };
}
export async function sectionHtml(lang, page, index) {
  const p = { action: "parse", page, prop: "text", redirects: "1", disablelimitreport: "1", disableeditsection: "1" };
  if (index !== undefined && index !== null) p.section = String(index);
  const j = await capi(lang, p);
  if (j.error) return null;
  return j.parse.text;
}
const dec = s => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&#160;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
// returns [{title, text}] for internal article links
export function links(html) {
  const out = [];
  const re = /<a\s+href="\/wiki\/([^"#]+)(?:#[^"]*)?"[^>]*?title="([^"]+)"[^>]*>(.*?)<\/a>/gs;
  let m;
  while ((m = re.exec(html))) {
    const title = dec(m[2]);
    if (/^(Ficheiro|File|Predefinição|Template|Categoria|Category|Wikipédia|Wikipedia|Ajuda|Help|Especial|Special|Portal):/.test(title)) continue;
    const text = dec(m[3].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    out.push({ title, text, pos: m.index });
  }
  return out;
}
export async function wikidata(lang, titles) {
  // returns map title -> entity (claims simplified)
  const res = {};
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const j = await capi("wd", { action: "wbgetentities", sites: lang + "wiki", titles: batch.join("|"), props: "claims|labels|sitelinks", languages: "pt|en|es", sitefilter: "ptwiki|enwiki" }, "https://www.wikidata.org/w/api.php");
    for (const k of Object.keys(j)) if (j[k] === undefined) delete j[k];
    for (const [qid, e] of Object.entries(j.entities || {})) {
      if (!e.claims) continue;
      const sl = e.sitelinks?.[lang + "wiki"]?.title;
      if (!sl) continue;
      const cl = p => (e.claims[p] || []).map(c => c.mainsnak?.datavalue?.value).filter(Boolean);
      res[sl] = {
        qid,
        p31: cl("P31").map(v => v.id),
        tm: cl("P7223")[0] || null,
        country: cl("P17")[0]?.id || null,
        hq: cl("P159")[0]?.id || null,
        loc: cl("P131")[0]?.id || null,
        inception: cl("P571")[0]?.time || null,
        labelPt: e.labels?.pt?.value, labelEn: e.labels?.en?.value,
        ptTitle: e.sitelinks?.ptwiki?.title, enTitle: e.sitelinks?.enwiki?.title,
        short: cl("P1813").map(v => v.text),
        nick: cl("P1449").map(v => v.text),
      };
    }
  }
  return res;
}
// resolve redirects: titles -> canonical titles
export async function resolve(lang, titles) {
  const map = {};
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const j = await capi(lang, { action: "query", titles: batch.join("|"), redirects: "1" });
    const norm = {}; for (const n of j.query.normalized || []) norm[n.from] = n.to;
    const red = {}; for (const r of j.query.redirects || []) red[r.from] = r.to;
    for (const t of batch) { let x = norm[t] || t; x = red[x] || x; map[t] = x; }
  }
  return map;
}
export const CLUB_P31 = new Set(["Q476028", "Q847017", "Q15944511", "Q103229495", "Q28140340", "Q17270000", "Q18558301", "Q12973014"]);
export function isClub(e) { return e && (e.tm || e.p31.some(x => CLUB_P31.has(x))); }
