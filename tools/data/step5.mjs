// Elencos: lê o wikitexto dos artigos dos clubes e extrai o bloco de elenco principal ({{Fs player}}).
import { capi } from "./lib.mjs";
import fs from "fs";
const clubs = JSON.parse(fs.readFileSync("step2.json", "utf8"));
async function texts(lang, titles) {
  const res = {};
  for (let i = 0; i < titles.length; i += 6) {
    const batch = titles.slice(i, i + 6);
    let cont = {};
    for (let guard = 0; guard < 8; guard++) {
      const j = await capi(lang, { action: "query", titles: batch.join("|"), prop: "revisions", rvprop: "content", rvslots: "main", ...cont });
      for (const p of j.query?.pages || []) { const c = p.revisions?.[0]?.slots?.main?.content; if (c) res[p.title] = c; }
      if (j.continue) cont = j.continue; else break;
    }
  }
  return res;
}
const POS = s => { s = (s || "").toUpperCase().replace(/[^A-Z]/g, ""); if (/^(GK|G|GOL|GR|PO)/.test(s)) return "G"; if (/^(DF|D|Z|LD|LE|LAT|CB|RB|LB|DEF)/.test(s)) return "D"; if (/^(MF|M|V|MC|MEI|CM|DM|AM|MED)/.test(s)) return "M"; if (/^(FW|F|A|ATA|PL|PE|PD|CA|ST|DEL)/.test(s)) return "A"; return null; };
const cleanName = s => { s = s.replace(/<ref[^>]*>.*?<\/ref>/gs, "").replace(/<ref[^>]*\/>/g, "").replace(/<!--.*?-->/gs, "").replace(/\{\{[^{}]*\}\}/g, "").replace(/<[^>]+>/g, ""); const m = s.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/); s = m ? (m[2] || m[1]) : s; return s.replace(/\(.*?\)/g, "").replace(/'''?/g, "").replace(/\s+/g, " ").trim(); };
function squad(text) {
  // primeiro bloco {{Fs start}} ... {{Fs end}} com pelo menos 14 jogadores
  const re = /\{\{\s*(?:fs|football squad)\s*start[^}]*\}\}([\s\S]*?)\{\{\s*(?:fs|football squad)\s*end[^}]*\}\}/gi;
  let m;
  while ((m = re.exec(text))) {
    const out = [];
    const pr = /\{\{\s*(?:fs|football squad)\s*player2?\s*\|((?:[^{}]|\{\{[^{}]*\}\})*)\}\}/gi;
    let p;
    while ((p = pr.exec(m[1]))) {
      const f = {};
      for (const part of p[1].split(/\|(?![^\[]*\]\])(?![^{]*\}\})/)) { const i = part.indexOf("="); if (i > 0) f[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim(); }
      const name = cleanName(f.name || f.nome || ""), pos = POS(f.pos);
      const no = parseInt(f.no || f["nº"] || f.num || "", 10);
      if (name && name.length < 32 && pos) out.push([name, pos, Number.isFinite(no) ? no : 0]);
    }
    if (out.length >= 14) return out.slice(0, 32);
  }
  return null;
}
const out = {};
const enT = clubs.filter(c => c.en).map(c => c.en);
const en = await texts("en", enT);
let n = 0;
for (const c of clubs) { const t = c.en && en[c.en]; const s = t && squad(t); if (s) { out[c.qid] = { src: "en", s }; n++; } }
console.log("en squads", n, "of", enT.length);
const rest = clubs.filter(c => !out[c.qid] && c.pt).map(c => c.pt);
const pt = await texts("pt", rest);
let n2 = 0;
for (const c of clubs) { if (out[c.qid]) continue; const t = c.pt && pt[c.pt]; const s = t && squad(t); if (s) { out[c.qid] = { src: "pt", s }; n2++; } }
console.log("pt squads", n2, "of", rest.length);
fs.writeFileSync("step5.json", JSON.stringify(out));
const miss = clubs.filter(c => !out[c.qid] && c.in.some(k => /^BR[ABC]$|^ENG|^ESP|^ITA|^GER|^FRA|^LIB26/.test(k))).map(c => c.labelPt || c.labelEn);
console.log("sem elenco (principais):", miss.length, miss.slice(0, 40).join("; "));
