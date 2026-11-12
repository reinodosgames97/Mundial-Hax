import { titles } from "./step3.mjs";
import { champs } from "./step3b.mjs";
import fs from "fs";
const ST = { AC: "Acriano", AL: "Alagoano", AP: "Amapaense", AM: "Amazonense", BA: "Baiano", DF: "Brasiliense", ES: "Capixaba", RJ: "Carioca", SC: "Catarinense", CE: "Cearense", RS: "Gaúcho", GO: "Goiano", MA: "Maranhense", MT: "Mato-Grossense", MG: "Mineiro", PA: "Paraense", PB: "Paraibano", PR: "Paranaense", SP: "Paulista", PE: "Pernambucano", PI: "Piauiense", RN: "Potiguar", RO: "Rondoniense", RR: "Roraimense", SE: "Sergipano", MS: "Sul-Mato-Grossense", TO: "Tocantinense" };
const out = {};
for (const [uf, adj] of Object.entries(ST)) {
  let page = `Campeonato ${adj} de Futebol Masculino`;
  if (uf === "DF") page = "Campeonato Candango de Futebol Masculino";
  const t = await titles("pt", page);
  const c = await champs("pt", page);
  const c26 = c.byYear?.get(2026)?.map(x => c.rm[x] || x) || null;
  out[uf] = { page: t.page, rows: t.rows || [], c26 };
  console.log(uf, t.err ? "ERR " + t.err.slice(0, 200) : `[${t.sec}] n=${t.rows.length} ` + t.rows.slice(0, 6).map(o => `${o.text}:${o.n}`).join(", "), "| 2026:", c26?.join("/") || "?");
}
fs.writeFileSync("step3.json", JSON.stringify(out));
