import { sections, sectionHtml, links, wikidata, resolve, isClub } from "./lib.mjs";
import fs from "fs";
const SEC_RE = /^(equipes|clubes|times)?\s*participantes|^equipes classificadas|^equipes$|^clubes$|^teams$|^qualified teams|^participantes|^equipes e est[áa]dios|^participating teams|^clubs$|^league phase$|^team changes|^stadiums and locations|^stadia and locations|^teams and stadiums|^clubs and locations|^formato e participantes|^informações das equipes/i;
async function participants(lang, candidates, opt = {}) {
  for (let page of candidates) {
    if (Array.isArray(page)) [lang, page] = page;
    const s = await sections(lang, page);
    if (!s) continue;
    let secs = s.sections.filter(x => (opt.secRe || SEC_RE).test(x.line.replace(/<[^>]+>/g, "").trim()));
    if (opt.first) secs = secs.slice(0, 1);
    let html = "";
    for (const sec of secs) html += await sectionHtml(lang, s.title, sec.index);
    if (!secs.length) { console.log("  !! no participants section in", s.title, "::", s.sections.map(x => x.line).join("|").slice(0, 300)); continue; }
    const ls = links(html);
    const titles = [...new Set(ls.map(l => l.title))];
    const rmap = await resolve(lang, titles);
    const canon = [...new Set(Object.values(rmap))];
    const wd = await wikidata(lang, canon);
    const seen = new Map();
    for (const l of ls) {
      const t = rmap[l.title]; const e = wd[t];
      if (!isClub(e)) continue;
      if (!seen.has(t)) seen.set(t, { title: t, lang, texts: {}, ...e }); seen.get(t).lang = lang;
      const o = seen.get(t); if (l.text) o.texts[l.text] = (o.texts[l.text] || 0) + 1;
    }
    return { page: s.title, secs: secs.map(x => x.line), clubs: [...seen.values()] };
  }
  return null;
}
const out = {};
const add = async (key, lang, cands, opt) => { const r = await participants(lang, cands, opt); out[key] = r; console.log(key.padEnd(8), r ? `${r.clubs.length} clubs  [${r.page}] secs=${r.secs.join("/")}` : "NOT FOUND"); };
for (const s of ["A", "B", "C", "D"]) await add("BR" + s, "pt", [`Campeonato Brasileiro de Futebol de 2026 - Série ${s}`]);
const ST = { AC: "Acreano", AL: "Alagoano", AP: "Amapaense", AM: "Amazonense", BA: "Baiano", DF: "Brasiliense", ES: "Capixaba", RJ: "Carioca", SC: "Catarinense", CE: "Cearense", RS: "Gaúcho", GO: "Goiano", MA: "Maranhense", MT: "Mato-Grossense", MG: "Mineiro", PA: "Paraense", PB: "Paraibano", PR: "Paranaense", SP: "Paulista", PE: "Pernambucano", PI: "Piauiense", RN: "Potiguar", RO: "Rondoniense", RR: "Roraimense", SE: "Sergipano", MS: "Sul-Mato-Grossense", TO: "Tocantinense" };
for (const [uf, adj] of Object.entries(ST)) {
  const c = [];
  for (const y of [2026, 2025, 2024]) for (const suf of ["", " - Série A", " - Módulo I", " - Primeira Divisão", " – Primeira Divisão", " - Série A1"]) c.push(`Campeonato ${adj} de Futebol de ${y}${suf}`);
  for (const y of [2026, 2025, 2024]) c.push(`Campeonato ${adj} de Futebol Masculino de ${y}`);
  for (const y of [2026, 2025, 2024, 2023]) c.push(["en", `${y} Campeonato ${adj}`]);
  await add("ST_" + uf, "pt", c);
}
await add("LIB26", "pt", ["Copa Libertadores da América de 2026"], { first: true });
await add("SUL26", "pt", ["Copa Sul-Americana de 2026"], { first: true });
await add("LIB25", "pt", ["Copa Libertadores da América de 2025"], { first: true });
await add("SUL25", "pt", ["Copa Sul-Americana de 2025"], { first: true });
const EU = { secRe: /^location and stadiums|^stadiums and locations|^stadia and locations|^teams and stadiums|^clubs and locations|^stadiums$|^locations$/i };
await add("ENG", "en", ["2026–27 Premier League"], EU);
await add("ESP", "en", ["2026–27 La Liga"], EU);
await add("ITA", "en", ["2026–27 Serie A"], EU);
await add("GER", "en", ["2026–27 Bundesliga"], EU);
await add("FRA", "en", ["2026–27 Ligue 1"], EU);
await add("POR", "en", ["2026–27 Primeira Liga"], EU);
await add("NED", "en", ["2026–27 Eredivisie"], EU);
await add("ARG", "en", ["2026 Argentine Primera División"], { secRe: /^stadiums and locations|^stadia and locations|^teams$|^clubs$/i });
await add("CDB26", "pt", ["Copa do Brasil de Futebol de 2026"], { secRe: /^Equipes classificadas|^Estaduais, copas e seletivas|^Classificados diretamente/i });
await add("UCL26", "en", ["2026–27 UEFA Champions League"]);
await add("UCL25", "en", ["2025–26 UEFA Champions League"]);
await add("CWC25", "en", ["2025 FIFA Club World Cup"]);
{
  const ex = ["Al-Nassr FC", "Al-Ittihad Club", "Al-Ahli Saudi FC", "Club América", "Tigres UANL", "Cruz Azul", "Deportivo Toluca F.C.", "Zamalek SC", "Pyramids FC", "Kawasaki Frontale", "Vissel Kobe", "Al Sadd SC", "RS Berkane", "Columbus Crew", "Celtic F.C.", "Rangers F.C.", "Yokohama F. Marinos", "Jeonbuk Hyundai Motors", "Orlando Pirates F.C.", "C.D. Guadalajara"];
  const rm = await resolve("en", ex); const wd = await wikidata("en", Object.values(rm));
  out.EXTRA = { page: "extra", secs: [], clubs: Object.entries(wd).map(([t, e]) => ({ title: t, lang: "en", texts: {}, ...e })) };
  console.log("EXTRA", out.EXTRA.clubs.length);
}
fs.writeFileSync("step1.json", JSON.stringify(out));
