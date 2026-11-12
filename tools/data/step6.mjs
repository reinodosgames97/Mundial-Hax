// Compila os elencos (step5.json) em js/data/squads.js: { idDoClube: "Nome,P,nº;..." }
import fs from "fs";
const OUT = process.argv[2] || "../out";
const s5 = JSON.parse(fs.readFileSync("step5.json", "utf8"));
const out = {};
let n = 0, players = 0;
for (const [qid, { s }] of Object.entries(s5)) {
  const seen = new Set(), list = [];
  for (const [name, pos, no] of s) {
    const nm = name.replace(/[,;]/g, " ").trim();
    if (!nm || seen.has(nm)) continue;
    seen.add(nm); list.push(`${nm},${pos},${no || 0}`);
  }
  const cnt = p => list.filter(x => x.split(",")[1] === p).length;
  if (list.length < 14 || cnt("G") < 1 || cnt("D") < 3 || cnt("M") < 3 || cnt("A") < 1) continue;
  out[+qid.slice(1)] = list.slice(0, 30).join(";");
  n++; players += Math.min(30, list.length);
}
fs.writeFileSync(OUT + "/squads.js", "// Elencos (Wikipédia em inglês, predefinição Fs player). Gerado por tools/data/step5 e step6.\n// { idDoClube: \"Nome,Posição(G|D|M|A),número;...\" }\nexport const SQUADS = " + JSON.stringify(out) + ";\n");
console.log("clubes com elenco:", n, "jogadores:", players, "bytes:", fs.statSync(OUT + "/squads.js").size);
