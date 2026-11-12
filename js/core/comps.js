// Definições das competições (formatos de 2026) e calendário da temporada.
import { M, W, range, mkLeague, mkGroups, mkKO, order, winners, losers, pairUp } from "./stages.js";
import { clubs, club, conf, STATE_NAMES, GEO } from "./db.js";
import { rnd, shuffle, gauss } from "./rng.js";

const sorted = a => a.slice().sort((x, y) => x - y);

// Calendário: semana 1 = primeiro fim de semana de janeiro. M = meio de semana, W = fim de semana.
export const CAL = {
  STATE: [M(2), W(2), M(3), W(3), M(4), W(4), W(5), W(6), W(7), W(8), M(9), W(9), W(10)],
  A: sorted([M(5), M(6), M(7), M(17), M(30), ...range(11, 23).map(W), ...range(28, 47).map(W)]),
  B: sorted([...range(12, 23).map(W), ...range(28, 47).map(W), M(15), M(18), M(23), M(30), M(39), M(45)]),
  B_PO: [W(48), M(49)],
  C: [...range(14, 23).map(W), ...range(28, 36).map(W)],
  C_Q: range(37, 42).map(W),
  C_F: [W(43), W(44)],
  D: range(14, 23).map(W),
  D_KO: [[W(28), W(29)], [W(30), W(31)], [W(32), W(33)], [W(34), W(35)], [W(36), W(37)], [W(38), W(39)]],
  CDB: [[M(8)], [M(10)], [M(12)], [M(13)], [M(20), M(22)], [M(33), M(34)], [M(37), M(38)], [M(42), M(43)], [W(49)]],
  SUP: [W(1)],
  LIB_P: [[M(6), M(7)], [M(8), M(10)], [M(11), M(12)]],
  CONT_G: [M(14), M(15), M(16), M(18), M(19), M(21)],
  SUL_P1: [M(10)],
  SUL_PO: [M(28), M(29)],
  CONT_KO: [[M(31), M(32)], [M(35), M(36)], [M(40), M(41)]],
  LIB_F: [W(48)],
  SUL_F: [M(46)],
  REC: [M(11), M(12)],
  EU: [...range(6, 23).map(W), ...range(28, 47).map(W)],
  UCL_L: [M(12), M(14), M(16), M(18), M(20), M(22), M(29), M(31)],
  UCL_KO: [[M(33), M(34)], [M(36), M(37)], [M(39), M(40)], [M(42), M(43)]],
  UCL_F: [W(49)],
  CWC_G: [W(24), M(25), W(25)],
  CWC_KO: [[M(26)], [W(26)], [M(27)], [W(27)]],
  INT: [[M(50)], [W(50)], [M(51)]],
};

// Data aproximada de um "slot" (para exibição).
export function slotDate(slot, season) {
  const w = Math.floor(slot / 2), weekend = slot % 2 === 1;
  const d = new Date(Date.UTC(season, 0, 4 + (w - 1) * 7 - (weekend ? 0 : 4)));
  return d;
}
export function slotLabel(slot, season) {
  const d = slotDate(slot, season);
  return String(d.getUTCDate()).padStart(2, "0") + "/" + String(d.getUTCMonth() + 1).padStart(2, "0");
}

export const R = (G, id) => G.r[id] ?? club(id)?.r0 ?? 50;
const rt = G => id => R(G, id);
const ord = (G, g) => order(g, rt(G));
const byRating = (G, ids) => ids.slice().sort((a, b) => R(G, b) - R(G, a) || a - b);

function mk(id, name, short, extra = {}) {
  return { id, name, short: short || name, stages: [], done: false, champion: null, runner: null, x: {}, ...extra };
}
function finish(c, champion, runner) { c.done = true; c.champion = champion ?? null; c.runner = runner ?? null; }

// sorteio com cabeças de chave: melhores x piores; o pior manda o jogo único / a ida
function drawPairs(G, ids) {
  const s = byRating(G, ids), half = s.length / 2;
  const top = s.slice(0, half), bottom = shuffle(s.slice(half));
  return top.map((t, i) => [bottom[i], t]);
}
// chaveamento: vencedores adjacentes se enfrentam; o de maior força decide em casa
function bracket(G, ws, legs = 2) {
  return pairUp(ws).map(([a, b]) => { const hi = R(G, a) >= R(G, b) ? a : b, lo = hi === a ? b : a; return legs === 2 ? [lo, hi] : [hi, lo]; });
}
function drawGroups(G, ids, n) {
  const s = byRating(G, ids), per = s.length / n;
  let best = null, bestClash = 1e9;
  for (let attempt = 0; attempt < 40; attempt++) {
    const gs = Array.from({ length: n }, () => []);
    for (let p = 0; p < per; p++) shuffle(s.slice(p * n, (p + 1) * n)).forEach((t, i) => gs[i].push(t));
    let clash = 0;
    for (const g of gs) { const cc = g.map(t => club(t).cc); clash += cc.length - new Set(cc).size; }
    if (clash < bestClash) { best = gs; bestClash = clash; if (!clash) break; }
  }
  return best;
}
// fase eliminatória genérica com suporte a número ímpar (o melhor avança direto)
function koRound(G, c, name, ids, opt) {
  let bye = null;
  if (ids.length % 2) { const s = byRating(G, ids); bye = s[0]; ids = s.slice(1); }
  const st = mkKO(name, drawPairs(G, ids), opt);
  if (bye !== null) st.bye = bye;
  c.stages.push(st);
}
const adv = st => (st.bye !== undefined ? [...winners(st), st.bye] : winners(st));

/* ------------------------------------------------------------------ */
/* Ligas nacionais                                                     */
/* ------------------------------------------------------------------ */
const DEFS = {};

DEFS.BRA = {
  create(G) {
    const c = mk("BRA", "Brasileirão Série A", "Série A", { country: "BR", tier: 1 });
    c.stages.push(mkLeague("Pontos corridos", G.div.A, { double: true, slots: CAL.A, zones: [[1, 4, "lib"], [5, 5, "pre"], [6, 11, "sul"], [17, 20, "down"]] }));
    return c;
  },
  next(G, c) { const o = ord(G, c.stages[0]); c.x.order = o; c.x.relegated = o.slice(-4); finish(c, o[0], o[1]); },
};

DEFS.BRB = {
  create(G) {
    const c = mk("BRB", "Brasileirão Série B", "Série B", { country: "BR", tier: 2 });
    c.stages.push(mkLeague("Pontos corridos", G.div.B, { double: true, slots: CAL.B, zones: [[1, 2, "up"], [3, 6, "po"], [17, 20, "down"]] }));
    return c;
  },
  next(G, c) {
    const o = ord(G, c.stages[0]);
    if (c.stages.length === 1) {
      c.x.order = o;
      c.stages.push(mkKO("Playoff de acesso", [[o[5], o[2]], [o[4], o[3]]], { legs: 2, slots: CAL.B_PO }));
    } else {
      c.x.promoted = [o[0], o[1], ...winners(c.stages[1])];
      c.x.relegated = o.slice(-4);
      finish(c, o[0], o[1]);
    }
  },
};

// Série C: 20 clubes em 2026, 24 em 2027 e 28 a partir de 2028.
export const serieCSize = season => (season <= 2026 ? 20 : season === 2027 ? 24 : 28);
DEFS.BRC = {
  create(G) {
    const c = mk("BRC", "Brasileirão Série C", "Série C", { country: "BR", tier: 3 });
    const n = G.div.C.length, down = Math.max(2, n + 6 - serieCSize(G.season + 1));
    c.x.down = down;
    c.stages.push(mkLeague("Primeira fase", G.div.C, { rounds: 19, slots: CAL.C, zones: [[1, 8, "q"], [n - down + 1, n, "down"]] }));
    return c;
  },
  next(G, c) {
    const n = c.stages.length;
    if (n === 1) {
      const o = c.x.order = ord(G, c.stages[0]);
      c.stages.push(mkGroups("Quadrangulares", [[o[0], o[3], o[4], o[7]], [o[1], o[2], o[5], o[6]]], { double: true, slots: CAL.C_Q, zones: [[1, 2, "up"]] }));
    } else if (n === 2) {
      const [a, b] = c.stages[1].groups.map(g => ord(G, g));
      c.x.promoted = [a[0], a[1], b[0], b[1]];
      const o = c.x.order, hi = o.indexOf(a[0]) < o.indexOf(b[0]) ? a[0] : b[0], lo = hi === a[0] ? b[0] : a[0];
      c.stages.push(mkKO("Final", [[lo, hi]], { legs: 2, slots: CAL.C_F }));
    } else {
      const t = c.stages[2].ties[0];
      c.x.relegated = c.x.order.slice(-c.x.down);
      finish(c, t.w, t.w === t.a ? t.b : t.a);
    }
  },
};

DEFS.BRD = {
  create(G) {
    const c = mk("BRD", "Brasileirão Série D", "Série D", { country: "BR", tier: 4 });
    const teams = G.div.D, ng = Math.floor(teams.length / 6);
    // grupos regionais: ordena por geografia e fatia de 6 em 6
    const s = teams.slice().sort((a, b) => GEO.indexOf(club(a).uf) - GEO.indexOf(club(b).uf) || a - b);
    const groups = Array.from({ length: ng }, (_, i) => s.slice(i * 6, i * 6 + 6));
    c.stages.push(mkGroups("Primeira fase", groups, { double: true, slots: CAL.D, zones: [[1, 4, "q"]], names: groups.map((_, i) => "A" + (i + 1)) }));
    return c;
  },
  next(G, c) {
    const n = c.stages.length, names = ["Segunda fase", "Terceira fase", "Oitavas de final", "Quartas de final", "Semifinais", "Final"];
    const last = c.stages[n - 1];
    if (n === 1) {
      const gs = last.groups.map(g => ord(G, g)), pairs = [];
      for (let i = 0; i + 1 < gs.length; i += 2) {
        const a = gs[i], b = gs[i + 1];
        pairs.push([b[3], a[0]], [a[2], b[1]], [a[3], b[0]], [b[2], a[1]]);
      }
      c.x.out = gs.flatMap(g => g.slice(4));
      c.stages.push(mkKO(names[0], pairs, { legs: 2, slots: CAL.D_KO[0] }));
    } else if (n <= 4) {
      c.x.out = [...losers(last), ...c.x.out];
      c.stages.push(mkKO(names[n - 1], bracket(G, winners(last)), { legs: 2, slots: CAL.D_KO[n - 1] }));
    } else if (n === 5) {
      // semifinais + playoff de acesso entre os eliminados nas quartas
      const sf = bracket(G, winners(last)), po = bracket(G, losers(last));
      c.stages.push(mkKO("Semifinais e playoff de acesso", [...sf, ...po], { legs: 2, slots: CAL.D_KO[4], tags: ["", "", "po", "po"] }));
    } else if (n === 6) {
      const sf = last.ties.filter(t => t.tag !== "po"), po = last.ties.filter(t => t.tag === "po");
      c.x.promoted = [...sf.flatMap(t => [t.a, t.b]), ...po.map(t => t.w)];
      c.x.out = [...po.map(t => (t.w === t.a ? t.b : t.a)), ...c.x.out];
      c.stages.push(mkKO("Final", bracket(G, sf.map(t => t.w)), { legs: 2, slots: CAL.D_KO[5] }));
    } else {
      const t = last.ties[0];
      // ordem de desempenho dos não promovidos (usada para as vagas na Série D seguinte)
      finish(c, t.w, t.w === t.a ? t.b : t.a);
    }
  },
};

/* ------------------------------------------------------------------ */
/* Estaduais                                                           */
/* ------------------------------------------------------------------ */
function stateFormat(n) {
  if (n >= 14) return { rounds: 8, double: false, ko: [["Quartas de final", 8, 1], ["Semifinais", 4, 1], ["Final", 2, 2]] };
  if (n >= 12) return { rounds: 7, double: false, ko: [["Quartas de final", 8, 1], ["Semifinais", 4, 2], ["Final", 2, 2]] };
  if (n >= 7) return { rounds: undefined, double: false, ko: [["Semifinais", 4, 2], ["Final", 2, 2]] };
  return { rounds: undefined, double: true, ko: [["Final", 2, 2]] };
}
function stateDef(uf) {
  const id = "E_" + uf;
  return {
    create(G) {
      const teams = G.q.states[uf];
      if (!teams || teams.length < 4) return null;
      const adj = STATE_NAMES[uf], name = uf === "DF" ? "Candangão" : "Campeonato " + adj;
      const c = mk(id, name, uf === "DF" ? "Candangão" : adj, { country: "BR", uf, state: true });
      const f = stateFormat(teams.length);
      const nLeague = f.rounds ?? (teams.length % 2 ? teams.length : teams.length - 1) * (f.double ? 2 : 1);
      const need = nLeague + f.ko.reduce((s, k) => s + k[2], 0);
      const slots = CAL.STATE.slice(Math.max(0, CAL.STATE.length - need));
      c.x.fmt = f; c.x.koSlots = slots.slice(nLeague);
      c.stages.push(mkLeague("Primeira fase", teams, { double: f.double, rounds: f.rounds, slots, zones: [[1, f.ko[0][1], "q"]] }));
      return c;
    },
    next(G, c) {
      const f = c.x.fmt, n = c.stages.length, last = c.stages[n - 1];
      const orient = (a, b, legs) => { const hi = c.x.order.indexOf(a) < c.x.order.indexOf(b) ? a : b, lo = hi === a ? b : a; return legs === 2 ? [lo, hi] : [hi, lo]; };
      if (n === 1) c.x.order = ord(G, last);
      if (n - 1 < f.ko.length) {
        const [name, size, legs] = f.ko[n - 1];
        let pairs;
        if (n === 1) {
          const o = c.x.order.slice(0, size);
          const seeds = size === 8 ? [[0, 7], [3, 4], [1, 6], [2, 5]] : size === 4 ? [[0, 3], [1, 2]] : [[0, 1]];
          pairs = seeds.map(([i, j]) => orient(o[i], o[j], legs));
        } else pairs = pairUp(winners(last)).map(([a, b]) => orient(a, b, legs));
        const used = f.ko.slice(0, n - 1).reduce((s, k) => s + k[2], 0);
        c.stages.push(mkKO(name, pairs, { legs, slots: c.x.koSlots.slice(used, used + legs) }));
      } else {
        const t = last.ties[0], champ = t.w, vice = t.w === t.a ? t.b : t.a;
        // classificação final: campeão, vice, eliminados nas fases anteriores e demais pela 1ª fase
        const rank = [champ, vice];
        for (let i = c.stages.length - 2; i >= 1; i--) rank.push(...losers(c.stages[i]).sort((a, b) => c.x.order.indexOf(a) - c.x.order.indexOf(b)));
        for (const t2 of c.x.order) if (!rank.includes(t2)) rank.push(t2);
        c.x.rank = rank;
        finish(c, champ, vice);
      }
    },
  };
}
export const UFS = Object.keys(STATE_NAMES);
for (const uf of UFS) DEFS["E_" + uf] = stateDef(uf);

/* ------------------------------------------------------------------ */
/* Copas nacionais                                                     */
/* ------------------------------------------------------------------ */
DEFS.CDB = {
  create(G) {
    const q = G.q.cdb, c = mk("CDB", "Copa do Brasil", "Copa do Brasil", { country: "BR", cup: true });
    const others = q.others.slice();
    const direct2 = others.slice(0, Math.min(74, others.length)), first = others.slice(direct2.length);
    c.x.wait = [direct2, q.third.slice(), [], q.late.slice()];
    if (first.length >= 2) koRound(G, c, "Primeira fase", first, { legs: 1, slots: CAL.CDB[0] });
    else { c.x.wait[0] = others; c.stages.push(mkKO("Primeira fase", [], { legs: 1, slots: CAL.CDB[0] })); }
    return c;
  },
  next(G, c) {
    const n = c.stages.length, last = c.stages[n - 1];
    const names = ["Primeira fase", "Segunda fase", "Terceira fase", "Quarta fase", "Quinta fase", "Oitavas de final", "Quartas de final", "Semifinais", "Final"];
    if (n < 9) {
      const ids = [...adv(last), ...(c.x.wait[n - 1] || [])];
      const legs = n >= 4 && n < 8 ? 2 : 1;
      if (n === 8) c.stages.push(mkKO("Final", [[ids[0], ids[1]]], { legs: 1, slots: CAL.CDB[8], neutral: true }));
      else koRound(G, c, names[n], ids, { legs, slots: CAL.CDB[n] });
    } else { const t = last.ties[0]; finish(c, t.w, t.w === t.a ? t.b : t.a); }
  },
};

DEFS.SUP = {
  create(G) {
    const q = G.q.sup;
    if (!q || q.length < 2) return null;
    const c = mk("SUP", "Supercopa Rei", "Supercopa", { country: "BR", cup: true });
    c.stages.push(mkKO("Final", [[q[0], q[1]]], { legs: 1, slots: CAL.SUP, neutral: true }));
    return c;
  },
  next(G, c) { const t = c.stages[0].ties[0]; finish(c, t.w, t.w === t.a ? t.b : t.a); },
};

/* ------------------------------------------------------------------ */
/* CONMEBOL                                                            */
/* ------------------------------------------------------------------ */
function r16Draw(G, firsts, seconds, groupOf) {
  for (let i = 0; i < 60; i++) {
    const s = shuffle(seconds);
    if (i === 59 || s.every((t, k) => groupOf(t) !== groupOf(firsts[k]))) return s.map((t, k) => [t, firsts[k]]);
  }
}
function contKO(G, c, base, finalSlots) {
  // base = índice da fase de oitavas dentro de c.stages
  const n = c.stages.length, last = c.stages[n - 1], k = n - base;
  if (k === 1 || k === 2) c.stages.push(mkKO(k === 1 ? "Quartas de final" : "Semifinais", bracket(G, winners(last)), { legs: 2, slots: CAL.CONT_KO[k] }));
  else if (k === 3) { const w = winners(last); c.stages.push(mkKO("Final", [[w[0], w[1]]], { legs: 1, slots: finalSlots, neutral: true })); }
  else { const t = last.ties[0]; finish(c, t.w, t.w === t.a ? t.b : t.a); }
}

DEFS.LIB = {
  create(G) {
    const q = G.q.lib, c = mk("LIB", "Copa Libertadores", "Libertadores", { cont: "CSA", cup: true });
    c.stages.push(mkKO("Primeira fase", drawPairs(G, q.P1), { legs: 2, slots: CAL.LIB_P[0] }));
    return c;
  },
  next(G, c) {
    const q = G.q.lib, n = c.stages.length, last = c.stages[n - 1];
    if (n === 1) c.stages.push(mkKO("Segunda fase", drawPairs(G, [...winners(last), ...q.P2]), { legs: 2, slots: CAL.LIB_P[1] }));
    else if (n === 2) c.stages.push(mkKO("Terceira fase", drawPairs(G, winners(last)), { legs: 2, slots: CAL.LIB_P[2] }));
    else if (n === 3) {
      c.x.p3losers = losers(last);
      c.stages.push(mkGroups("Fase de grupos", drawGroups(G, [...q.G, ...winners(last)], 8), { double: true, slots: CAL.CONT_G, zones: [[1, 2, "q"], [3, 3, "sul"]] }));
    } else if (n === 4) {
      const gs = last.groups.map(g => ord(G, g));
      c.x.thirds = gs.map(g => g[2]);
      const gi = t => gs.findIndex(g => g.includes(t));
      c.stages.push(mkKO("Oitavas de final", r16Draw(G, gs.map(g => g[0]), gs.map(g => g[1]), gi), { legs: 2, slots: CAL.CONT_KO[0] }));
    } else contKO(G, c, 4, CAL.LIB_F);
  },
};

DEFS.SUL = {
  create(G) {
    const q = G.q.sul, c = mk("SUL", "Copa Sul-Americana", "Sul-Americana", { cont: "CSA", cup: true });
    c.stages.push(mkKO("Primeira fase", q.P1, { legs: 1, slots: CAL.SUL_P1 }));
    return c;
  },
  next(G, c) {
    const q = G.q.sul, n = c.stages.length, last = c.stages[n - 1], lib = G.comps.LIB;
    if (n === 1) {
      if (!lib.x.p3losers) return false;
      c.stages.push(mkGroups("Fase de grupos", drawGroups(G, [...q.G, ...winners(last), ...lib.x.p3losers], 8), { double: true, slots: CAL.CONT_G, zones: [[1, 1, "q"], [2, 2, "po"]] }));
    } else if (n === 2) {
      if (!lib.x.thirds) return false;
      const gs = last.groups.map(g => ord(G, g));
      c.x.firsts = gs.map(g => g[0]);
      const thirds = shuffle(lib.x.thirds);
      c.stages.push(mkKO("Playoffs", gs.map((g, i) => [thirds[i], g[1]]), { legs: 2, slots: CAL.SUL_PO }));
    } else if (n === 3) {
      const ws = shuffle(winners(last));
      c.stages.push(mkKO("Oitavas de final", c.x.firsts.map((f, i) => [ws[i], f]), { legs: 2, slots: CAL.CONT_KO[0] }));
    } else contKO(G, c, 3, CAL.SUL_F);
  },
};

DEFS.REC = {
  create(G) {
    const q = G.q.rec;
    if (!q || q.length < 2 || q[0] === q[1]) return null;
    const c = mk("REC", "Recopa Sul-Americana", "Recopa", { cont: "CSA", cup: true });
    c.stages.push(mkKO("Final", [[q[1], q[0]]], { legs: 2, slots: CAL.REC }));
    return c;
  },
  next(G, c) { const t = c.stages[0].ties[0]; finish(c, t.w, t.w === t.a ? t.b : t.a); },
};

/* ------------------------------------------------------------------ */
/* Europa                                                              */
/* ------------------------------------------------------------------ */
export const EU_LEAGUES = { ENG: ["Premier League", "GB", 5], ESP: ["La Liga", "ES", 5], ITA: ["Serie A (Itália)", "IT", 4], GER: ["Bundesliga", "DE", 4], FRA: ["Ligue 1", "FR", 3] };
for (const [id, [name, cc, ucl]] of Object.entries(EU_LEAGUES)) {
  DEFS[id] = {
    create(G) {
      const c = mk(id, name, name, { country: cc, tier: 1 });
      const t = G.leagues[id];
      c.stages.push(mkLeague("Pontos corridos", t, { double: true, slots: CAL.EU, zones: [[1, ucl, "q"]] }));
      return c;
    },
    next(G, c) { const o = ord(G, c.stages[0]); c.x.order = o; finish(c, o[0], o[1]); },
  };
}

DEFS.UCL = {
  create(G) {
    const c = mk("UCL", "Liga dos Campeões", "Champions", { cont: "UEFA", cup: true });
    c.stages.push(mkLeague("Fase de liga", G.q.ucl, { rounds: 8, slots: CAL.UCL_L, zones: [[1, 8, "q"], [9, 24, "po"]] }));
    return c;
  },
  next(G, c) {
    const n = c.stages.length, last = c.stages[n - 1];
    if (n === 1) {
      const o = c.x.order = ord(G, last);
      c.stages.push(mkKO("Playoffs", range(0, 7).map(i => [o[23 - i], o[8 + i]]), { legs: 2, slots: CAL.UCL_KO[0] }));
    } else if (n === 2) {
      const ws = winners(last).sort((a, b) => c.x.order.indexOf(b) - c.x.order.indexOf(a));
      c.stages.push(mkKO("Oitavas de final", ws.map((w, i) => [w, c.x.order[i]]), { legs: 2, slots: CAL.UCL_KO[1] }));
    } else if (n === 3 || n === 4) c.stages.push(mkKO(n === 3 ? "Quartas de final" : "Semifinais", bracket(G, winners(last)), { legs: 2, slots: CAL.UCL_KO[n - 1] }));
    else if (n === 5) { const w = winners(last); c.stages.push(mkKO("Final", [[w[0], w[1]]], { legs: 1, slots: CAL.UCL_F, neutral: true })); }
    else { const t = last.ties[0]; finish(c, t.w, t.w === t.a ? t.b : t.a); }
  },
};

/* ------------------------------------------------------------------ */
/* Mundiais                                                            */
/* ------------------------------------------------------------------ */
export const isCwcYear = season => season >= 2029 && (season - 2029) % 4 === 0;
DEFS.CWC = {
  create(G) {
    if (!isCwcYear(G.season) || !G.q.cwc || G.q.cwc.length !== 32) return null;
    const c = mk("CWC", "Copa do Mundo de Clubes", "Mundial de Clubes", { world: true, cup: true });
    c.stages.push(mkGroups("Fase de grupos", drawGroups(G, G.q.cwc, 8), { slots: CAL.CWC_G, zones: [[1, 2, "q"]] }));
    return c;
  },
  next(G, c) {
    const n = c.stages.length, last = c.stages[n - 1], names = ["Oitavas de final", "Quartas de final", "Semifinais", "Final"];
    const opt = { legs: 1, neutral: true, slots: CAL.CWC_KO[n - 1] };
    if (n === 1) {
      const gs = last.groups.map(g => ord(G, g)), pairs = [];
      for (let i = 0; i < 8; i += 2) pairs.push([gs[i][0], gs[i + 1][1]], [gs[i + 1][0], gs[i][1]]);
      // cruza as chaves para que os dois primeiros de um grupo só se reencontrem na final
      c.stages.push(mkKO(names[0], [pairs[0], pairs[2], pairs[4], pairs[6], pairs[1], pairs[3], pairs[5], pairs[7]], opt));
    } else if (n <= 4) c.stages.push(mkKO(names[n - 1], pairUp(winners(last)), opt));
    else { const t = last.ties[0]; finish(c, t.w, t.w === t.a ? t.b : t.a); }
  },
};

export function pickFrom(G, confName, n, exclude = []) {
  const pool = [...clubs.values()].filter(c => conf(c.cc) === confName && !exclude.includes(c.id)).map(c => c.id);
  return pool.map(id => [id, R(G, id) + gauss() * 3]).sort((a, b) => b[1] - a[1]).slice(0, n).map(x => x[0]);
}
DEFS.INT = {
  create() { return mk("INT", "Copa Intercontinental", "Intercontinental", { world: true, cup: true }); },
  next(G, c) {
    const n = c.stages.length, opt = k => ({ legs: 1, neutral: true, slots: CAL.INT[k] });
    if (n === 0) {
      const lib = G.comps.LIB, ucl = G.comps.UCL;
      if (!lib?.done || !ucl?.done) return false;
      c.x.ucl = ucl.champion;
      const [ccf] = pickFrom(G, "CCF", 1), [afc] = pickFrom(G, "AFC", 1), [caf] = pickFrom(G, "CAF", 1);
      c.stages.push(mkKO("Dérbi das Américas / Copa África-Ásia", [[lib.champion, ccf], [afc, caf]], opt(0)));
    } else if (n === 1) c.stages.push(mkKO("Copa Challenger", pairUp(winners(c.stages[0])), opt(1)));
    else if (n === 2) c.stages.push(mkKO("Final", [[winners(c.stages[1])[0], c.x.ucl]], opt(2)));
    else { const t = c.stages[2].ties[0]; finish(c, t.w, t.w === t.a ? t.b : t.a); }
  },
};

export const ORDER = ["BRA", "BRB", "BRC", "BRD", "CDB", "SUP", ...UFS.map(u => "E_" + u), "LIB", "SUL", "REC", "CWC", "INT", "UCL", "ENG", "ESP", "ITA", "GER", "FRA"];
export { DEFS };
// chave usada na contagem de títulos
export const titleKey = id => id;
export const COMP_NAMES = {
  BRA: "Brasileirão Série A", BRB: "Brasileirão Série B", BRC: "Brasileirão Série C", BRD: "Brasileirão Série D", CDB: "Copa do Brasil", SUP: "Supercopa Rei",
  LIB: "Copa Libertadores", SUL: "Copa Sul-Americana", REC: "Recopa Sul-Americana", CWC: "Copa do Mundo de Clubes", INT: "Copa Intercontinental", UCL: "Liga dos Campeões",
  ENG: "Premier League", ESP: "La Liga", ITA: "Serie A (Itália)", GER: "Bundesliga", FRA: "Ligue 1",
  ...Object.fromEntries(UFS.map(u => ["E_" + u, u === "DF" ? "Candangão" : "Campeonato " + STATE_NAMES[u]])),
};
