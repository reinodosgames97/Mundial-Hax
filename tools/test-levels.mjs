// Mede o efeito do nível da IA: partidas IA x IA com níveis fixos.
import { Match } from "../js/game/match.js";
import { seed } from "../js/core/rng.js";
seed(7);
const N = +(process.argv[2] || 40);
const pairs = process.argv[3] ? JSON.parse(process.argv[3]) : [[0.9, 0.3], [0.3, 0.9], [0.75, 0.55], [0.55, 0.55], [1.0, 1.0], [0.3, 0.3]];
for (const [a, b] of pairs) {
  let g0 = 0, g1 = 0, w0 = 0, w1 = 0, dr = 0, k0 = 0, k1 = 0, p0 = 0, p1 = 0, terr = 0, tt = 0;
  for (let i = 0; i < N; i++) {
    const m = new Match({ size: 4, mins: 3, levels: [a, b], human: null });
    let t = 0;
    while (m.state !== "end" && t++ < 60 * 60 * 6) { m.tick(null); if (m.state === 'play') { terr += m.w.ball.x > 0 ? 1 : 0; tt++; } for (const e of m.events) if (e.t === "kick") { if (e.p.team === 0) k0++; else k1++; } }
    g0 += m.score[0]; g1 += m.score[1]; p0 += m.stats.poss[0]; p1 += m.stats.poss[1];
    if (m.score[0] > m.score[1]) w0++; else if (m.score[0] < m.score[1]) w1++; else dr++;
  }
  console.log(`nível ${a} x ${b}: gols ${(g0 / N).toFixed(2)} x ${(g1 / N).toFixed(2)} | V ${w0} E ${dr} D ${w1} | chutes/jogo ${(k0 / N) | 0} x ${(k1 / N) | 0} | posse ${(100 * p0 / (p0 + p1)) | 0}% | bola no campo adversário ${(100 * terr / tt) | 0}%`);
}
