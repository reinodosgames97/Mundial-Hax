// Teste de equilíbrio do motor 11x11: partidas IA x IA sem interface.
// node tools/test-match.mjs [partidas] [clubeA] [clubeB] [nívelA] [nívelB]
import { Game } from "../js/game/engine.js";
import { matchTeam, defaultFormation } from "../js/core/squads.js";
import { findClub, club } from "../js/core/db.js";
import { seed } from "../js/core/rng.js";
seed(42);
const N = +(process.argv[2] || 20);
const id = n => findClub(n, "BR") ?? findClub(n);
const team = n => { const i = id(n); return matchTeam(i, club(i).r0, defaultFormation(i)); };
export function run(a, b, levels, n = N, mins = 6) {
  const S = { g: [0, 0], w: [0, 0, 0], shots: [0, 0], target: [0, 0], pass: [0, 0], ok: [0, 0], poss: [0, 0], dead: {}, ms: 0, scorers: {}, inter: 0, tack: 0, defl: 0 };
  for (let k = 0; k < n; k++) {
    const g = new Game({ teams: [team(a), team(b)], human: null, mins, levels });
    const t0 = Date.now(); let guard = 0;
    while (g.state !== "end" && guard++ < 3600 * 40) { g.tick(null); for (const e of g.events) if (e.t === "dead") S.dead[e.type] = (S.dead[e.type] || 0) + 1; }
    if (g.state !== "end") console.log("!! partida não terminou", g.state, g.clock, g.half);
    S.ms += Date.now() - t0;
    for (const t of [0, 1]) { S.g[t] += g.score[t]; S.shots[t] += g.stats.shots[t]; S.target[t] += g.stats.target[t]; S.pass[t] += g.stats.passes[t]; S.ok[t] += g.stats.passOk[t]; S.poss[t] += g.stats.poss[t]; S.inter += g.stats.inter[t]; S.tack += g.stats.tackles[t]; } S.defl += g.stats.defl;
    S.w[g.score[0] > g.score[1] ? 0 : g.score[0] < g.score[1] ? 2 : 1]++;
    for (const gl of g.goals) S.scorers[gl.name] = (S.scorers[gl.name] || 0) + 1;
    for (const p of g.players) if (!Number.isFinite(p.x + p.y + g.ball.x + g.ball.y)) { console.log("!! NaN"); process.exit(1); }
  }
  const f = (x, d = 1) => (x / n).toFixed(d);
  console.log(`${a} x ${b}${levels ? " níveis " + levels : ""}: gols ${f(S.g[0], 2)} x ${f(S.g[1], 2)} | V/E/D ${S.w.join("/")} | chutes ${f(S.shots[0])} x ${f(S.shots[1])} (no gol ${f(S.target[0])} x ${f(S.target[1])}) | passes ${f(S.pass[0], 0)} x ${f(S.pass[1], 0)} (${((100 * S.ok[0]) / S.pass[0]) | 0}% / ${((100 * S.ok[1]) / S.pass[1]) | 0}%) | posse ${((100 * S.poss[0]) / (S.poss[0] + S.poss[1])) | 0}% | intercept. ${f(S.inter)} desarmes ${f(S.tack)} desvios ${f(S.defl)} | bola parada ${Object.entries(S.dead).map(([k, v]) => k + " " + f(v)).join(", ")} | ${(S.ms / n) | 0} ms/jogo`);
  return S;
}
if (process.argv[1].endsWith("test-match.mjs")) {
  const [a, b, la, lb] = process.argv.slice(3);
  if (a) { const S = run(a, b, la ? [+la, +lb] : undefined); console.log("artilheiros:", Object.entries(S.scorers).sort((x, y) => y[1] - x[1]).slice(0, 6).map(([k, v]) => k + " " + v).join(", ")); }
  else { run("Flamengo", "Corinthians"); run("Flamengo", "Treze"); run("Palmeiras", "Flamengo", [1, 0.12]); run("Palmeiras", "Flamengo", [0.12, 1]); }
}
