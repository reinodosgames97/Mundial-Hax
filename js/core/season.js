// Motor da carreira: criação do jogo, avanço do calendário, virada de temporada e classificações.
import { DEFS, ORDER, R, UFS, EU_LEAGUES, isCwcYear, serieCSize, COMP_NAMES, slotLabel } from "./comps.js";
import { stageMatches, played, score, setScore, stageDone, settleTies, aggregate, table, order } from "./stages.js";
import { clubs, club, INIT, TITLES, conf, CSA, FED_RANK, findClub } from "./db.js";
import { rnd, gauss, poisson } from "./rng.js";

export const SAVE_VERSION = 1;
export const DIFFS = ["Fácil", "Normal", "Difícil", "Lendário"];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const uniq = a => [...new Set(a)];
const initDiv = {};
for (const d of "ABCD") for (const id of INIT.div[d]) initDiv[id] = d;
const DIV_TARGET = { A: 79, B: 69.5, C: 63, D: 56.5, "": 47 };

/* ---------------------------- simulação ---------------------------- */
export function simGoals(G, h, a, neutral) {
  const d = clamp(R(G, h) - R(G, a), -40, 40), k = 0.042;
  let lh = 1.3 * Math.exp(k * d), la = 1.3 * Math.exp(-k * d);
  if (!neutral) { lh *= 1.16; la *= 0.9; }
  return [Math.min(9, poisson(lh)), Math.min(9, poisson(la))];
}
const pensProb = G => (a, b) => clamp(0.5 + (R(G, a) - R(G, b)) * 0.004, 0.35, 0.65);

/* ---------------------------- classificação continental ---------------------------- */
const LIB_QUOTA = { BR: [5, 2, 0, 6], AR: [5, 1, 0, 6], CO: [2, 2, 0, 4], CL: [2, 2, 0, 4] };
function conmebolQual(G, libChamp, sulChamp) {
  const champs = uniq([libChamp, sulChamp].filter(x => x != null));
  const lib = { G: champs.slice(), P2: [], P1: [] }, sulG = [], sulP1 = [];
  const used = new Set(champs), ptr = {};
  const spare = () => [...clubs.values()].filter(c => CSA.includes(c.cc) && !used.has(c.id)).sort((a, b) => R(G, b.id) - R(G, a.id))[0]?.id;
  const take = cc => {
    const list = G.rank[cc] || [];
    ptr[cc] ??= 0;
    while (ptr[cc] < list.length && used.has(list[ptr[cc]])) ptr[cc]++;
    const id = ptr[cc] < list.length ? list[ptr[cc]++] : spare();
    used.add(id);
    return id;
  };
  for (const cc of CSA) {
    const [g, p2, p1] = LIB_QUOTA[cc] || [2, 1, 1, 4];
    for (let i = 0; i < g; i++) lib.G.push(take(cc));
    for (let i = 0; i < p2; i++) lib.P2.push(take(cc));
    for (let i = 0; i < p1; i++) lib.P1.push(take(cc));
  }
  while (lib.G.length < 28) lib.G.push(take(libChamp != null ? club(libChamp).cc : "BR"));
  for (const cc of CSA) {
    const n = (LIB_QUOTA[cc] || [2, 1, 1, 4])[3], t = [];
    for (let i = 0; i < n; i++) t.push(take(cc));
    if (cc === "BR" || cc === "AR") sulG.push(...t);
    else sulP1.push([t[0], t[3]], [t[1], t[2]]);
  }
  return { lib, sul: { G: sulG, P1: sulP1 } };
}

function cdbQual(G, third) {
  const late = G.div.A.slice();
  third = uniq(third.filter(x => x != null && !late.includes(x))).slice(0, 4);
  const used = new Set([...late, ...third]), others = [];
  FED_RANK.forEach((uf, i) => {
    const quota = i < 2 ? 6 : i < 5 ? 5 : i < 14 ? 4 : 3;
    let n = 0;
    for (const id of G.stateRank[uf] || []) { if (n >= quota) break; if (used.has(id)) continue; used.add(id); others.push(id); n++; }
  });
  const inDiv = new Set([...G.div.B, ...G.div.C, ...G.div.D]);
  const rest = [...clubs.values()].filter(c => c.cc === "BR" && !used.has(c.id)).map(c => c.id)
    .sort((a, b) => (inDiv.has(b) - inDiv.has(a)) || R(G, b) - R(G, a));
  while (others.length + third.length < 106 && rest.length) others.push(rest.shift());
  others.sort((a, b) => R(G, b) - R(G, a) || a - b);
  return { late, third, others };
}

function uclQual(G, champion) {
  const ids = [];
  for (const [id, [, , quota]] of Object.entries(EU_LEAGUES)) {
    const c = G.comps?.[id];
    const o = c?.x.order || G.leagues[id].slice().sort((a, b) => R(G, b) - R(G, a));
    ids.push(...o.slice(0, quota));
  }
  const inBig = new Set(Object.values(G.leagues).flat());
  const pool = [...clubs.values()].filter(c => conf(c.cc) === "UEFA" && !inBig.has(c.id)).map(c => [c.id, R(G, c.id) + gauss() * 3]).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  if (champion != null && !ids.includes(champion)) ids.push(champion);
  for (const id of pool) { if (ids.length >= 36) break; if (!ids.includes(id)) ids.push(id); }
  return ids.slice(0, 36);
}

function cwcQual(G) {
  const out = [];
  const fill = (confName, n, champs) => {
    const list = uniq(champs.filter(id => id != null && conf(club(id).cc) === confName)).slice(-n);
    const pool = [...clubs.values()].filter(c => conf(c.cc) === confName && !list.includes(c.id)).sort((a, b) => R(G, b.id) - R(G, a.id));
    const perCC = {};
    for (const id of list) perCC[club(id).cc] = (perCC[club(id).cc] || 0) + 1;
    for (const c of pool) { if (list.length >= n) break; if ((perCC[c.cc] || 0) >= (confName === "UEFA" ? 3 : 4)) continue; perCC[c.cc] = (perCC[c.cc] || 0) + 1; list.push(c.id); }
    for (const c of pool) { if (list.length >= n) break; if (!list.includes(c.id)) list.push(c.id); }
    out.push(...list);
  };
  fill("UEFA", 12, G.cwcQ.ucl); fill("CSA", 6, G.cwcQ.lib); fill("AFC", 4, []); fill("CAF", 4, []); fill("CCF", 5, []); fill("OFC", 1, []);
  return out.length === 32 ? out : null;
}

/* ---------------------------- novo jogo ---------------------------- */
export function newGame({ clubId, coach = "Treinador", diff = 1, opts = {} }) {
  const G = {
    v: SAVE_VERSION, season: INIT.season, userClub: clubId, coach, diff,
    opts: { mins: 3, size: 4, autoSwitch: true, sound: true, ...opts },
    r: {}, boost: {},
    div: { A: INIT.div.A.slice(), B: INIT.div.B.slice(), C: INIT.div.C.slice(), D: INIT.div.D.slice() },
    leagues: Object.fromEntries(Object.entries(INIT.leagues).map(([k, v]) => [k, v.slice()])),
    q: {}, comps: {}, won: {}, hall: [], career: [], rank: {}, stateRank: {}, log: [], slot: -1,
    cwcQ: { lib: [findClub("Flamengo", "BR")], ucl: [findClub("PSG")] },
    stats: { j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, titles: 0 },
  };
  const byR = ids => ids.slice().sort((a, b) => R(G, b) - R(G, a) || a - b);
  G.q.states = {};
  for (const uf of UFS) { G.q.states[uf] = byR(INIT.states[uf] || []); G.stateRank[uf] = G.q.states[uf].slice(); }
  for (const cc of CSA) {
    const inCC = id => club(id).cc === cc;
    const base = [...INIT.lib.filter(inCC), ...INIT.sul.filter(inCC)];
    const rest = byR([...clubs.values()].filter(c => c.cc === cc && !base.includes(c.id)).map(c => c.id));
    G.rank[cc] = [...base, ...rest];
  }
  const fla = findClub("Flamengo", "BR"), lanus = findClub("Lanús", "AR"), cor = findClub("Corinthians", "BR");
  const cq = conmebolQual(G, fla, lanus);
  G.q.lib = cq.lib; G.q.sul = cq.sul;
  G.q.cdb = cdbQual(G, [findClub("Ponte Preta", "BR"), findClub("Barra-SC", "BR"), findClub("Paysandu", "BR"), findClub("Confiança", "BR")]);
  G.q.sup = [fla, cor];
  G.q.rec = [fla, lanus];
  G.q.ucl = uclQual(G, findClub("PSG"));
  G.q.cwc = null;
  buildSeason(G);
  return G;
}

export function buildSeason(G) {
  G.comps = {}; G.log = []; G.slot = -1;
  for (const id of ORDER) { const c = DEFS[id].create(G); if (c) G.comps[id] = c; }
  progress(G);
}

/* ---------------------------- avanço ---------------------------- */
export function progress(G) {
  let changed = true, guard = 0;
  while (changed && guard++ < 200) {
    changed = false;
    for (const id of ORDER) {
      const c = G.comps[id];
      if (!c || c.done) continue;
      const last = c.stages[c.stages.length - 1];
      if (last) settleTies(last, pensProb(G));
      if (!last || stageDone(last)) { if (DEFS[id].next(G, c) !== false) changed = true; }
    }
  }
}
function* liveMatches(G) {
  for (const id of ORDER) {
    const c = G.comps[id];
    if (!c || c.done || !c.stages.length) continue;
    const st = c.stages[c.stages.length - 1];
    for (const x of stageMatches(st)) if (!played(x)) { x.comp = c; yield x; }
  }
}
export function nextSlot(G) {
  let s = null;
  for (const x of liveMatches(G)) if (s === null || x.slot < s) s = x.slot;
  return s;
}
const matchesAt = (G, slot) => [...liveMatches(G)].filter(x => x.slot === slot);
const isUser = (G, x) => x.h === G.userClub || x.a === G.userClub;

function simOne(G, x) { const [hg, ag] = simGoals(G, x.h, x.a, x.neutral); setScore(x, hg, ag); }

// descreve um jogo do usuário para a interface
export function describe(G, x) {
  const st = x.st, c = x.comp;
  const d = { compId: c.id, comp: c.name, short: c.short, stage: st.name, h: x.h, a: x.a, neutral: !!x.neutral, slot: x.slot, date: slotLabel(x.slot, G.season), ko: !!x.ko, x };
  if (x.ko) {
    d.legs = st.legs; d.leg = x.leg;
    d.decisive = st.legs === 1 || x.leg === 1;
    if (st.legs === 2) {
      d.label = (x.leg === 0 ? "Jogo de ida" : "Jogo de volta");
      if (x.leg === 1) { const g = x.tie.g[0]; d.agg = { h: g[1], a: g[0] }; } // 1º jogo: mandante era o atual visitante
    } else d.label = "Jogo único";
  } else {
    d.label = (x.round + 1) + "ª rodada" + (x.group ? " · Grupo " + x.group.name : "");
  }
  return d;
}

// Simula tudo até o próximo jogo do usuário (sem jogá-lo).
export function step(G) {
  for (let guard = 0; guard < 400; guard++) {
    progress(G);
    const s = nextSlot(G);
    if (s === null) return { type: "end" };
    const ms = matchesAt(G, s), mine = ms.filter(x => isUser(G, x));
    if (mine.length) return { type: "match", match: describe(G, mine[0]) };
    for (const x of ms) simOne(G, x);
    G.slot = s;
  }
  return { type: "end" };
}

// Registra o resultado do jogo do usuário. res = { hg, ag, pen: [mandante, visitante] | null }
export function playUser(G, d, res) {
  const x = d.x, me = G.userClub;
  let { hg, ag, pen } = res;
  setScore(x, hg, ag);
  if (x.ko && d.decisive) {
    const [A, B] = aggregate(x.tie);
    if (A === B) {
      if (!pen) { const p = pensProb(G)(x.h, x.a); pen = rnd() < p ? [5, 4] : [4, 5]; }
      x.tie.p = x.leg === 1 ? [pen[1], pen[0]] : [pen[0], pen[1]];
    } else pen = null;
  } else pen = null;
  const mine = x.h === me ? hg : ag, theirs = x.h === me ? ag : hg;
  const S = G.stats; S.j++; S.gp += mine; S.gc += theirs;
  if (mine > theirs) S.v++; else if (mine < theirs) S.d++; else S.e++;
  G.log.push({ s: x.slot, c: d.compId, n: d.stage, l: d.label, h: x.h, a: x.a, hg, ag, p: pen });
  // resto da rodada
  const rest = matchesAt(G, x.slot);
  if (!rest.some(y => isUser(G, y))) { for (const y of rest) simOne(G, y); G.slot = x.slot; }
  progress(G);
  return { pen };
}
export function simUser(G, d) {
  const [hg, ag] = simGoals(G, d.h, d.a, d.neutral);
  return { hg, ag, ...playUser(G, d, { hg, ag, pen: null }) };
}

/* ---------------------------- consultas ---------------------------- */
export function compsOf(G, id) {
  const out = [];
  for (const cid of ORDER) {
    const c = G.comps[cid];
    if (!c) continue;
    if (c.stages.some(st => stageHas(st, id))) out.push(c);
  }
  return out;
}
export function stageHas(st, id) {
  if (st.type === "league") return st.teams.includes(id);
  if (st.type === "groups") return st.groups.some(g => g.teams.includes(id));
  return st.ties.some(t => t.a === id || t.b === id) || st.bye === id;
}
export function fixtures(G, id) {
  const out = [];
  for (const cid of ORDER) {
    const c = G.comps[cid];
    if (!c) continue;
    for (const st of c.stages) for (const x of stageMatches(st)) if (x.h === id || x.a === id) { x.comp = c; out.push(x); }
  }
  return out.sort((a, b) => a.slot - b.slot);
}
// situação do clube numa competição (texto curto)
export function standing(G, c, id) {
  let res = null;
  for (const st of c.stages) {
    if (!stageHas(st, id)) continue;
    if (st.type === "league") { const o = order(st, t => R(G, t)); res = { pos: o.indexOf(id) + 1, of: o.length, text: (o.indexOf(id) + 1) + "º lugar", stage: st.name }; }
    else if (st.type === "groups") { const g = st.groups.find(g2 => g2.teams.includes(id)); const o = order(g, t => R(G, t)); res = { pos: o.indexOf(id) + 1, of: o.length, text: (o.indexOf(id) + 1) + "º no grupo " + g.name, stage: st.name }; }
    else {
      const t = st.ties.find(t2 => t2.a === id || t2.b === id);
      if (!t) { res = { text: st.name, stage: st.name }; continue; }
      if (t.w === null) res = { text: st.name, stage: st.name };
      else if (t.w === id) res = { text: st.name === "Final" ? "Campeão" : "Classificado: " + st.name, stage: st.name, won: true };
      else res = { text: st.name === "Final" ? "Vice-campeão" : "Eliminado: " + st.name, stage: st.name, out: true };
    }
  }
  if (c.done && c.champion === id) res = { ...(res || {}), text: "Campeão", champion: true };
  else if (c.done && c.runner === id && res && !res.out) res = { ...res, text: res.pos ? res.text : "Vice-campeão" };
  return res;
}
export function titlesOf(G, id) {
  const out = [];
  for (const key of Object.keys(COMP_NAMES)) {
    const base = TITLES[key]?.[id] || 0, won = G?.won[key]?.[id] || 0;
    if (base + won > 0) out.push({ key, name: COMP_NAMES[key], n: base + won, won });
  }
  return out;
}
export function titleRanking(G, key) {
  const m = new Map();
  for (const [id, n] of Object.entries(TITLES[key] || {})) m.set(+id, n);
  for (const [id, n] of Object.entries(G?.won[key] || {})) m.set(+id, (m.get(+id) || 0) + n);
  return [...m.entries()].filter(([id]) => clubs.has(id)).sort((a, b) => b[1] - a[1] || R(G, b[0]) - R(G, a[0])).map(([id, n]) => ({ id, n, won: G?.won[key]?.[id] || 0 }));
}
export function divOf(G, id) { for (const d of "ABCD") if (G.div[d].includes(id)) return d; return ""; }

/* ---------------------------- virada de temporada ---------------------------- */
export function endSeason(G) {
  const C = G.comps, me = G.userClub, year = G.season;
  const sum = { season: year, club: me, comps: [], titles: [], champs: [], oldDiv: divOf(G, me) };
  // 1) campeões e títulos
  for (const id of ORDER) {
    const c = C[id];
    if (!c) continue;
    if (c.champion != null) {
      (G.won[id] ||= {})[c.champion] = (G.won[id][c.champion] || 0) + 1;
      G.hall.push([year, id, c.champion, c.runner]);
      sum.champs.push({ id, name: c.name, champion: c.champion, runner: c.runner });
      if (c.champion === me) sum.titles.push(id);
    }
    const s = standing(G, c, me);
    if (s) sum.comps.push({ id, name: c.name, text: s.text, champion: c.champion === me });
  }
  G.stats.titles += sum.titles.length;
  for (const uf of UFS) if (C["E_" + uf]?.x.rank) G.stateRank[uf] = C["E_" + uf].x.rank;

  // 2) acesso e descenso
  const A = C.BRA.x, B = C.BRB.x, Cc = C.BRC.x, D = C.BRD.x;
  const promoted = new Set([...B.promoted, ...Cc.promoted, ...D.promoted]);
  const relegated = new Set([...A.relegated, ...B.relegated, ...Cc.relegated]);
  const stay = d => G.div[d].filter(id => !promoted.has(id) && !relegated.has(id));
  const nA = [...stay("A"), ...B.promoted], nB = [...stay("B"), ...A.relegated, ...Cc.promoted], nC = [...stay("C"), ...B.relegated, ...D.promoted];
  const taken = new Set([...nA, ...nB, ...nC]);
  const nD = [];
  const addD = id => { if (id != null && !taken.has(id) && nD.length < 96) { taken.add(id); nD.push(id); } };
  Cc.relegated.forEach(addD);
  FED_RANK.forEach((uf, i) => {
    const quota = i === 0 ? 4 : i < 9 ? 3 : 2;
    let n = 0;
    for (const id of G.stateRank[uf] || []) { if (n >= quota) break; if (taken.has(id)) continue; addD(id); n++; }
  });
  [C.BRD.champion, C.BRD.runner, ...(D.out || [])].forEach(addD);
  [...clubs.values()].filter(c => c.cc === "BR").sort((a, b) => R(G, b.id) - R(G, a.id)).forEach(c => addD(c.id));
  const oldDivs = {}; for (const d of "ABCD") for (const id of G.div[d]) oldDivs[id] = d;
  G.div = { A: nA, B: nB, C: nC, D: nD };
  sum.newDiv = divOf(G, me);
  sum.promoted = promoted.has(me); sum.relegated = relegated.has(me) || (sum.oldDiv === "D" && sum.newDiv === "");
  sum.moves = { upA: B.promoted, downA: A.relegated, upB: Cc.promoted, downB: B.relegated, upC: D.promoted, downC: Cc.relegated };

  // 3) estaduais: clubes de divisão nacional fora da elite estadual sobem no lugar dos últimos
  const newDivs = {}; for (const d of "ABCD") for (const id of G.div[d]) newDivs[id] = d;
  for (const uf of UFS) {
    const roster = (G.stateRank[uf] || []).slice();
    if (!roster.length) continue;
    const cands = [...clubs.values()].filter(c => c.cc === "BR" && c.uf === uf && newDivs[c.id] && !roster.includes(c.id)).sort((a, b) => R(G, b.id) - R(G, a.id)).slice(0, 2);
    for (const cand of cands) {
      let idx = -1;
      for (let i = roster.length - 1; i >= 0; i--) if (!newDivs[roster[i]] && roster[i] !== me) { idx = i; break; }
      if (idx < 0) break;
      roster.splice(idx, 1); roster.push(cand.id);
    }
    G.q.states[uf] = roster;
  }

  // 4) vagas continentais
  const libChamp = C.LIB.champion, sulChamp = C.SUL.champion, cont = [libChamp, sulChamp];
  const aOrder = A.order.filter(id => !cont.includes(id));
  const br = [], push = id => { if (id != null && !br.includes(id) && !cont.includes(id)) br.push(id); };
  push(C.CDB.champion);
  for (const id of aOrder) { if (br.length >= 5) break; push(id); }
  push(C.CDB.runner);
  for (const id of aOrder) { if (br.length >= 7) break; push(id); }
  for (const id of aOrder) { if (br.length >= 13) break; push(id); }
  sum.lib = br.slice(0, 7).concat(cont.filter(id => id != null && club(id).cc === "BR")); sum.sul = br.slice(7, 13);
  G.rank.BR = br.concat(byRating(G, [...clubs.values()].filter(c => c.cc === "BR" && !br.includes(c.id) && newDivs[c.id] === "A").map(c => c.id)));
  for (const cc of CSA) if (cc !== "BR") G.rank[cc] = [...clubs.values()].filter(c => c.cc === cc).map(c => [c.id, R(G, c.id) + gauss() * 4]).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  const cq = conmebolQual(G, libChamp, sulChamp);
  G.q.lib = cq.lib; G.q.sul = cq.sul;

  // 5) copas nacionais
  G.q.cdb = cdbQual(G, [C.BRC.champion, C.BRD.champion, C.BRC.runner, C.BRD.runner]);
  G.q.sup = [C.BRA.champion, C.CDB.champion !== C.BRA.champion ? C.CDB.champion : C.BRA.runner];
  G.q.rec = [libChamp, sulChamp];

  // 6) Europa e Mundial
  G.q.ucl = uclQual(G, C.UCL.champion);
  G.cwcQ.lib.push(libChamp); G.cwcQ.ucl.push(C.UCL.champion);
  G.cwcQ.lib = G.cwcQ.lib.slice(-4); G.cwcQ.ucl = G.cwcQ.ucl.slice(-4);
  G.q.cwc = isCwcYear(year + 1) ? cwcQual(G) : null;

  // 7) evolução da força dos clubes
  const champsOf = new Map();
  for (const ch of sum.champs) champsOf.set(ch.champion, (champsOf.get(ch.champion) || 0) + 1);
  if (sum.titles.length || sum.promoted || sum.relegated) {
    G.boost[me] = clamp((G.boost[me] || 0) + Math.min(1, sum.titles.length * 0.4) + (sum.promoted ? 0.8 : 0) - (sum.relegated ? 0.6 : 0), -3, 6);
  }
  const top4 = new Set(A.order.slice(0, 4));
  for (const c of clubs.values()) {
    let r = R(G, c.id), anchor = c.r0;
    if (c.cc === "BR") {
      const od = initDiv[c.id] || "", nd = newDivs[c.id] || "";
      anchor += (DIV_TARGET[nd] - DIV_TARGET[od]) * 0.7 + (G.boost[c.id] || 0);
      r += 0.2 * (anchor - r) + gauss() * 0.9;
      if (promoted.has(c.id)) r += 0.8;
      if (relegated.has(c.id)) r -= 0.8;
      if (top4.has(c.id)) r += 0.4;
    } else r += 0.18 * (anchor - r) + gauss() * 0.9;
    r += Math.min(1.2, (champsOf.get(c.id) || 0) * 0.5);
    G.r[c.id] = Math.round(clamp(r, 36, 97) * 10) / 10;
  }

  // 8) carreira
  const rec = { j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 };
  for (const m of G.log) {
    const mine = m.h === me ? m.hg : m.ag, th = m.h === me ? m.ag : m.hg;
    rec.j++; rec.gp += mine; rec.gc += th;
    if (mine > th) rec.v++; else if (mine < th) rec.d++; else rec.e++;
  }
  const nat = ["BRA", "BRB", "BRC", "BRD", ...Object.keys(EU_LEAGUES)].map(id => C[id]).find(c => c && stageHas(c.stages[0], me));
  const natPos = nat ? standing(G, nat, me) : null;
  G.career.push({ y: year, club: me, div: sum.oldDiv, league: nat ? nat.short : "", pos: nat ? (nat.stages[0].type === "league" ? order(nat.stages[0], t => R(G, t)).indexOf(me) + 1 : null) : null, posText: natPos?.text || "", titles: sum.titles, ...rec });
  sum.record = rec;

  // 9) nova temporada
  G.season = year + 1;
  buildSeason(G);
  return sum;
}
function byRating(G, ids) { return ids.slice().sort((a, b) => R(G, b) - R(G, a) || a - b); }

export function changeClub(G, id) { G.userClub = id; }

/* ---------------------------- salvar / carregar ---------------------------- */
const KEY = "mundialhax.save.v1";
export function save(G) {
  try { localStorage.setItem(KEY, JSON.stringify(G)); return true; } catch (e) { console.warn("Falha ao salvar", e); return false; }
}
export function load() {
  try {
    const s = localStorage.getItem(KEY);
    if (!s) return null;
    const G = JSON.parse(s);
    if (G.v !== SAVE_VERSION || !clubs.has(G.userClub)) return null;
    return G;
  } catch (e) { return null; }
}
export function wipe() { try { localStorage.removeItem(KEY); } catch (e) { /* sem armazenamento */ } }
