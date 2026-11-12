import { sections, sectionHtml, links, resolve } from "./lib.mjs";
import fs from "fs";
const SEC = /^(t[íi]tulos )?por (clube|equipe|time)s?$|^t[íi]tulos por (clube|equipe)|^clubes com mais t[íi]tulos|^campe[õo]es por clube|^performance by club|^performances by club|^titles by club|^by club$|^ranking de t[íi]tulos|^por clube/i;
export async function titles(lang, page, opt = {}) {
  const s = await sections(lang, page);
  if (!s) return { err: "missing " + page };
  const clean = x => x.line.replace(/<[^>]+>/g, "").trim();
  let secs = s.sections.filter(x => (opt.secRe || SEC).test(clean(x)));
  if (!secs.length) return { err: "nosec " + s.title + " :: " + s.sections.map(clean).join("|").slice(0, 400) };
  const sec = secs[opt.pick || 0];
  const html = await sectionHtml(lang, s.title, sec.index);
  const rows = html.split(/<tr[\s>]/).slice(1);
  const out = [];
  let carry = null;
  for (const r of rows) {
    const cells = r.split(/<t[dh][\s>]/).slice(1);
    let club = null, num = null, ci = -1;
    for (let i = 0; i < cells.length; i++) {
      const ls = links("<x " + cells[i]).filter(l => l.text && !/^\d{4}/.test(l.text) && !/^(Bandeira|Flag|Brasil$|Estado)/.test(l.title));
      if (ls.length && !club) { club = ls[0]; ci = i; continue; }
      if (club && num === null) {
        const txt = cells[i].replace(/^[^>]*>/, "").replace(/<sup.*?<\/sup>/gs, "").replace(/<[^>]+>/g, "").replace(/&#160;|&nbsp;/g, " ").trim();
        const m = txt.match(/^(\d{1,3})\b/);
        if (m && txt.length < 12) { num = +m[1]; const rs = cells[i].match(/rowspan="?(\d+)/); if (rs) carry = { n: num, left: +rs[1] }; }
      }
    }
    if (club && num === null && carry && carry.left > 1 && opt.rowspan !== false) { num = carry.n; }
    if (carry) { carry.left--; if (carry.left <= 0) carry = null; }
    if (club && num !== null) out.push({ title: club.title, text: club.text, n: num });
  }
  const rm = await resolve(lang, [...new Set(out.map(o => o.title))]);
  for (const o of out) o.title = rm[o.title] || o.title;
  return { page: s.title, sec: clean(sec), rows: out };
}
if (process.argv[2] && process.argv[1].endsWith("step3.mjs")) {
  const r = await titles(process.argv[2], process.argv[3]);
  console.log(r.err || `${r.page} [${r.sec}] ` + r.rows.map(o => `${o.text}:${o.n}`).join(", "));
}
