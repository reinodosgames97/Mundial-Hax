// Testa os controles do jogador humano no motor (sem tela): passe antecipado (toque de primeira),
// enfiada, troca de jogador pelo botão e pelo analógico direito.
import { Game, F } from "../js/game/engine.js";
import { matchTeam, defaultFormation } from "../js/core/squads.js";
import { findClub, club } from "../js/core/db.js";
import { seed } from "../js/core/rng.js";

const team = n => { const id = findClub(n, "BR"); return matchTeam(id, club(id).r0, defaultFormation(id)); };
let fails = 0;
const check = (ok, what) => { console.log((ok ? "OK    " : "FALHA ") + what); if (!ok) fails++; };
const NONE = { x: 0, y: 0, rx: 0, ry: 0, pass: false, lob: false, shoot: false, through: false, sw: false, mod: false, sprint: false };
const hyp = Math.hypot;

function newGame(s, opp = 0.05) {
  seed(s);
  const g = new Game({ teams: [team("Flamengo"), team("Corinthians")], human: 0, diff: 1, mins: 6, levels: [0.6, opp] });
  // espera a saída de bola ficar pronta para o humano
  for (let i = 0; i < 400 && !(g.setPiece && g.ball.owner === g.ctrl); i++) g.tick(NONE);
  return g;
}
// segura um botão por n ticks e solta
function press(g, btn, n, stick = [0, 0], extra = {}) {
  for (let i = 0; i < n; i++) g.tick({ ...NONE, x: stick[0], y: stick[1], [btn]: true, ...extra });
  g.tick({ ...NONE, x: stick[0], y: stick[1], ...extra });
}
const dirTo = (a, b) => { const l = hyp(b.x - a.x, b.y - a.y) || 1; return [(b.x - a.x) / l, (b.y - a.y) / l]; };

/* 1) passe antecipado: aperta passe enquanto a bola ainda vai para o companheiro */
{
  let ok = 0, tries = 0;
  for (let s = 1; s <= 8; s++) {
    const g = newGame(s);
    const c = g.ctrl, mates = g.teams[0].filter(p => p !== c && !p.isGK);
    const r1 = mates.sort((a, b) => hyp(a.x - c.x, a.y - c.y) - hyp(b.x - c.x, b.y - c.y))[0];
    press(g, "pass", 3, dirTo(c, r1));
    if (g.ball.target !== r1) continue;
    tries++;
    const passes0 = g.stats.passes[0];
    // durante o trajeto: aponta para outro companheiro e aperta/solta o passe
    g.tick(NONE); g.tick(NONE);
    const r2 = g.teams[0].filter(p => p !== r1 && p !== c && !p.isGK).sort((a, b) => hyp(a.x - r1.x, a.y - r1.y) - hyp(b.x - r1.x, b.y - r1.y))[0];
    press(g, "pass", 3, dirTo(r1, r2));
    const queued = !!g.queued && g.ball.owner !== r1;
    let fired = false;
    for (let i = 0; i < 150 && !fired; i++) { g.tick(NONE); if (g.stats.passes[0] > passes0) fired = true; }
    if (queued && fired && g.ball.last === r1) ok++;
  }
  check(tries > 0 && ok === tries, `passe antecipado sai de primeira quando o companheiro domina (${ok}/${tries})`);
}

/* 2) enfiada: bola no espaço à frente do atacante que está na linha da defesa */
{
  let ok = 0, n = 0, done = 0;
  for (let s = 11; s <= 22; s++) {
    const g = newGame(s, 0.75);   // defesa no nível Difícil
    // monta o lance: meia com a bola no meio-campo, atacante na linha da zaga adversária
    g.setPiece = null; g.state = "play";
    const mid = g.teams[0].find(p => p.pos === "M"), fwd = g.teams[0].find(p => p.pos === "A");
    const dy = (s % 3 - 1) * 8;
    mid.x = 2; mid.y = dy; fwd.x = 20; fwd.y = dy + (s % 2 ? 6 : -6);
    for (const p of g.players) { p.vx = p.vy = 0; p.stun = 0; }
    // zagueiros adversários na mesma linha do atacante, espalhados
    const defs = g.teams[1].filter(p => p.pos === "D");
    defs.forEach((p, i) => { p.x = 21; p.y = -18 + (36 * i) / Math.max(1, defs.length - 1); });
    for (const p of g.teams[1]) if (!p.isGK && p.pos !== "D") p.x = Math.min(p.x, 8);
    g.ball.owner = null; g.own(mid); g.setCtrl(mid);
    for (let i = 0; i < 6; i++) g.tick(NONE);
    if (g.ball.owner !== mid) continue;
    press(g, "through", 16, dirTo(mid, fwd));
    const b = g.ball;
    if (!b.target || !b.through) continue;
    n++;
    const tx = b.x + b.vx / 0.75, t = b.target;
    if (t.dir * (tx - t.x) > 2) ok++;
    for (let i = 0; i < 300 && !g.ball.owner && g.state === "play"; i++) g.tick(NONE);
    if (g.ball.owner && g.ball.owner.team === 0) done++;
  }
  check(n > 0 && ok === n, `enfiada vai para o espaço à frente do recebedor (${ok}/${n})`);
  check(n > 0 && done >= n * 0.6, `enfiadas que chegam ao nosso atacante: ${done}/${n}`);
}

/* 3) troca pelo botão: escolhe o melhor candidato (não o atual) e apertar de novo passa para o próximo */
{
  const g = newGame(21);
  // dá a bola ao adversário
  const opp = g.teams[1].find(p => p.pos === "M");
  g.setPiece = null; g.state = "play"; g.ball.owner = null; g.ball.held = false;
  g.own(opp); opp.protect = 999;
  for (let i = 0; i < 12; i++) g.tick(NONE);
  const before = g.ctrl, order = g.switchOrder();
  const expect = order[0] === before ? order[1] : order[0];
  g.tick({ ...NONE, sw: true }); g.tick(NONE);
  check(g.ctrl === expect && g.ctrl !== before, `troca vai para o melhor candidato (${expect.name})`);
  const first = g.ctrl;
  g.tick({ ...NONE, sw: true }); g.tick(NONE);
  check(g.ctrl !== first, `apertar de novo em seguida passa para o próximo (${g.ctrl.name})`);
  // o escolhido deve estar do lado do nosso gol em relação à bola (ou muito perto dela)
  const goalSide = p => p.dir * (p.x - g.ball.x) <= 3 || hyp(p.x - g.ball.x, p.y - g.ball.y) < 6;
  check(goalSide(expect), "o escolhido não está atrás da jogada");
}

/* 4) analógico direito: assume o jogador na direção apontada */
{
  const g = newGame(31);
  const opp = g.teams[1].find(p => p.pos === "M");
  g.setPiece = null; g.state = "play"; g.ball.owner = null;
  g.own(opp); opp.protect = 999;
  for (let i = 0; i < 70; i++) g.tick(NONE);
  const c = g.ctrl;
  let hits = 0, total = 0;
  for (const target of g.teams[0].filter(p => !p.isGK && p !== c)) {
    // aponta para o alvo só se ele for o mais "alinhado" naquela direção
    const [dx, dy] = dirTo(g.ctrl, target);
    const cand = g.teams[0].filter(p => !p.isGK && p !== g.ctrl).map(p => { const v = dirTo(g.ctrl, p); return [p, v[0] * dx + v[1] * dy, hyp(p.x - g.ctrl.x, p.y - g.ctrl.y)]; });
    // pula alvos ambíguos: outro jogador quase na mesma direção e a uma distância parecida
    const dt = hyp(target.x - g.ctrl.x, target.y - g.ctrl.y);
    const rival = cand.some(([p, cos, d]) => p !== target && cos > 0.75 && d < dt * 1.3);
    if (rival) continue;
    total++;
    const from = g.ctrl;
    g.tick({ ...NONE, rx: dx, ry: dy }); g.tick(NONE);
    if (g.ctrl === target) hits++;
    g.setCtrl(from); g.ctrlCd = 999;
    if (total >= 5) break;
  }
  check(total > 0 && hits === total, `analógico direito escolhe o jogador apontado (${hits}/${total})`);
}

/* 4b) recepção: mesmo mexendo o analógico (até ~100° fora da direção da bola), o recebedor vai na bola */
{
  let ok = 0, n = 0;
  for (let s = 51; s <= 62; s++) {
    const g = newGame(s);
    const c = g.ctrl, r1 = g.teams[0].filter(p => p !== c && !p.isGK).sort((a, b) => hyp(a.x - c.x, a.y - c.y) - hyp(b.x - c.x, b.y - c.y))[0];
    press(g, "pass", 3, dirTo(c, r1));
    if (g.ball.target !== r1) continue;
    n++;
    // o usuário já empurra o analógico perpendicular à linha do passe (querendo sair jogando de lado)
    const [bx, by] = dirTo(c, r1), perp = s % 2 ? [-by, bx] : [by, -bx];
    let got = false;
    for (let i = 0; i < 150 && !got; i++) { g.tick({ ...NONE, x: perp[0], y: perp[1] }); if (g.ball.owner === r1) got = true; if (g.ball.owner && g.ball.owner.team === 1) break; }
    if (got) ok++;
  }
  check(n > 0 && ok >= n - 1, `recebedor vai na bola mesmo com o analógico apontado para o lado (${ok}/${n})`);
}

/* 5) chute carregado, passe alto (X) e chute de primeira guardado */
{
  const g = newGame(41);
  g.setPiece = null; g.state = "play";
  const fwd = g.teams[0].find(p => p.pos === "A");
  fwd.x = 30; fwd.y = 2; fwd.vx = fwd.vy = 0;
  g.ball.owner = null; g.own(fwd); g.setCtrl(fwd);
  for (let i = 0; i < 6; i++) g.tick(NONE);
  const s0 = g.stats.shots[0];
  press(g, "shoot", 25, [1, 0]);
  check(g.stats.shots[0] === s0 + 1 && Math.hypot(g.ball.vx, g.ball.vy) > 20, `chute carregado sai forte (${Math.hypot(g.ball.vx, g.ball.vy).toFixed(1)} m/s)`);

  const g2 = newGame(42);
  g2.setPiece = null; g2.state = "play";
  const mid = g2.teams[0].find(p => p.pos === "M");
  mid.x = 0; mid.y = 0;
  g2.ball.owner = null; g2.own(mid); g2.setCtrl(mid);
  for (let i = 0; i < 6; i++) g2.tick(NONE);
  press(g2, "lob", 20, [1, 0]);
  check(g2.ball.vz > 3 && g2.ball.type === "lob", `X faz passe alto (altura inicial ${g2.ball.vz.toFixed(1)} m/s)`);
}

/* ---------- defesa, proteção, chute colocado, cruzamento e troca após perder a bola ---------- */
// coloca a bola com um jogador e o controle num jogador nosso, sem bola parada
function scene(s, opp = 0.05) {
  const g = newGame(s, opp);
  g.setPiece = null; g.state = "play"; g.ball.held = false;
  for (const p of g.players) { p.vx = p.vy = 0; p.stun = 0; }
  return g;
}
const giveBall = (g, p) => { g.ball.owner = null; g.own(p); };

/* 6) segurar A sem a bola = conter; tocar A = trocar */
{
  let ok = 0, n = 0;
  for (let s = 71; s <= 78; s++) {
    const g = scene(s);
    const opp = g.teams[1].find(p => p.pos === "M"); opp.x = 0; opp.y = (s % 3 - 1) * 6;
    giveBall(g, opp); opp.protect = 999; opp.kickCd = 1e6;   // portador parado, sem passar a bola
    const me = g.teams[0].find(p => p.pos === "D"); me.x = -9; me.y = opp.y + 6;
    g.setCtrl(me); g.ctrlCd = 999; n++;
    for (let i = 0; i < 90; i++) g.tick({ ...NONE, pass: true });
    const dist = hyp(me.x - opp.x, me.y - opp.y), goalSide = me.dir * (me.x - opp.x) < 0;
    if (g.ctrl === me && dist < 3.2 && goalSide) ok++;
  }
  check(ok === n, `segurar A sem a bola: o mesmo jogador vai conter entre o portador e o gol (${ok}/${n})`);
  const g = scene(79);
  const opp = g.teams[1].find(p => p.pos === "M"); giveBall(g, opp); opp.protect = 999;
  const me = g.teams[0].find(p => p.pos === "D"); g.setCtrl(me); g.ctrlCd = 0; g.lastSw = 0;
  for (let i = 0; i < 4; i++) g.tick({ ...NONE, pass: true });
  g.tick(NONE); g.tick(NONE);
  check(g.ctrl !== me, "tocar A sem a bola continua trocando de jogador");
}

/* 7) RB sem a bola: companheiro mais próximo também pressiona o portador */
{
  const run = (s, rb) => {
    const g = scene(s);
    const opp = g.teams[1].find(p => p.pos === "M"); opp.x = 4; opp.y = 0;
    giveBall(g, opp); opp.protect = 999; opp.kickCd = 1e6;
    const me = g.teams[0].find(p => p.pos === "D"); me.x = -35; me.y = 25;
    g.setCtrl(me); g.ctrlCd = 999;
    for (let i = 0; i < 80; i++) g.tick({ ...NONE, rb });
    return g.teams[0].filter(p => p !== me && !p.isGK && hyp(p.x - opp.x, p.y - opp.y) < 3.2).length;
  };
  let w = 0, wo = 0;
  for (let s = 81; s <= 86; s++) { w += run(s, true); wo += run(s, false); }
  check(w >= wo + 4, `RB chama mais um companheiro para pressionar (perto do portador: ${w} com RB x ${wo} sem)`);
}

/* 8) LT com a bola = proteger: segura a bola por mais tempo contra a marcação */
{
  const run = (s, lt) => {
    const g = scene(s, 0.75);
    const me = g.teams[0].find(p => p.pos === "A"); me.x = 15; me.y = 0;
    giveBall(g, me); g.setCtrl(me);
    const def = g.teams[1].find(p => p.pos === "D"); def.x = 16.6; def.y = 0.3;
    let t = 0;
    for (; t < 240 && g.ball.owner === me; t++) g.tick({ ...NONE, lt });
    return t;
  };
  let w = 0, wo = 0;
  for (let s = 91; s <= 100; s++) { w += run(s, true); wo += run(s, false); }
  check(w > wo * 1.4, `LT protege a bola (tempo com a bola: ${w} com LT x ${wo} sem)`);
}

/* 9) RB com a bola = condução fina: bola mais colada ao pé */
{
  const run = rb => {
    const g = scene(101);
    const me = g.teams[0].find(p => p.pos === "M"); me.x = -20; me.y = 0;
    giveBall(g, me); g.setCtrl(me);
    let sum = 0;
    for (let i = 0; i < 40; i++) { g.tick({ ...NONE, x: 0.7, y: 0.7, rb }); sum += hyp(g.ball.x - me.x, g.ball.y - me.y); }
    return sum / 40;
  };
  const a = run(true), b = run(false);
  check(a < b - 0.15, `RB deixa a bola mais colada na condução (${a.toFixed(2)} m x ${b.toFixed(2)} m)`);
}

/* 10) RB+B = chute colocado: mais fraco e mais no alvo */
{
  const run = (s, rb) => {
    const g = scene(s);
    const me = g.teams[0].find(p => p.pos === "A"); me.x = 34; me.y = 9;
    giveBall(g, me); g.setCtrl(me);
    for (let i = 0; i < 4; i++) g.tick(NONE);
    const t0 = g.stats.target[0], g0 = g.score[0];
    for (let i = 0; i < 18; i++) g.tick({ ...NONE, shoot: true, rb });
    g.tick({ ...NONE, rb });
    const v = hyp(g.ball.vx, g.ball.vy);
    for (let i = 0; i < 120 && !g.ball.owner && g.state === "play"; i++) g.tick(NONE);
    return { v, on: g.stats.target[0] > t0 || g.score[0] > g0 ? 1 : 0 };
  };
  let vf = 0, vn = 0, of = 0, on = 0, n = 0;
  for (let s = 111; s <= 130; s++) { const f = run(s, true), r = run(s, false); vf += f.v; vn += r.v; of += f.on; on += r.on; n++; }
  check(vf / n < vn / n - 3 && of >= on, `chute colocado: ${(vf / n).toFixed(1)} m/s e ${of}/${n} no alvo x normal ${(vn / n).toFixed(1)} m/s e ${on}/${n}`);
}

/* 11) X perto da linha de fundo = cruzamento para a área, com cabeceio */
{
  let heads = 0, inBox = 0, n = 0;
  for (let s = 131; s <= 142; s++) {
    const g = scene(s);
    const wing = g.teams[0].find(p => p.pos === "M"), st = g.teams[0].find(p => p.pos === "A");
    wing.x = 44; wing.y = s % 2 ? 26 : -26; st.x = 41; st.y = (s % 3 - 1) * 3;
    giveBall(g, wing); g.setCtrl(wing);
    for (let i = 0; i < 4; i++) g.tick(NONE);
    const [dx, dy] = dirTo(wing, st);
    for (let i = 0; i < 20; i++) g.tick({ ...NONE, x: dx, y: dy, lob: true });
    g.tick(NONE); n++;
    const b = g.ball;
    if (b.target && Math.abs(b.target.y) < F.BOXW && b.target.dir * b.target.x > F.HL - F.BOXL) inBox++;
    let head = false;
    for (let i = 0; i < 150 && !g.ball.owner && g.state === "play" && !head; i++) { g.tick(NONE); if (g.events.some(e => e.t === "header")) head = true; }
    if (head) heads++;
  }
  check(inBox === n, `X na linha de fundo cruza para quem está na área (${inBox}/${n})`);
  check(heads >= n * 0.5, `cruzamentos que viram cabeceio: ${heads}/${n}`);
}

/* 12) perdeu a bola e ficou para trás: troca sozinho para quem está na frente da jogada */
{
  let ok = 0, n = 0;
  for (let s = 151; s <= 158; s++) {
    const g = scene(s);
    const me = g.teams[0].find(p => p.pos === "A"); me.x = 5; me.y = 0;
    giveBall(g, me); g.setCtrl(me);
    for (let i = 0; i < 50; i++) g.tick(NONE);
    // o adversário rouba e sai jogando em direção ao nosso gol; eu fico atrás da jogada
    const opp = g.teams[1].find(p => p.pos === "M"); opp.x = me.x - 2; opp.y = me.y;
    giveBall(g, opp); opp.protect = 999; me.stun = 26;
    n++;
    for (let i = 0; i < 40; i++) g.tick(NONE);
    const c = g.ctrl;
    if (c !== me && c.dir * (c.x - opp.x) < 1) ok++;
  }
  check(ok === n, `troca automática depois de perder a bola vai para quem está na frente da jogada (${ok}/${n})`);
}

console.log(fails ? `\n${fails} falha(s)` : "\nControles OK.");
process.exit(fails ? 1 : 0);
