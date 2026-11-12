// Confere o acúmulo de vagas do Brasil: campeões continentais e da Copa do Brasil abrem vaga para o próximo da tabela.
import { seed } from "../js/core/rng.js";
import { newGame, step, simUser, brContinental } from "../js/core/season.js";
import { cname, findClub } from "../js/core/db.js";

seed(7);
const G = newGame({ clubId: findClub("Flamengo", "BR"), diff: 1 });
for (let g = 0; g < 400; g++) { const ev = step(G); if (ev.type === "end") break; simUser(G, ev.match); }
const A = G.comps.BRA.x.order, pos = id => A.indexOf(id) + 1;
const show = (title, v) => {
  const f = ids => ids.map(id => `${cname(id)} (${pos(id) || "fora da Série A"}º)`.replace("(fora da Série Aº)", "(fora da Série A)")).join(", ");
  console.log("\n" + title);
  console.log("  Libertadores, vaga de campeão: " + (f(v.champs) || "—"));
  console.log("  Libertadores, fase de grupos:  " + f(v.g));
  console.log("  Libertadores, preliminar:      " + f(v.p));
  console.log("  Sul-Americana:                 " + f(v.s));
};
let fails = 0;
const check = (ok, what) => { console.log((ok ? "  OK    " : "  FALHA ") + what); if (!ok) fails++; };
const set = (lib, sul, cdb, vice) => { G.comps.LIB.champion = lib; G.comps.SUL.champion = sul; G.comps.CDB.champion = cdb; G.comps.CDB.runner = vice; };
const outside = G.div.B[0];   // um clube fora da Série A

// Cenário 1: nenhum campeão de copa está na zona de classificação
set(findClub("Boca Juniors"), findClub("Lanús"), outside, G.div.B[1]);
let v = brContinental(G, true);
show("1) Campeões das copas fora da tabela (G4 + campeão e vice da Copa do Brasil)", v);
check(v.g.length === 5 && v.g.includes(outside) && [1, 2, 3, 4].every(n => v.g.includes(A[n - 1])), "grupos: 1º ao 4º + campeão da Copa do Brasil");
check(v.p.includes(A[4]) && v.p.includes(G.div.B[1]), "preliminar: 5º + vice da Copa do Brasil");
check(v.s.join() === A.slice(5, 11).join(), "Sul-Americana: 6º ao 11º");

// Cenário 2: campeão da Libertadores é o 1º do Brasileirão -> G4 vira G5
set(A[0], findClub("Lanús"), outside, G.div.B[1]);
v = brContinental(G, true);
show("2) Campeão da Libertadores é o líder do Brasileirão", v);
check(v.champs.includes(A[0]) && [2, 3, 4, 5].every(n => v.g.includes(A[n - 1])), "vaga extra do campeão; grupos passam a ser 2º ao 5º (o G4 vira G5)");
check(v.p.includes(A[5]) && v.s.join() === A.slice(6, 12).join(), "preliminar com o 6º; Sul-Americana do 7º ao 12º");

// Cenário 3: Libertadores (1º), Sul-Americana (3º), Copa do Brasil (2º) e vice (4º) todos na zona -> G9
set(A[0], A[2], A[1], A[3]);
v = brContinental(G, true);
show("3) Campeões da Libertadores (1º), da Sul-Americana (3º), da Copa do Brasil (2º) e vice (4º) já na zona", v);
check(v.champs.length === 2 && v.g.join() === [A[1], A[3], A[4], A[5], A[6]].join(), "grupos: campeão da Copa do Brasil + 4º, 5º, 6º e 7º");
check(v.p.join() === [A[7], A[8]].join(), "preliminar: 8º e 9º (o G6 virou G9)");
check(v.s.join() === A.slice(9, 15).join(), "Sul-Americana: 10º ao 15º");
console.log(fails ? "\nFALHOU" : "\nTudo certo: as vagas se acumulam.");
process.exit(fails ? 1 : 0);
