// Teste de equilíbrio: partidas IA x IA sem interface.
import { Match } from "../js/game/match.js";
import { seed } from "../js/core/rng.js";
seed(42);
const N = +(process.argv[2] || 30);
for (const [size, ra, rb] of [[4, 75, 75], [4, 88, 56], [3, 75, 75], [5, 75, 75]]) {
  let g0 = 0, g1 = 0, w0 = 0, w1 = 0, dr = 0, maxT = 0;
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const m = new Match({ size, mins: 3, ratings: [ra, rb], human: null });
    let t = 0;
    while (m.state !== "end" && t++ < 60 * 60 * 6) m.tick(null);
    maxT = Math.max(maxT, t);
    g0 += m.score[0]; g1 += m.score[1];
    if (m.score[0] > m.score[1]) w0++; else if (m.score[0] < m.score[1]) w1++; else dr++;
  }
  console.log(`${size}x${size} força ${ra}x${rb}: gols/jogo ${(g0 / N).toFixed(2)} x ${(g1 / N).toFixed(2)} | V ${w0} E ${dr} D ${w1} | ${((Date.now() - t0) / N) | 0} ms/jogo, ticks máx ${maxT}`);
}
