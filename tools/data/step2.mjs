import { capi } from "./lib.mjs";
import fs from "fs";
const d = JSON.parse(fs.readFileSync("step1.json", "utf8"));
const all = new Map();
for (const [k, v] of Object.entries(d)) { if (!v) continue; for (const c of v.clubs) { if (!all.has(c.qid)) all.set(c.qid, { ...c, in: [], texts: {} }); const o = all.get(c.qid); o.in.push(k); for (const [t, n] of Object.entries(c.texts)) o.texts[t] = (o.texts[t] || 0) + n; } }
const clubs = [...all.values()];
const WD = "https://www.wikidata.org/w/api.php";
async function ents(ids) {
  const res = {};
  ids = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < ids.length; i += 50) {
    const j = await capi("wd", { action: "wbgetentities", ids: ids.slice(i, i + 50).join("|"), props: "claims|labels", languages: "pt|en" }, WD);
    for (const [q, e] of Object.entries(j.entities || {})) {
      const cl = p => (e.claims?.[p] || []).map(c => c.mainsnak?.datavalue?.value).filter(Boolean);
      res[q] = { label: e.labels?.pt?.value || e.labels?.en?.value, p131: cl("P131").map(v => v.id), p17: cl("P17").map(v => v.id), iso: cl("P297")[0] || null, p31: cl("P31").map(v => v.id) };
    }
  }
  return res;
}
// countries
const countries = await ents(clubs.map(c => c.country));
const UFN = { "Acre": "AC", "Alagoas": "AL", "Amapá": "AP", "Amazonas": "AM", "Bahia": "BA", "Ceará": "CE", "Distrito Federal": "DF", "Espírito Santo": "ES", "Goiás": "GO", "Maranhão": "MA", "Mato Grosso": "MT", "Mato Grosso do Sul": "MS", "Minas Gerais": "MG", "Pará": "PA", "Paraíba": "PB", "Paraná": "PR", "Pernambuco": "PE", "Piauí": "PI", "Rio de Janeiro": "RJ", "Rio Grande do Norte": "RN", "Rio Grande do Sul": "RS", "Rondônia": "RO", "Roraima": "RR", "Santa Catarina": "SC", "São Paulo": "SP", "Sergipe": "SE", "Tocantins": "TO" };
// UF chain
const br = clubs.filter(c => c.country === "Q155" || c.in.some(k => k.startsWith("ST_") || k.startsWith("BR")));
let frontier = {}; for (const c of br) frontier[c.qid] = [c.hq, c.loc].filter(Boolean);
const ufOf = {};
for (let lvl = 0; lvl < 4; lvl++) {
  const ids = Object.values(frontier).flat();
  if (!ids.length) break;
  const es = await ents(ids);
  const next = {};
  for (const [q, list] of Object.entries(frontier)) {
    if (ufOf[q]) continue;
    for (const id of list) { const e = es[id]; if (!e) continue; const isState = e.p31.includes("Q485258") || e.p31.includes("Q5119") && false; if (UFN[e.label] && (e.p31.includes("Q485258") || lvl > 0 || !e.p31.includes("Q3184121"))) { if (e.p31.includes("Q485258") || e.label === "Distrito Federal") { ufOf[q] = UFN[e.label]; break; } } }
    if (!ufOf[q]) next[q] = list.flatMap(id => es[id]?.p131 || []);
  }
  frontier = next;
}
// wikitext lead for colors + pageimages
async function leads(lang, titles) {
  const res = {};
  for (let i = 0; i < titles.length; i += 25) {
    const batch = titles.slice(i, i + 25);
    const j = await capi(lang, { action: "query", titles: batch.join("|"), prop: "revisions|pageimages", rvprop: "content", rvslots: "main", rvsection: "0", piprop: "thumbnail|name", pithumbsize: "120", pilicense: "any" });
    for (const p of j.query?.pages || []) res[p.title] = { text: p.revisions?.[0]?.slots?.main?.content || "", img: p.thumbnail?.source || null };
  }
  return res;
}
const ptT = clubs.filter(c => c.ptTitle).map(c => c.ptTitle);
const enT = clubs.filter(c => c.enTitle).map(c => c.enTitle);
const ptL = await leads("pt", ptT);
const enL = await leads("en", enT);
const hex = s => { const m = (s || "").trim().match(/^#?([0-9a-fA-F]{6})\b/); return m ? m[1].toUpperCase() : null; };
function kit(text) {
  const g = k => { const m = text.match(new RegExp("\\|\\s*" + k + "\\s*=\\s*([^|\\n}]*)")); return m ? hex(m[1]) : null; };
  const body = g("body1") || g("corpo1"), arm = g("leftarm1") || g("braçoesquerdo1"), shorts = g("shorts1") || g("calções1") || g("calção1"), socks = g("socks1") || g("meias1");
  const b2 = g("body2") || g("corpo2");
  const hasPattern = /\|\s*pattern_b1\s*=\s*_\w+/.test(text);
  return body ? { body, arm, shorts, socks, b2, hasPattern } : null;
}
const out = clubs.map(c => {
  const lp = c.ptTitle && ptL[c.ptTitle], le = c.enTitle && enL[c.enTitle];
  const k = (lp && kit(lp.text)) || (le && kit(le.text)) || null;
  const cc = countries[c.country];
  return { qid: c.qid, tm: c.tm, pt: c.ptTitle, en: c.enTitle, labelPt: c.labelPt, labelEn: c.labelEn, texts: c.texts, in: c.in, short: c.short, country: cc?.iso || cc?.label || null, uf: ufOf[c.qid] || null, kit: k, img: lp?.img || le?.img || null, inception: c.inception };
});
fs.writeFileSync("step2.json", JSON.stringify(out));
const brc = out.filter(c => c.in.some(k => k.startsWith("ST_") || k.startsWith("BR")));
console.log("clubs", out.length, "BR", brc.length, "uf ok", brc.filter(c => c.uf).length, "kit", out.filter(c => c.kit).length, "img", out.filter(c => c.img).length, "no tm but img", out.filter(c => !c.tm && c.img).length, "no tm no img", out.filter(c => !c.tm && !c.img).length);
console.log("no uf:", brc.filter(c => !c.uf).map(c => c.labelPt + "[" + c.in.join(",") + "]").join("; ").slice(0, 1500));
const cs = {}; for (const c of out) cs[c.country] = (cs[c.country] || 0) + 1; console.log(JSON.stringify(cs));
