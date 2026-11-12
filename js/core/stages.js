// Blocos de construção das competições: ligas, grupos e mata-mata.
import { rnd, shuffle } from "./rng.js";

export const M = w => w * 2;       // meio de semana da semana w
export const W = w => w * 2 + 1;   // fim de semana da semana w
export const range = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; };

// --- tabelas de jogos (método do círculo) ---
function circle(teams, nRounds) {
  const t = teams.slice();
  if (t.length % 2) t.push(null);
  const n = t.length, rounds = [], homeCount = new Map(t.map(x => [x, 0]));
  const total = Math.min(nRounds ?? n - 1, n - 1);
  for (let r = 0; r < total; r++) {
    const ms = [];
    for (let i = 0; i < n / 2; i++) {
      let a = t[i], b = t[n - 1 - i];
      if (a === null || b === null) continue;
      const ha = homeCount.get(a), hb = homeCount.get(b);
      if (ha > hb || (ha === hb && (r + i) % 2)) [a, b] = [b, a];
      homeCount.set(a, homeCount.get(a) + 1);
      ms.push([a, b, -1, -1]);
    }
    rounds.push(ms);
    t.splice(1, 0, t.pop());
  }
  return rounds;
}
export function roundRobin(teams, { double = false, rounds } = {}) {
  const first = circle(shuffle(teams), rounds);
  if (!double) return first;
  return first.concat(first.map(r => r.map(m => [m[1], m[0], -1, -1])));
}

// --- construtores de fases ---
export function mkLeague(name, teams, { double = false, rounds, slots, zones = [] } = {}) {
  const rs = roundRobin(teams, { double, rounds });
  return { type: "league", name, teams: teams.slice(), rounds: rs, slots: slots.slice(0, rs.length), zones };
}
export function mkGroups(name, groups, { double = false, slots, zones = [], names } = {}) {
  const gs = groups.map((teams, i) => ({ name: names ? names[i] : String.fromCharCode(65 + i), teams: teams.slice(), rounds: roundRobin(teams, { double }) }));
  const n = Math.max(...gs.map(g => g.rounds.length));
  return { type: "groups", name, groups: gs, slots: slots.slice(0, n), zones };
}
// pairs: [[a, b], ...]. Jogo único: mando de "a". Ida e volta: "a" manda a ida, "b" decide em casa.
export function mkKO(name, pairs, { legs = 1, slots, neutral = false, tags } = {}) {
  return {
    type: "ko", name, legs, neutral, slots: slots.slice(0, legs),
    ties: pairs.map(([a, b], i) => ({ a, b, g: legs === 2 ? [[-1, -1], [-1, -1]] : [[-1, -1]], p: null, w: null, tag: tags ? tags[i] : undefined })),
  };
}

// --- classificação ---
export function table(g, rating) {
  const rows = new Map(g.teams.map(t => [t, { t, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, pts: 0 }]));
  for (const r of g.rounds) for (const [h, a, hg, ag] of r) {
    if (hg < 0) continue;
    const H = rows.get(h), A = rows.get(a);
    H.j++; A.j++; H.gp += hg; H.gc += ag; A.gp += ag; A.gc += hg;
    if (hg > ag) { H.v++; A.d++; H.pts += 3; } else if (hg < ag) { A.v++; H.d++; A.pts += 3; } else { H.e++; A.e++; H.pts++; A.pts++; }
  }
  const rt = t => (rating ? rating(t) : 0);
  return [...rows.values()].sort((x, y) => y.pts - x.pts || y.v - x.v || (y.gp - y.gc) - (x.gp - x.gc) || y.gp - x.gp || rt(y.t) - rt(x.t) || x.t - y.t);
}
export const order = (g, rating) => table(g, rating).map(r => r.t);

// --- iteração de jogos ---
// Cada jogo: { st, slot, h, a, m (array [h,a,hg,ag] ou g[leg]), tie, leg, neutral }
export function* stageMatches(st) {
  if (st.type === "league") {
    for (let r = 0; r < st.rounds.length; r++) for (const m of st.rounds[r]) yield { st, slot: st.slots[r], h: m[0], a: m[1], m, round: r };
  } else if (st.type === "groups") {
    for (const g of st.groups) for (let r = 0; r < g.rounds.length; r++) for (const m of g.rounds[r]) yield { st, slot: st.slots[r], h: m[0], a: m[1], m, round: r, group: g };
  } else {
    for (const tie of st.ties) for (let l = 0; l < st.legs; l++) {
      const h = l === 0 ? tie.a : tie.b, a = l === 0 ? tie.b : tie.a;
      yield { st, slot: st.slots[l], h, a, m: tie.g[l], tie, leg: l, neutral: st.neutral, ko: true };
    }
  }
}
export const played = x => (x.ko ? x.m[0] >= 0 : x.m[2] >= 0);
export function score(x) { return x.ko ? [x.m[0], x.m[1]] : [x.m[2], x.m[3]]; }
export function setScore(x, hg, ag) { if (x.ko) { x.m[0] = hg; x.m[1] = ag; } else { x.m[2] = hg; x.m[3] = ag; } }

export function stageDone(st) {
  if (st.type === "ko") return st.ties.every(t => t.w !== null);
  for (const x of stageMatches(st)) if (!played(x)) return false;
  return true;
}
// placar agregado de um confronto do ponto de vista [a, b]
export function aggregate(tie) {
  let A = 0, B = 0;
  tie.g.forEach((g, l) => { if (g[0] < 0) return; if (l === 0) { A += g[0]; B += g[1]; } else { B += g[0]; A += g[1]; } });
  return [A, B];
}
export function simPens(pa = 0.5) {
  // disputa de pênaltis simulada: retorna [golsA, golsB]
  let a = 0, b = 0;
  for (let i = 0; i < 5; i++) { if (rnd() < 0.72 + (pa - 0.5) * 0.2) a++; if (rnd() < 0.72 - (pa - 0.5) * 0.2) b++; }
  while (a === b) { const x = rnd() < 0.74, y = rnd() < 0.74; if (x !== y) { if (x) a++; else b++; } else if (x) { a++; b++; } }
  return [a, b];
}
// resolve confrontos cujos jogos já acabaram
export function settleTies(st, pensProb) {
  if (st.type !== "ko") return;
  for (const tie of st.ties) {
    if (tie.w !== null || tie.g.some(g => g[0] < 0)) continue;
    const [A, B] = aggregate(tie);
    if (A !== B) tie.w = A > B ? tie.a : tie.b;
    else { if (!tie.p) tie.p = simPens(pensProb ? pensProb(tie.a, tie.b) : 0.5); tie.w = tie.p[0] > tie.p[1] ? tie.a : tie.b; }
  }
}
export const winners = st => st.ties.map(t => t.w);
export const losers = st => st.ties.map(t => (t.w === t.a ? t.b : t.a));
export const pairUp = list => { const p = []; for (let i = 0; i + 1 < list.length; i += 2) p.push([list[i], list[i + 1]]); return p; };
