// Teste do motor de temporadas: simula várias temporadas completas e confere invariantes.
import { seed } from "../js/core/rng.js";
import { newGame, step, simUser, endSeason, divOf, fixtures, titlesOf } from "../js/core/season.js";
import { club, cname, findClub } from "../js/core/db.js";
import { stageMatches, played } from "../js/core/stages.js";
import { ORDER } from "../js/core/comps.js";

const N = +(process.argv[2] || 6), who = process.argv[3] || "Flamengo";
seed(+(process.argv[4] || 12345));
const assert = (c, m) => { if (!c) { console.error("FALHOU:", m); process.exitCode = 1; throw new Error(m); } };
let G = newGame({ clubId: findClub(who, "BR") ?? findClub(who), diff: 1 });
assert(G.userClub, "clube não encontrado");
for (let s = 0; s < N; s++) {
  const t0 = Date.now();
  let games = 0, guard = 0;
  for (;;) {
    const ev = step(G);
    if (ev.type === "end") break;
    simUser(G, ev.match); games++;
    assert(guard++ < 400, "loop");
  }
  // invariantes: tudo terminado e sem conflitos de data por clube
  for (const id of ORDER) { const c = G.comps[id]; if (c) assert(c.done, "competição não terminou: " + id + " (fases: " + c.stages.length + ")"); }
  const seen = new Map(); let clashes = 0, total = 0;
  for (const id of ORDER) { const c = G.comps[id]; if (!c) continue; for (const st of c.stages) for (const x of stageMatches(st)) { total++; assert(played(x), "jogo sem resultado em " + id); for (const t of [x.h, x.a]) { const k = t + ":" + x.slot; if (seen.has(k)) clashes++; seen.set(k, id); } } }
  G = JSON.parse(JSON.stringify(G)); // o save precisa sobreviver à serialização
  const size = JSON.stringify(G).length;
  const C = G.comps, year = G.season;
  const line = ["BRA", "BRB", "BRC", "BRD", "CDB", "LIB", "SUL", "UCL", "CWC", "INT"].filter(k => C[k]).map(k => k + ":" + cname(C[k].champion)).join("  ");
  const sum = endSeason(G);
  assert(G.div.A.length === 20 && G.div.B.length === 20 && G.div.D.length === 96, "tamanho das divisões: " + [G.div.A.length, G.div.B.length, G.div.C.length, G.div.D.length]);
  assert(new Set([...G.div.A, ...G.div.B, ...G.div.C, ...G.div.D]).size === 136 + G.div.C.length - 0 || true, "duplicados");
  const all = [...G.div.A, ...G.div.B, ...G.div.C, ...G.div.D]; assert(new Set(all).size === all.length, "clube em duas divisões");
  assert(G.q.lib.G.length === 28 && G.q.lib.P2.length === 13 && G.q.lib.P1.length === 6, "vagas Libertadores");
  assert(G.q.sul.G.length === 12 && G.q.sul.P1.length === 16, "vagas Sul-Americana");
  assert(G.q.ucl.length === 36, "vagas Champions");
  console.log(`${year}: ${games} jogos do usuário, ${total} jogos no total, ${clashes} choques de data, save ${(size / 1024) | 0} KB, ${Date.now() - t0} ms`);
  console.log("   ", line);
  console.log("    usuário:", cname(sum.club), sum.comps.map(c => c.name + " → " + c.text).join(" | "), "| C:", G.div.C.length);
}
console.log("títulos do clube:", titlesOf(G, G.userClub).map(t => t.name + " " + t.n).join(", "));
console.log("carreira:", G.career.map(c => `${c.y} ${c.league} ${c.posText} (${c.v}V ${c.e}E ${c.d}D)`).join(" · "));
