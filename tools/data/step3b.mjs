import { sections, sectionHtml, links, resolve } from "./lib.mjs";
const SEC = /campe[õo]es|edi[çc][õo]es|finais|hist[óo]rico|resultados|champions|winners|finals|list of/i;
const txt = c => c.replace(/^[^>]*>/, "").replace(/<sup.*?<\/sup>/gs, "").replace(/<style.*?<\/style>/gs, "").replace(/<[^>]+>/g, "").replace(/&#160;|&nbsp;/g, " ").replace(/&#8211;|–/g, "-").trim();
export async function champs(lang, page, opt = {}) {
  const s = await sections(lang, page);
  if (!s) return { err: "missing " + page };
  const clean = x => x.line.replace(/<[^>]+>/g, "").trim();
  const secs = s.sections.filter(x => (opt.secRe || SEC).test(clean(x)));
  const byYear = new Map();
  for (const sec of secs) {
    const html = await sectionHtml(lang, s.title, sec.index);
    for (const r of html.split(/<tr[\s>]/).slice(1)) {
      const cells = r.split(/<t[dh][\s>]/).slice(1);
      let year = null;
      for (let i = 0; i < cells.length; i++) {
        const t = txt(cells[i]);
        if (year === null) {
          const m = t.match(/^(?:\d{1,3}\s*[ªaº.]*\s*)?((?:18|19|20)\d\d)(?:[-\/](\d{2,4}))?(?:\s*\(.*\))?(?:\s+detalhes|\s+details)?$/i);
          if (m) { year = +m[1]; if (opt.endYear && m[2]) year = +m[1] + 1; }
          continue;
        }
        const ls = links("<x " + cells[i]).filter(l => !/^(Bandeira|Flag|Ficheiro|File)/.test(l.title) && !/^\d{4}$/.test(l.text) && l.text && !/^Campeonato|^Copa|^Taça|^Torneio|^Supercopa|^Recopa/.test(l.title));
        if (ls.length) { if (!byYear.has(year)) byYear.set(year, ls.map(l => l.title).slice(0, opt.multi ? 3 : 1)); break; }
        if (txt(cells[i]).length > 3 && !/^\d+$/.test(txt(cells[i]))) break; // champion cell without link (e.g. not held)
      }
    }
  }
  const all = [...new Set([...byYear.values()].flat())];
  const rm = await resolve(lang, all);
  const count = {};
  for (const [y, ts] of byYear) { if (y > (opt.max || 2025)) continue; for (const t of ts) { const k = rm[t] || t; count[k] = (count[k] || 0) + 1; } }
  return { byYear, rm, page: s.title, secs: secs.map(clean), years: byYear.size, min: Math.min(...byYear.keys()), max: Math.max(...byYear.keys()), count };
}
if (process.argv[2] && process.argv[1].endsWith("step3b.mjs")) {
  const r = await champs(process.argv[2], process.argv[3]);
  console.log(r.err || `${r.page} [${r.secs.join("/")}] years=${r.years} ${r.min}-${r.max} ` + Object.entries(r.count).sort((a, b) => b[1] - a[1]).map(o => `${o[0]}:${o[1]}`).join(", "));
}
