// Motor da partida 11 x 11 (sem DOM): jogadores com atributos, posse de bola, passe, chute,
// desarme, goleiros, laterais, escanteios, tiros de meta e IA dos dois times. Passo fixo de 60 Hz.
import { rnd } from "../core/rng.js";
import { FORMATIONS } from "../core/squads.js";

export const F = { HL: 52.5, HW: 34, GW: 3.66, GH: 2.44, BOXL: 16.5, BOXW: 20.16, SIXL: 5.5, SIXW: 9.16, CC: 9.15, SPOT: 11 };
const DT = 1 / 60, GRAV = 20, KGROUND = 0.75, KAIR = 0.15;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const hyp = Math.hypot;
const nrm = () => (rnd() + rnd() + rnd() - 1.5) * 1.15;   // ~ normal(0, 0.58)
export const DIFF_LEVEL = [0.2, 0.5, 0.75, 1.0];

function params(L) {
  return {
    L, think: Math.round(lerp(42, 6, L)), passErr: lerp(2.1, 0.45, L), shotErr: lerp(1.9, 0.5, L), vision: lerp(22, 44, L),
    pressers: L >= 0.6 ? 2 : 1, lunge: lerp(0.05, 1.6, L), bonus: Math.round(lerp(-14, 16, L * L * (3 - 2 * L) * 0.5 + L * 0.5)), gkReact: Math.round(lerp(20, 2, L)), mark: lerp(0.35, 1, L),
    direct: lerp(2.5, 0.3, L),   // quanto prefere conduzir a passar
    spd: lerp(0.93, 1.09, L), tkl: lerp(0.6, 1.8, L), gkb: lerp(-0.12, 0.18, L),
  };
}
const speedOf = p => 5.6 + p.a.pac * 0.028;

/*
 cfg: {
   teams: [{ form, players: [{ name, num, pos, ovr, i, a:{pac,pas,sho,def,dri,gk} } x11] }, {...}],   // time 0 ataca para +x
   human: 0 | 1 | null, diff: 0..3, mins, needWinner, aggDiff, kickoff: 0|1, autoSwitch, levels?: [L0, L1]
 }
*/
export class Game {
  constructor(cfg) {
    this.cfg = cfg;
    this.human = cfg.human === 0 || cfg.human === 1 ? cfg.human : null;
    this.auto = cfg.autoSwitch !== false;
    const base = DIFF_LEVEL[cfg.diff ?? 1];
    const lv = cfg.levels || (this.human === null ? [0.6, 0.6] : this.human === 0 ? [0.62, base] : [base, 0.62]);
    this.par = lv.map(params);
    const neutral = p => { p.bonus = 0; p.spd = 1; p.tkl = 1; p.gkb = 0; };
    if (this.human !== null) neutral(this.par[this.human]); else if (!cfg.levels) { neutral(this.par[0]); neutral(this.par[1]); }
    this.players = []; this.teams = [[], []];
    for (const t of [0, 1]) {
      const T = cfg.teams[t], form = FORMATIONS[T.form] || FORMATIONS["4-3-3"], bonus = this.par[t].bonus;
      T.players.forEach((d, k) => {
        const a = {}; for (const key in d.a) a[key] = clamp(d.a[key] + bonus, 15, 99);
        const p = {
          team: t, idx: k, dir: t === 0 ? 1 : -1, pos: form[k][0], slot: { u: form[k][1], v: form[k][2] }, isGK: form[k][0] === "G",
          name: d.name, num: d.num, ovr: d.ovr, i: d.i, a,
          x: 0, y: 0, vx: 0, vy: 0, fx: t === 0 ? 1 : -1, fy: 0, mx: 0, my: 0, frac: 1, sprint: false, stamina: 1, tired: false,
          stun: 0, kickCd: 0, lunge: 0, lungeCd: 0, lx: 0, ly: 0, protect: 0, think: 0, plan: null, sup: 9, hold: 0, dive: false, human: false, tx: 0, ty: 0,
        };
        this.players.push(p); this.teams[t].push(p);
      });
    }
    this.ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, owner: null, held: false, last: null, noTake: null, noTakeT: 0, type: "loose", target: null, saveRoll: false, gkPlan: null };
    this.score = [0, 0]; this.goals = [];
    this.half = 1; this.clock = 0; this.halfTicks = Math.round((cfg.mins || 6) * 3600 / 2);
    this.et = false; this.result = null; this.needPens = false; this.pendingEnd = false;
    this.events = []; this.tickN = 0; this.timer = 0;
    this.kick0 = cfg.kickoff ?? 0;
    this.ctrl = null; this.ctrlCd = 0; this.assist = false; this.charge = 0; this.chargeKind = "";
    this.inp = {}; this.queued = null; this.nextSw = null; this.lastSw = 0; this.firstTime = false;
    this.stats = { shots: [0, 0], target: [0, 0], poss: [0, 0], passes: [0, 0], passOk: [0, 0], inter: [0, 0], tackles: [0, 0], saves: [0, 0], defl: 0 };
    this.chase = [[], []]; this.setPiece = null; this.dead = null;
    this.startDead("kickoff", this.kick0, 0, 0);
    // posiciona já na formação para o primeiro quadro
    for (const p of this.players) { p.x = p.tx; p.y = p.ty; }
    if (this.human !== null) this.setCtrl(this.dead.team === this.human ? this.dead.taker : this.closestTo(this.human, 0, 0));
  }

  /* ------------------------------ utilidades ------------------------------ */
  nearestOpp(p) {
    let best = null, bd = 1e9;
    for (const o of this.teams[1 - p.team]) { const d = hyp(o.x - p.x, o.y - p.y); if (d < bd) { bd = d; best = o; } }
    return { o: best, dist: bd };
  }
  closestTo(team, x, y, except) {
    let best = null, bd = 1e9;
    for (const p of this.teams[team]) { if (p.isGK || p === except) continue; const d = hyp(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  inOwnBox(p, x = p.x, y = p.y) { return p.dir * x < -F.HL + F.BOXL && Math.abs(y) < F.BOXW; }
  minute() { if (this.et) return 90 + Math.floor(this.clock / 3600 * 10) + 1; return Math.min(this.half * 45, Math.floor((this.half - 1) * 45 + (this.clock / this.halfTicks) * 45) + 1); }
  clockText() {
    if (this.et) { const s = Math.max(0, 90 - Math.floor(this.clock / 60)); return "PRO " + s + "s"; }
    const f = Math.min(1, this.clock / this.halfTicks);
    return String(Math.min(this.half * 45, Math.floor((this.half - 1) * 45 + f * 45))).padStart(2, "0") + "'";
  }
  // posição-base de um jogador na formação, deslocada pela bola. fase: 1 ataque, -1 defesa, 0 bola solta
  basePos(p, phase) {
    const d = p.dir, b = this.ball;
    if (p.isGK) return [-d * (F.HL - 2.5), 0];
    const bu = clamp((d * b.x) / F.HL, -1, 1);
    const push = phase === 1 ? 7 : phase === -1 ? -5 : 0, role = p.pos === "D" ? 0.7 : p.pos === "M" ? 1 : 1.15;
    let u = p.slot.u * F.HL * 0.62 + bu * F.HL * 0.36 + push * role;
    let y = d * p.slot.v * F.HW * (phase === -1 ? 0.68 : 0.86) + b.y * 0.3;
    u = clamp(u, p.pos === "D" ? -F.HL + 9 : -F.HL + 14, F.HL - 4);
    y = clamp(y, -F.HW + 2, F.HW - 2);
    return [d * u, y];
  }
  go(p, x, y, frac = 1, sprint = false) {
    const dx = x - p.x, dy = y - p.y, d = hyp(dx, dy);
    if (d < 0.3) { p.mx = p.my = 0; p.sprint = false; return; }
    const s = Math.min(1, d / 1.6);
    p.mx = (dx / d) * s; p.my = (dy / d) * s; p.frac = frac; p.sprint = sprint && d > 3.5;
  }
  traj() {
    if (this._trajN === this.tickN) return this._traj;
    const b = this.ball, out = [];
    let x = b.x, y = b.y, z = b.z, vx = b.vx, vy = b.vy, vz = b.vz;
    const h = 0.08, kg = Math.exp(-KGROUND * h), ka = Math.exp(-KAIR * h);
    for (let i = 0; i < 38; i++) {
      out.push({ x, y, z, t: i * h });
      if (z > 0 || vz > 0) { vz -= GRAV * h; z += vz * h; vx *= ka; vy *= ka; if (z <= 0) { z = 0; if (vz < -3) { vz = -vz * 0.45; vx *= 0.78; vy *= 0.78; } else vz = 0; } }
      else { vx *= kg; vy *= kg; }
      x += vx * h; y += vy * h;
    }
    this._traj = out; this._trajN = this.tickN;
    return out;
  }
  // ponto onde o jogador consegue alcançar a bola
  intercept(p) {
    const b = this.ball, vm = speedOf(p) * 1.25;
    if (b.owner) return { x: b.x, y: b.y, t: hyp(b.x - p.x, b.y - p.y) / vm };
    const tr = this.traj(), zmax = p.isGK ? 2.3 : 1.3;
    for (const pt of tr) if (pt.z < zmax && hyp(pt.x - p.x, pt.y - p.y) <= vm * pt.t + 0.9) return pt;
    return tr[tr.length - 1];
  }
  lastLine(team, d) {   // linha do último defensor de linha do time "team", no eixo de ataque de quem ataca (d)
    let m = -1e9;
    for (const o of this.teams[team]) if (!o.isGK) m = Math.max(m, d * o.x);
    return m;
  }

  /* ------------------------------ controle humano ------------------------------ */
  setCtrl(p) {
    if (!p || this.ctrl === p) return;
    if (this.ctrl) this.ctrl.human = false;
    this.ctrl = p; p.human = true; this.ctrlCd = 36;
  }
  /* ---------- troca de jogador ---------- */
  // Quanto menor, melhor candidato para assumir a jogada sem a bola.
  switchScore(p) {
    const b = this.ball, o = b.owner, d = p.dir;
    let t;
    if (o && o.team !== p.team) {
      // adversário com a bola: vale quem chega primeiro na frente dele, entre ele e o nosso gol
      const gx = -d * F.HL, gl = hyp(gx - o.x, o.y) || 1;
      const cx = o.x + ((gx - o.x) / gl) * 2.5 + o.vx * 0.35, cy = o.y + (-o.y / gl) * 2.5 + o.vy * 0.35;
      t = hyp(cx - p.x, cy - p.y) / speedOf(p);
    } else t = this.intercept(p).t;
    // quem está atrás da bola (do lado do ataque) chega correndo de costas: pior opção
    const behind = d * (p.x - b.x);
    if (behind > 0) t += behind * 0.05;
    if (p.stun > 0) t += 1;
    return t;
  }
  switchOrder() {
    return this.teams[this.human].filter(p => !p.isGK).map(p => [p, this.switchScore(p)]).sort((a, c) => a[1] - c[1]).map(x => x[0]);
  }
  // botão de troca: o melhor candidato; apertando de novo em seguida, passa para o próximo da lista
  switchCtrl() {
    if (this.human === null) return;
    const list = this.switchOrder();
    if (!list.length) return;
    let pick;
    if (this.lastSw && this.tickN - this.lastSw < 40) {
      const i = list.indexOf(this.ctrl);
      pick = list[(i + 1) % list.length];
    } else pick = list[0] === this.ctrl ? list[1] : list[0];
    this.lastSw = this.tickN;
    if (pick) { this.setCtrl(pick); this.ctrlCd = 45; }
  }
  // analógico direito: assume o jogador na direção apontada (a partir do jogador atual)
  switchDir(dx, dy) {
    const r = this.ctrl || this.ball;
    let best = null, bs = 1e9;
    for (const p of this.teams[this.human]) {
      if (p.isGK || p === this.ctrl) continue;
      const vx = p.x - r.x, vy = p.y - r.y, dist = hyp(vx, vy) || 1, cos = (vx * dx + vy * dy) / dist;
      if (cos < 0.4) continue;
      const s = dist * (1.7 - cos);
      if (s < bs) { bs = s; best = p; }
    }
    if (best) { this.setCtrl(best); this.ctrlCd = 60; this.lastSw = 0; }
  }

  /* ---------- entrada do jogador humano ---------- */
  // inp = { x, y, rx, ry, pass, lob, shoot, through, sw, mod, sprint }  (vetores já em coordenadas do campo)
  handleHuman(inp) {
    if (this.human === null) return;
    inp = inp || {};
    const b = this.ball, o = b.owner, I = this.inp, H = this.human;
    let mag = hyp(inp.x || 0, inp.y || 0), sx = inp.x || 0, sy = inp.y || 0;
    if (mag > 1) { sx /= mag; sy /= mag; mag = 1; }
    this.assist = mag < 0.18;
    if (o && o.team === H && !o.isGK && this.ctrl !== o) this.setCtrl(o);
    if (this.ctrlCd > 0) this.ctrlCd--;
    if (!this.ctrl) return;
    const mine = !!(o && o.team === H);
    // troca pelo botão (LB / C) e pelo analógico direito: só sem a bola
    if (inp.sw && !I.sw && !mine) this.switchCtrl();
    const rm = hyp(inp.rx || 0, inp.ry || 0);
    if (rm > 0.7 && (I.rm || 0) <= 0.4 && !mine) this.switchDir(inp.rx / rm, inp.ry / rm);
    I.sw = !!inp.sw; I.rm = rm;
    // troca automática quando sem a bola
    const c = this.ctrl;
    if (!mine && this.auto && this.ctrlCd === 0 && this.tickN % 12 === 0 && b.target !== c) {
      const best = this.chase[H][0];
      if (best && best !== c && !best.isGK) {
        const e1 = this.intercept(best).t, e2 = this.intercept(c).t;
        if (e1 + 0.55 < e2 && hyp(c.x - b.x, c.y - b.y) > 5) this.setCtrl(best);
      }
    }
    if (!mine && this.tickN % 6 === 0) { const l = this.switchOrder(); this.nextSw = l[0] === this.ctrl ? l[1] : l[0]; }
    if (mine || (b.target && b.target.team === H)) this.nextSw = null;
    const cc = this.ctrl, taking = this.setPiece && this.setPiece.taker === cc;
    if (cc.stun === 0 && cc.lunge === 0) {
      if (taking) { cc.mx = cc.my = 0; if (!this.assist) { cc.fx = sx / mag; cc.fy = sy / mag; } }
      else if (!this.assist) { cc.mx = sx; cc.my = sy; cc.frac = 1; cc.sprint = !!inp.sprint; }
    }
    const dir = this.assist ? null : [sx / mag, sy / mag];
    // bola vindo para o nosso jogador (passe nosso ou bola solta perto dele): a ação fica guardada
    const incoming = (b.target && b.target.team === H && !b.target.isGK) || (!o && hyp(b.x - cc.x, b.y - cc.y) < 7 && this.chase[H][0] === cc);
    // ação guardada (passe antecipado): sai assim que o jogador dominar
    const q = this.queued;
    if (q) {
      if (this.tickN - q.at > 100 || (o && o.team !== H)) this.queued = null;
      else if (o === cc && cc.kickCd === 0 && this.tickN - (cc.gotAt || 0) >= 4) {
        this.queued = null; this.firstTime = true;
        this.doAction(cc, q.k, q.hold, q.dir || dir, q.mod);
        this.firstTime = false;
      }
    }
    // botões de ação: soltar executa; segurar até o máximo também executa
    const MAX = { pass: 54, lob: 46, shoot: 48, through: 40 };
    this.charge = 0; this.chargeKind = "";
    for (const k of ["pass", "lob", "shoot", "through"]) {
      const st = (I[k] ||= { down: false, t: 0, used: true }), down = !!inp[k];
      if (down && !st.down) {
        st.t = 0; st.used = false;
        if (!mine && !incoming) {   // sem a bola: PASSE troca, CHUTE/ALTO dão o bote
          if (k === "pass") this.switchCtrl();
          else if ((k === "shoot" || k === "lob") && cc.lungeCd === 0 && cc.stun === 0) this.startLunge(cc, dir ? dir[0] : cc.fx, dir ? dir[1] : cc.fy);
          st.used = true;
        }
      }
      if (down) st.t++;
      if (!st.used && ((!down && st.down) || (down && st.t >= MAX[k]))) {
        st.used = true;
        if (b.owner === cc && cc.kickCd === 0) this.doAction(cc, k, st.t, dir, !!inp.mod);
        else if (incoming || b.target === cc) this.queued = { k, hold: st.t, dir, mod: !!inp.mod, at: this.tickN };
      }
      if (down && !st.used && (b.owner === cc || incoming) && st.t > (k === "pass" ? 14 : 3)) {
        this.charge = clamp(st.t / MAX[k], 0, 1); this.chargeKind = k === "pass" ? "lob" : k;
      }
      st.down = down;
    }
  }
  doAction(c, k, hold, dir, mod) {
    const dx = dir ? dir[0] : c.fx, dy = dir ? dir[1] : c.fy;
    if (k === "pass") this.humanPass(c, dx, dy, hold, false);
    else if (k === "lob") this.humanPass(c, dx, dy, hold, true);
    else if (k === "through") this.humanThrough(c, dx, dy, hold, mod);
    else this.humanShoot(c, dir, clamp(hold / 46, 0.12, 1));
  }
  // passe semi-assistido: escolhe o companheiro na direção do analógico e ajusta força e direção
  humanPass(c, sx, sy, hold, forceLob) {
    const lob = forceLob || hold > 16, power = forceLob ? clamp(hold / 40, 0, 1) : clamp((hold - 16) / 38, 0, 1);
    let best = null, bs = 1e9;
    for (const m of this.teams[c.team]) {
      if (m === c) continue;
      const dx = m.x - c.x, dy = m.y - c.y, dist = hyp(dx, dy);
      if (dist < 3 || dist > (lob ? 58 : 40)) continue;
      const ang = Math.acos(clamp((dx * sx + dy * sy) / dist, -1, 1));
      if (ang > 0.82) continue;
      let s = ang * 26 + Math.abs(dist - (lob ? 20 + power * 26 : 13)) * (lob ? 0.4 : 0.3) + (m.isGK ? 9 : 0);
      if (!lob) for (const o of this.teams[1 - c.team]) { const t = ((o.x - c.x) * dx + (o.y - c.y) * dy) / (dist * dist); if (t > 0.1 && t < 0.95 && hyp(c.x + dx * t - o.x, c.y + dy * t - o.y) < 1.2) { s += 6; break; } }
      if (s < bs) { bs = s; best = m; }
    }
    if (!best) {
      const dist = lob ? 18 + power * 26 : 14;
      this.kickPass(c, c.x + sx * dist, c.y + sy * dist, lob, null);
      return;
    }
    const d0 = hyp(best.x - c.x, best.y - c.y), t = lob ? clamp(d0 / 21, 0.7, 2.3) : d0 / (11 + d0 * 0.45);
    const ax = best.x + best.vx * t * 0.9, ay = best.y + best.vy * t * 0.9;
    let a = Math.atan2(ay - c.y, ax - c.x), sa = Math.atan2(sy, sx), df = sa - a;
    while (df > Math.PI) df -= 2 * Math.PI; while (df < -Math.PI) df += 2 * Math.PI;
    a += df * 0.2;
    const dist = hyp(ax - c.x, ay - c.y);
    this.kickPass(c, c.x + Math.cos(a) * dist, c.y + Math.sin(a) * dist, lob, best);
  }
  // enfiada (Y / triângulo): bola no espaço à frente do companheiro na direção do analógico.
  // Segurar mais = bola mais longa. Com LB segurado sai pelo alto.
  humanThrough(c, sx, sy, hold, lofted) {
    const power = clamp(hold / 40, 0, 1), d = c.dir;
    let best = null, bs = 1e9;
    for (const m of this.teams[c.team]) {
      if (m === c || m.isGK) continue;
      const dx = m.x - c.x, dy = m.y - c.y, dist = hyp(dx, dy);
      if (dist < 3 || dist > 50) continue;
      const ang = Math.acos(clamp((dx * sx + dy * sy) / dist, -1, 1));
      if (ang > 0.9) continue;
      const s = ang * 24 + Math.abs(dist - 16) * 0.2 - Math.max(0, d * dx) * 0.15 + (m.pos === "D" ? 4 : 0);
      if (s < bs) { bs = s; best = m; }
    }
    if (!best) {   // ninguém na direção: bola no espaço
      const L = 14 + power * 14;
      this.kickThrough(c, c.x + sx * L, c.y + sy * L, lofted, null);
      return;
    }
    // direção da corrida: o analógico puxado para o gol adversário
    let rx = sx * 0.55 + d * 0.85, ry = sy * 0.55 - (best.y / F.HW) * 0.2;
    const rl = hyp(rx, ry) || 1; rx /= rl; ry /= rl;
    let L = 5 + power * 15;
    // não manda a bola para fora: encurta até caber no campo
    for (let k = 0; k < 10; k++) {
      const px = best.x + rx * L, py = best.y + ry * L;
      if (d * px <= F.HL - 3 && Math.abs(py) <= F.HW - 2) break;
      L *= 0.8;
    }
    this.kickThrough(c, best.x + rx * L, best.y + ry * L, lofted, best);
  }
  humanShoot(c, stick, power) {
    const gx = c.dir * F.HL;
    if (stick && stick[0] * c.dir < 0.2) {   // apontando para longe do gol: chutão na direção do analógico
      this.kick(c, stick[0], stick[1], 16 + power * 16, 2 + power * 7, "clear", null);
      return;
    }
    let ty;
    if (stick) {
      const yi = c.y + (stick[1] / stick[0]) * (gx - c.x);
      if (Math.abs(yi) > F.GW + 7) { this.kick(c, stick[0], stick[1], 18 + power * 16, 1.5 + power * 6, "clear", null); return; }
      ty = clamp(yi, -F.GW * 0.88, F.GW * 0.88);
    } else {
      const gk = this.teams[1 - c.team][0];
      ty = (gk.y > 0.4 ? -1 : gk.y < -0.4 ? 1 : (rnd() < 0.5 ? -1 : 1)) * F.GW * 0.72;
    }
    this.kickShot(c, gx, ty, power);
  }
  startLunge(p, dx, dy) {
    const b = this.ball, bx = b.x - p.x, by = b.y - p.y, bd = hyp(bx, by);
    if (bd < 4.5 && bd > 0.01) { dx = bx / bd; dy = by / bd; }
    p.lunge = 13; p.lx = dx; p.ly = dy; p.lungeCd = 75; p.lungeWon = false;
    this.events.push({ t: "lunge" });
  }

  /* ------------------------------ chutes ------------------------------ */
  kick(p, cx, cy, speed, vz, type, target) {
    const b = this.ball;
    b.owner = null; b.held = false;
    b.x = p.x + cx * 1.0; b.y = p.y + cy * 1.0; b.z = vz > 0 ? 0.02 : 0;
    b.vx = cx * speed; b.vy = cy * speed; b.vz = vz;
    b.noTake = p; b.noTakeT = 16; b.last = p; b.type = type; b.target = target; b.saveRoll = false; b.gkPlan = null;
    p.kickCd = 20; p.fx = cx; p.fy = cy; p.plan = null;
    this.events.push({ t: "kick", type });
    this.setPiece = null;
    if (this.human === p.team && target && !target.isGK) this.setCtrl(target);
  }
  kickPass(p, tx, ty, lob, target) {
    const dx = tx - p.x, dy = ty - p.y, dist = hyp(dx, dy) || 1;
    const press = this.setPiece ? 9 : this.nearestOpp(p).dist;
    const err = (0.014 + (100 - p.a.pas) * 0.0011) * this.par[p.team].passErr * (press < 2.5 ? 1.5 : 1) * (lob ? 1.35 : 1) * (this.firstTime ? 1.25 : 1);
    const ang = Math.atan2(dy, dx) + nrm() * err;
    let vh, vz = 0;
    if (lob) { const T = clamp(dist / 21, 0.7, 2.3); vh = (dist / T) * 1.1; vz = (GRAV * T) / 2; }
    else vh = clamp(7.5 + dist * 0.84, 11, 34);
    this.stats.passes[p.team]++;
    this.kick(p, Math.cos(ang), Math.sin(ang), vh, vz, lob ? "lob" : "pass", target);
  }
  // passe para um ponto futuro (enfiada): a bola chega lá junto com o companheiro
  kickThrough(p, px, py, lofted, target) {
    const dx = px - p.x, dy = py - p.y, D = hyp(dx, dy) || 1;
    const tR = target ? hyp(px - target.x, py - target.y) / (speedOf(target) * 1.2) : D / 20;
    const press = this.setPiece ? 9 : this.nearestOpp(p).dist;
    const err = (0.016 + (100 - p.a.pas) * 0.0012) * this.par[p.team].passErr * (press < 2.5 ? 1.4 : 1) * (lofted ? 1.3 : 1) * (this.firstTime ? 1.25 : 1);
    const ang = Math.atan2(dy, dx) + nrm() * err;
    let vh, vz = 0;
    if (lofted) { const T = clamp(Math.max(tR, D / 26), 0.9, 2.4); vh = (D / T) * 1.08; vz = (GRAV * T) / 2; }
    else { const T = Math.max(tR * 1.08 + 0.1, D / 30, 0.4); vh = clamp((D * KGROUND) / (1 - Math.exp(-KGROUND * T)), 10, 32); }
    this.stats.passes[p.team]++;
    this.kick(p, Math.cos(ang), Math.sin(ang), vh, vz, lofted ? "lob" : "pass", target);
    this.ball.through = true;
  }
  kickShot(p, tx, ty, power) {
    const dx = tx - p.x, dy = ty - p.y, press = this.nearestOpp(p).dist;
    const e = (0.05 + (100 - p.a.sho) * 0.0022) * this.par[p.team].shotErr * (1 + power * 0.7) * (press < 2 ? 1.35 : 1) * (this.firstTime ? 1.2 : 1);
    const ang = Math.atan2(dy, dx) + nrm() * e;
    const sp = 21 + 15 * power + p.a.sho * 0.05;
    const vz = 0.6 + power * power * 9 * (0.35 + rnd() * 0.75);
    this.stats.shots[p.team]++;
    this.kick(p, Math.cos(ang), Math.sin(ang), sp, vz, "shot", null);
  }

  /* ------------------------------ IA ------------------------------ */
  think() {
    const b = this.ball, o = b.owner;
    const poss = this.setPiece ? this.setPiece.taker.team : o ? o.team : b.target ? b.target.team : -1;
    if (this.tickN % 6 === 0) {
      for (const t of [0, 1]) {
        const arr = [];
        for (const p of this.teams[t]) { if (p.isGK) continue; p._eta = this.intercept(p).t + (p.stun > 0 ? 1 : 0); arr.push(p); }
        arr.sort((a, c) => a._eta - c._eta);
        this.chase[t] = arr;
      }
      if (o) {
        const mates = this.teams[o.team].filter(p => p !== o && !p.isGK).sort((a, c) => hyp(a.x - o.x, a.y - o.y) - hyp(c.x - o.x, c.y - o.y));
        mates.forEach((p, i) => (p.sup = i));
      }
    }
    for (const t of [0, 1]) {
      const phase = poss === t ? 1 : poss === 1 - t ? -1 : 0, par = this.par[t], ch = this.chase[t];
      const deep = t === 0 ? b.x < -F.HL * 0.3 : b.x > F.HL * 0.3;
      for (const p of this.teams[t]) {
        if (p.stun > 0 || p.lunge > 0) { p.mx = p.my = 0; continue; }
        const first = ch[0] === p;
        let receiving = b.target === p || (!o && first);
        if (receiving && b.target && b.target.team !== t && b.target._eta !== undefined && p._eta > b.target._eta - 0.12) receiving = false;
        if (p === this.ctrl) {
          if (!this.assist || (this.setPiece && this.setPiece.taker === p)) continue;
          // sem toque no analógico: o jogador vai sozinho receber o passe ou buscar a bola solta
          if (!o && receiving) { const it = this.intercept(p); this.go(p, it.x, it.y, 1, true); } else { p.mx = p.my = 0; p.sprint = false; }
          continue;
        }
        if (this.setPiece && this.setPiece.taker === p) { this.aiSetPiece(p); continue; }
        if (p.isGK) { this.aiKeeper(p); continue; }
        if (o === p) { this.aiCarrier(p); continue; }
        if (!o && receiving) { const it = this.intercept(p); this.go(p, it.x, it.y, 1, true); continue; }
        if (phase === 1) this.aiSupport(p);
        else if (phase === -1 && !this.setPiece) {
          const rank = ch.indexOf(p);
          if (rank === 0) this.aiPress(p);
          else if (rank === 1 && (par.pressers >= 2 || deep)) this.aiCover(p);
          else this.aiMark(p, par);
        } else this.aiMark(p, par);
      }
    }
  }
  aiSupport(p) {
    const b = this.ball, o = b.owner, d = p.dir;
    let [tx, ty] = this.basePos(p, 1), sprint = false;
    if (o && o.team === p.team) {
      if (p.sup === 0) {
        // opção curta de passe: procura o lado mais livre perto do portador
        let best = -1e9;
        for (const a of [0.9, -0.9, 0.35, -0.35, 1.9, -1.9]) {
          const ca = Math.cos(a) * d, sa = Math.sin(a), x = o.x + ca * 10, y = o.y + sa * 10;
          if (Math.abs(y) > F.HW - 2 || Math.abs(x) > F.HL - 3) continue;
          let free = 99; for (const q of this.teams[1 - p.team]) free = Math.min(free, hyp(q.x - x, q.y - y));
          const s = Math.min(free, 9) + (Math.abs(a) < 1 ? 1.5 : 0) - hyp(x - p.x, y - p.y) * 0.12;
          if (s > best) { best = s; tx = x; ty = y; }
        }
      } else if (p.pos === "A" || (p.pos === "M" && p.sup <= 4 && d * o.x > -8)) {
        // infiltração, sem passar da linha do último defensor
        const line = Math.max(this.lastLine(1 - p.team, d), d * b.x);
        let u = Math.max(d * tx, Math.min(d * o.x + (p.pos === "A" ? 16 : 9), line - 0.6));
        u = Math.min(u, F.HL - 6);
        sprint = u - d * p.x > 7;
        tx = d * u;
      }
    }
    this.go(p, tx, ty, 0.85, sprint || hyp(tx - p.x, ty - p.y) > 12);
  }
  aiPress(p) {
    const b = this.ball, o = b.owner, d = p.dir, par = this.par[p.team];
    const gx = -d * F.HL, gl = hyp(gx - b.x, b.y) || 1, gvx = (gx - b.x) / gl, gvy = -b.y / gl;
    const dist = hyp(p.x - b.x, p.y - b.y);
    let ax = b.x, ay = b.y;
    if (!o) { const it = this.intercept(p); ax = it.x; ay = it.y; }
    else if (dist > 3) { ax += gvx * 1.3 + o.vx * 0.25; ay += gvy * 1.3 + o.vy * 0.25; }
    this.go(p, ax, ay, 1, dist > 2.5);
    if (o && dist < 2.7 && dist > 1.25 && p.lungeCd === 0 && rnd() < par.lunge * DT) this.startLunge(p, (b.x - p.x) / dist, (b.y - p.y) / dist);
  }
  aiCover(p) {
    const b = this.ball, d = p.dir, gx = -d * F.HL, gl = hyp(gx - b.x, b.y) || 1;
    const x = b.x + ((gx - b.x) / gl) * 5.5, y = b.y + (-b.y / gl) * 5.5;
    this.go(p, x, y, 1, hyp(x - p.x, y - p.y) > 5);
  }
  aiMark(p, par) {
    const d = p.dir;
    let [tx, ty] = this.basePos(p, -1);
    if (p.pos !== "A") {
      let best = null, bd = 6 + 6 * par.mark;
      for (const q of this.teams[1 - p.team]) {
        if (q === this.ball.owner || q.isGK || d * q.x > 12) continue;
        const dd = hyp(q.x - tx, q.y - ty);
        if (dd < bd) { bd = dd; best = q; }
      }
      if (best) {
        const gx = -d * F.HL, gl = hyp(gx - best.x, best.y) || 1;
        const mx = best.x + ((gx - best.x) / gl) * 1.8, my = best.y + (-best.y / gl) * 1.8, k = 0.5 + 0.35 * par.mark;
        tx = lerp(tx, mx, k); ty = lerp(ty, my, k);
      }
    }
    const far = hyp(tx - p.x, ty - p.y);
    this.go(p, tx, ty, 0.85, far > 10);
  }
  aiCarrier(p) {
    const near = this.nearestOpp(p);
    if (p.kickCd === 0) {
      p.think--;
      const rushed = near.dist < 2.6;
      if (p.think <= 0 || !p.plan || (rushed && !p.rushed && p.think > 4)) { p.rushed = rushed; if (this.decide(p, near)) return; }
    }
    const pl = p.plan;
    if (pl) this.go(p, p.x + pl.dx * 6, p.y + pl.dy * 6, 1, pl.sprint);
  }
  // decide o que o portador faz; retorna true se chutou/passou
  decide(p, near) {
    const par = this.par[p.team], d = p.dir, gx = d * F.HL, u = d * p.x, dG = hyp(gx - p.x, p.y), press = near.dist;
    const opps = this.teams[1 - p.team];
    p.think = Math.max(3, (par.think * (0.7 + rnd() * 0.6)) | 0);
    // 1) finalização
    if (u > 10 && dG < 30) {
      const ang = Math.atan2(2 * F.GW * Math.abs(gx - p.x), dG * dG);
      let q = clamp(1.3 - dG / 23, 0, 1) * clamp(ang / 0.28, 0.2, 1);
      const lx = gx - p.x, ly = -p.y;
      for (const o of opps) {
        if (o.isGK) continue;
        const t = ((o.x - p.x) * lx + (o.y - p.y) * ly) / (dG * dG);
        if (t > 0.05 && t < 0.9 && hyp(p.x + lx * t - o.x, p.y + ly * t - o.y) < 1.2) q *= 0.55;
      }
      const thr = dG < 9 ? 0.04 : 0.46 - (press < 2.5 ? 0.08 : 0);
      if (q > thr || (q > 0.2 && rnd() < 0.04)) {
        const gk = opps[0];
        let ty = (gk.y > 0.4 ? -1 : gk.y < -0.4 ? 1 : rnd() < 0.5 ? -1 : 1) * F.GW * 0.72;
        if (Math.abs(p.y) > 9) ty = Math.sign(p.y) * -F.GW * 0.55;   // de lado: bola no canto oposto
        this.kickShot(p, gx, ty, clamp(0.3 + dG / 42 + rnd() * 0.2, 0.3, 0.92));
        return true;
      }
    }
    // 2) opções de passe
    let best = null, bs = -1e9, bestLob = false;
    for (const m of this.teams[p.team]) {
      if (m === p) continue;
      const dx = m.x - p.x, dy = m.y - p.y, dist = hyp(dx, dy);
      if (dist < 4.5 || dist > par.vision) continue;
      if (m.isGK && !(u < -15 && press < 4)) continue;
      const gain = d * dx;
      let open = 8; for (const o of opps) open = Math.min(open, hyp(o.x - m.x, o.y - m.y));
      let lane = 99;
      for (const o of opps) {
        const t = ((o.x - p.x) * dx + (o.y - p.y) * dy) / (dist * dist);
        if (t < 0.06 || t > 1.02) continue;
        lane = Math.min(lane, hyp(p.x + dx * t - o.x, p.y + dy * t - o.y) - t * dist * 0.045);
      }
      let lob = false;
      if (lane < 1.9 + dist * 0.02) { if (dist > 16 && open > 3.5) lob = true; else continue; }
      let s = gain * 0.5 + open * 0.9 + (d * m.x > F.HL - F.BOXL && Math.abs(m.y) < F.BOXW ? 6 : 0) - (lob ? 3.5 : 0) + rnd() * 2;
      if (gain < -6) s -= 3 + (press > 4 ? 3 : 0);
      if (d * m.x < -22 && open < 5) s -= 6;
      if (m.isGK) s -= 4;
      if (s > bs) { bs = s; best = m; bestLob = lob; }
    }
    // 2b) enfiada: espaço à frente de um companheiro que chega antes de qualquer defensor
    let thru = null;
    if (par.L > 0.25 && u > -20) {
      for (const m of this.teams[p.team]) {
        if (m === p || m.isGK || m.pos === "D" || d * (m.x - p.x) < 2) continue;
        const px = m.x + d * 9, py = m.y * 0.85;
        if (d * px > F.HL - 5) continue;
        const D = hyp(px - p.x, py - p.y);
        if (D < 10 || D > 38) continue;
        const tR = hyp(px - m.x, py - m.y) / (speedOf(m) * 1.2);
        let tO = 99;
        for (const o of opps) tO = Math.min(tO, hyp(o.x - px, o.y - py) / (speedOf(o) * 1.2));
        if (tO < tR + 0.25) continue;
        const lx = px - p.x, ly = py - p.y;
        let clear = true;
        for (const o of opps) { const t = ((o.x - p.x) * lx + (o.y - p.y) * ly) / (D * D); if (t > 0.08 && t < 1 && hyp(p.x + lx * t - o.x, p.y + ly * t - o.y) < 1.7) { clear = false; break; } }
        if (!clear) continue;
        const s = d * (px - p.x) * 0.55 + 5 + Math.min(3, tO - tR) * 2 + rnd() * 2;
        if (!thru || s > thru.s) thru = { s, m, px, py };
      }
    }
    // 3) valor de conduzir
    let ahead = 14;
    const fl = dG || 1, fxg = (gx - p.x) / fl, fyg = -p.y / fl;
    for (const o of opps) { const rx = o.x - p.x, ry = o.y - p.y, rl = hyp(rx, ry) || 1; if ((rx * fxg + ry * fyg) / rl > 0.55) ahead = Math.min(ahead, rl); }
    let sDrib = ahead * 0.75 + (u > 15 ? 1.5 : 0) - (press < 2 ? 4 : 0) - (p.pos === "D" && u < -20 ? 3 : 0);
    if (thru && thru.s > sDrib + par.direct && (!best || thru.s >= bs)) { this.kickThrough(p, thru.px, thru.py, false, thru.m); return true; }
    if (best && bs > sDrib + par.direct) { this.aiPass(p, best, bestLob); return true; }
    if (press < 2.3 && u < -24) {   // apertado na defesa e sem passe: chutão
      { const cy = (rnd() - 0.5) * 1.3, cl = Math.hypot(1, cy); this.kick(p, d / cl, cy / cl, 24, 9, "clear", null); }
      return true;
    }
    // conduz em direção ao gol, desviando do marcador mais próximo
    let dx = gx - p.x, dy = clamp(p.y * 0.55, -9, 9) - p.y; const l = hyp(dx, dy) || 1; dx /= l; dy /= l;
    const o = near.o;
    if (o && near.dist < 5.5) {
      const rx = o.x - p.x, ry = o.y - p.y;
      if ((rx * dx + ry * dy) / near.dist > 0.25) {
        let side = dx * ry - dy * rx > 0 ? -1 : 1;   // lado oposto ao marcador
        if (Math.abs(p.y + dx * side * 5) > F.HW - 2) side = -side;
        const nx = dx * 0.55 - dy * side * 0.85, ny = dy * 0.55 + dx * side * 0.85, nl = hyp(nx, ny);
        dx = nx / nl; dy = ny / nl;
      }
    }
    p.plan = { dx, dy, sprint: ahead > 7 };
    return false;
  }
  aiPass(p, m, lob) {
    const dist = hyp(m.x - p.x, m.y - p.y), t = lob ? clamp(dist / 21, 0.7, 2.3) : dist / (11 + dist * 0.45);
    this.kickPass(p, m.x + m.vx * t * 0.9, m.y + m.vy * t * 0.9, lob, m);
  }
  aiKeeper(p) {
    const b = this.ball, d = p.dir, gx = -d * F.HL, par = this.par[p.team];
    p.dive = false;
    if (b.owner === p) {
      p.mx = p.my = 0;
      if (++p.hold > 55) { p.hold = 0; this.gkDistribute(p); }
      return;
    }
    p.hold = 0;
    if (!b.owner) {
      // chute a caminho do gol: reage e vai no canto
      if (b.last && b.last.team !== p.team && b.vx * -d > 6) {
        const t = (p.x - b.x) / b.vx;
        if (t > 0 && t < 1.7) {
          const yi = b.y + b.vy * t;
          if (Math.abs(yi) < F.GW + 2.5) {
            if (!b.gkPlan) b.gkPlan = { delay: par.gkReact + ((rnd() * 4) | 0), y: clamp(yi, -F.GW - 0.4, F.GW + 0.4) };
            if (b.gkPlan.delay-- <= 0) { p.dive = true; this.go(p, p.x, b.gkPlan.y, 1, false); } else { p.mx = p.my = 0; }
            return;
          }
        }
      }
      // bola solta na área: sai para ficar com ela
      if (this.inOwnBox(p, b.x, b.y) && b.z < 2.2) {
        const it = this.intercept(p), oe = this.chase[1 - p.team][0];
        if (!oe || it.t < oe._eta - 0.1 || hyp(b.x - p.x, b.y - p.y) < 3) { this.go(p, it.x, it.y, 1, true); return; }
      }
    }
    const dist = hyp(b.x - gx, b.y) || 1, out = clamp(1.1 + (dist - 10) * 0.11, 1.0, 6.5);
    this.go(p, gx + ((b.x - gx) / dist) * out, (b.y / dist) * out, 1, false);
  }
  gkDistribute(p) {
    let best = null, bs = -1e9;
    for (const m of this.teams[p.team]) {
      if (m === p || m.pos === "A") continue;
      const dist = hyp(m.x - p.x, m.y - p.y);
      if (dist < 8 || dist > 34) continue;
      let open = 14; for (const o of this.teams[1 - p.team]) open = Math.min(open, hyp(o.x - m.x, o.y - m.y));
      const s = open * 1.2 - dist * 0.1 + rnd() * 2;
      if (open > 7 && s > bs) { bs = s; best = m; }
    }
    if (best) { this.aiPass(p, best, false); return; }
    const ms = this.teams[p.team].filter(m => m.pos !== "D" && !m.isGK), m = ms[(rnd() * ms.length) | 0];
    this.kickPass(p, m.x + p.dir * 4, m.y, true, m);
  }
  aiSetPiece(p) {
    const sp = this.setPiece;
    p.mx = p.my = 0;
    if (sp.t < sp.wait) return;
    const d = p.dir, mates = this.teams[p.team].filter(m => m !== p);
    if (sp.type === "corner") {
      const inBox = mates.filter(m => d * m.x > F.HL - F.BOXL && Math.abs(m.y) < F.BOXW && !m.isGK);
      const m = inBox.length ? inBox[(rnd() * inBox.length) | 0] : null;
      this.kickPass(p, m ? m.x : d * (F.HL - 9), m ? m.y : (rnd() - 0.5) * 8, true, m);
    } else if (sp.type === "goalkick") this.gkDistribute(p);
    else {
      let best = null, bs = -1e9;
      for (const m of mates) {
        if (m.isGK) continue;
        const dist = hyp(m.x - p.x, m.y - p.y);
        if (dist < 4 || dist > 26) continue;
        let open = 9; for (const o of this.teams[1 - p.team]) open = Math.min(open, hyp(o.x - m.x, o.y - m.y));
        const s = open - dist * 0.15 + (sp.type === "kickoff" ? -d * (m.x - p.x) * 0.3 : d * (m.x - p.x) * 0.1) + rnd();
        if (s > bs) { bs = s; best = m; }
      }
      if (best) this.aiPass(p, best, false); else this.kickPass(p, p.x + d * 12, p.y * 0.5, true, null);
    }
  }

  /* ------------------------------ física ------------------------------ */
  movePlayers() {
    const b = this.ball;
    for (const p of this.players) {
      if (p.kickCd > 0) p.kickCd--;
      if (p.lungeCd > 0) p.lungeCd--;
      if (p.protect > 0) p.protect--;
      let dvx = 0, dvy = 0, maxA = 36;
      if (p.stun > 0) p.stun--;
      else if (p.lunge > 0) {
        dvx = p.lx * 12.5; dvy = p.ly * 12.5; maxA = 95;
        if (--p.lunge === 0) p.stun = p.lungeWon ? 8 : 30;
      } else {
        let vmax = speedOf(p) * this.par[p.team].spd;
        if (p.sprint && !p.tired && (p.mx || p.my)) { vmax *= 1.3; p.stamina -= 0.1 * DT; if (p.stamina <= 0.02) p.tired = true; }
        else { p.stamina = Math.min(1, p.stamina + 0.06 * DT); if (p.stamina > 0.22) p.tired = false; }
        if (b.owner === p) { vmax *= 0.92; maxA = 30; }
        if (p.dive) { vmax = 8.5 + p.a.gk * 0.042; maxA = 80; }
        const f = p.human ? 1 : p.frac;
        dvx = p.mx * vmax * f; dvy = p.my * vmax * f;
      }
      let ax = dvx - p.vx, ay = dvy - p.vy; const al = hyp(ax, ay), m = maxA * DT;
      if (al > m) { ax *= m / al; ay *= m / al; }
      p.vx += ax; p.vy += ay;
      p.x += p.vx * DT; p.y += p.vy * DT;
      const sp = hyp(p.vx, p.vy);
      if (sp > 0.8) { const k = 0.22; p.fx += (p.vx / sp - p.fx) * k; p.fy += (p.vy / sp - p.fy) * k; const fl = hyp(p.fx, p.fy) || 1; p.fx /= fl; p.fy /= fl; }
      p.x = clamp(p.x, -F.HL - 3, F.HL + 3); p.y = clamp(p.y, -F.HW - 3, F.HW + 3);
      if (p.isGK && p.dir * p.x < -F.HL + 0.6) p.x = -p.dir * (F.HL - 0.6);
    }
    // jogadores não se atravessam
    const ps = this.players;
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], c = ps[j], dx = c.x - a.x, dy = c.y - a.y, d = hyp(dx, dy);
      if (d < 1.25 && d > 0.001) { const k = (1.25 - d) / d / 2; a.x -= dx * k; a.y -= dy * k; c.x += dx * k; c.y += dy * k; }
    }
    const sp = this.setPiece;
    if (sp) {
      const t = sp.taker; t.x = sp.px; t.y = sp.py; t.vx = t.vy = 0;
      const R = sp.type === "kickoff" ? F.CC : 7;
      for (const q of this.teams[1 - t.team]) {
        const dx = q.x - b.x, dy = q.y - b.y, d = hyp(dx, dy);
        if (d < R && d > 0.001) { q.x = b.x + (dx / d) * R; q.y = b.y + (dy / d) * R; }
        if (sp.type === "kickoff" && q.dir * q.x > -0.5) q.x = -q.dir * 0.5;
      }
      if (sp.type === "kickoff") for (const q of this.teams[t.team]) if (q !== t && q.dir * q.x > -0.5) q.x = -q.dir * 0.5;
    }
  }
  updateBall() {
    const b = this.ball;
    if (b.owner) {
      const p = b.owner;
      if (b.held && !this.setPiece) { p.fx = p.dir; p.fy = 0; }
      const tx = p.x + p.fx * 0.95, ty = p.y + p.fy * 0.95;
      b.x += (tx - b.x) * 0.42; b.y += (ty - b.y) * 0.42; b.vx = p.vx; b.vy = p.vy; b.z = 0; b.vz = 0;
      if (!this.setPiece) this.stats.poss[p.team]++;
      return;
    }
    if (b.z > 0 || b.vz > 0) {
      b.vz -= GRAV * DT; b.z += b.vz * DT;
      const k = Math.exp(-KAIR * DT); b.vx *= k; b.vy *= k;
      if (b.z <= 0) { b.z = 0; if (b.vz < -3) { b.vz = -b.vz * 0.45; b.vx *= 0.78; b.vy *= 0.78; } else b.vz = 0; }
    } else {
      const k = Math.exp(-KGROUND * DT); b.vx *= k; b.vy *= k;
      if (hyp(b.vx, b.vy) < 0.12) b.vx = b.vy = 0;
    }
    b.x += b.vx * DT; b.y += b.vy * DT;
    if (b.noTakeT > 0) b.noTakeT--;
    let best = null, bd = 1e9;
    const passing = (b.type === "pass" || b.type === "lob") && !!b.last;
    for (const p of this.players) {
      if (p.stun > 0 || (p === b.noTake && b.noTakeT > 0)) continue;
      const gk = p.isGK && this.inOwnBox(p);
      if (b.z > (gk ? 2.5 : 1.5)) continue;
      const d = hyp(p.x - b.x, p.y - b.y);
      const against = passing && p.team !== b.last.team && !gk;   // cortar passe exige estar bem na linha da bola
      if (d < (gk ? (p.dive ? 1.95 : 1.5) : p.lunge > 0 ? 1.4 : against ? 0.85 : b.target === p ? 1.5 : 1.15) && d < bd) { bd = d; best = p; }
    }
    if (best) this.touch(best);
  }
  own(p) {
    const b = this.ball;
    if ((b.type === "pass" || b.type === "lob") && b.last && b.last !== p) { if (b.last.team === p.team) this.stats.passOk[p.team]++; else this.stats.inter[p.team]++; }
    b.owner = p; b.last = p; b.type = "own"; b.target = null; b.vz = 0; b.z = 0; b.gkPlan = null;
    p.protect = 14; p.think = 5 + ((rnd() * 8) | 0); p.plan = null; p.rushed = false; p.gotAt = this.tickN; b.through = false;
    if (this.human === p.team && !p.isGK) this.setCtrl(p);
  }
  touch(p) {
    const b = this.ball, sp = hyp(b.vx - p.vx, b.vy - p.vy);
    if (p.isGK && this.inOwnBox(p)) {
      if (b.type === "shot" && b.last && b.last.team !== p.team) {
        if (b.saveRoll) return;
        b.saveRoll = true; this.stats.target[1 - p.team]++;
        const prob = clamp(0.42 + (p.a.gk - 60) * 0.009 - Math.max(0, sp - 22) * 0.02 + (p.dive ? 0 : 0.08) + this.par[p.team].gkb, 0.08, 0.92);
        if (rnd() >= prob) {
          if (rnd() < 0.5 + (p.a.gk - 60) * 0.008) {   // espalma
            const d = p.dir, s = sp * 0.38;
            b.vx = d * s * (rnd() * 0.9 - 0.4); b.vy = (rnd() < 0.5 ? -1 : 1) * s * (0.5 + rnd() * 0.7); b.vz = 2 + rnd() * 3;
            b.type = "loose"; b.last = p; b.noTake = p; b.noTakeT = 26; b.target = null;
            this.events.push({ t: "save" });
          } else { b.noTake = p; b.noTakeT = 40; }       // passou por ele
          return;
        }
        this.events.push({ t: "save" });
      }
      this.own(p); b.held = true;
      return;
    }
    if ((b.type === "pass" || b.type === "lob") && b.last && b.last.team !== p.team && sp > 8 + p.a.def * 0.07) {
      // passe firme: o marcador só resvala e a bola segue
      this.stats.defl++;
      const a = (rnd() - 0.5) * 0.5, c = Math.cos(a), sn = Math.sin(a), vx = b.vx * 0.8, vy = b.vy * 0.8;
      b.vx = vx * c - vy * sn; b.vy = vx * sn + vy * c; b.noTake = p; b.noTakeT = 12;
      return;
    }
    const cap = 14 + p.a.dri * 0.1 + (b.target === p ? 10 : 0) + (p.lunge > 0 ? -4 : 0);
    if (sp > cap) {   // bola rápida demais: desvia
      this.stats.defl++;
      b.vx = b.vx * 0.3 + p.vx * 0.4 + (rnd() - 0.5) * 4; b.vy = b.vy * 0.3 + p.vy * 0.4 + (rnd() - 0.5) * 4;
      b.vz = Math.abs(b.vz) * 0.3 + (sp > 22 ? 2 : 0);
      b.noTake = p; b.noTakeT = 9; b.last = p; b.type = "loose"; b.target = null;
      return;
    }
    this.own(p);
  }
  contest() {
    const b = this.ball, o = b.owner;
    if (!o || b.held || o.protect > 0 || this.setPiece) return;
    for (const q of this.teams[1 - o.team]) {
      if (q.stun > 0) continue;
      const d = hyp(q.x - b.x, q.y - b.y);
      if (d > (q.lunge > 0 ? 1.55 : 1.2)) continue;
      const rx = q.x - o.x, ry = q.y - o.y, rl = hyp(rx, ry) || 1, front = (rx * o.fx + ry * o.fy) / rl;
      const ang = front > 0.2 ? 1 : front > -0.4 ? 0.7 : 0.4;
      let rate = 3.2 * (q.a.def / (q.a.def + o.a.dri)) * ang * (q.lunge > 0 ? 3 : 1) * this.par[q.team].tkl;
      if (o.human) rate *= lerp(0.75, 1.35, this.par[q.team].L);
      if (rnd() < rate * DT) {
        o.stun = 26; q.lungeWon = true;
        if (q.lunge > 0) {
          b.owner = null; b.vx = q.lx * 7 + (rnd() - 0.5) * 3; b.vy = q.ly * 7 + (rnd() - 0.5) * 3; b.type = "loose"; b.last = q; b.noTake = o; b.noTakeT = 30; b.target = null;
        } else this.own(q);
        this.stats.tackles[q.team]++;
        this.events.push({ t: "tackle" });
        return;
      }
    }
  }
  checkOut() {
    const b = this.ball;
    if (this.setPiece || b.held) return;
    if (Math.abs(b.x) > F.HL) {
      const side = b.x > 0 ? 1 : -1, ay = Math.abs(b.y), free = !b.owner;
      if (free && ay > F.GW - 0.12 && ay < F.GW + 0.22 && b.z < F.GH + 0.2 && Math.abs(b.x) < F.HL + 0.8) {   // trave
        b.x = side * (F.HL - 0.1); b.vx = -b.vx * 0.55; b.vy += Math.sign(b.y) * 2; this.events.push({ t: "post" }); return;
      }
      if (free && ay < F.GW && b.z > F.GH - 0.1 && b.z < F.GH + 0.25 && Math.abs(b.x) < F.HL + 0.8) {         // travessão
        b.x = side * (F.HL - 0.1); b.vx = -b.vx * 0.5; b.vz = -Math.abs(b.vz) * 0.3; this.events.push({ t: "post" }); return;
      }
      if (ay < F.GW && b.z < F.GH) { this.goal(side === 1 ? 0 : 1); return; }
      if (Math.abs(b.x) > F.HL + 0.3) {
        const defending = side === 1 ? 1 : 0, lt = b.last ? b.last.team : defending;
        const sy = b.y >= 0 ? 1 : -1;
        if (lt === defending) this.startDead("corner", 1 - defending, side * (F.HL - 0.4), sy * (F.HW - 0.4));
        else this.startDead("goalkick", defending, side * (F.HL - F.SIXL), sy * 5);
      }
      return;
    }
    if (Math.abs(b.y) > F.HW + 0.15) {
      const lt = b.last ? b.last.team : 0;
      this.startDead("throwin", 1 - lt, clamp(b.x, -F.HL + 1, F.HL - 1), Math.sign(b.y) * F.HW);
    }
  }
  goal(team) {
    const b = this.ball, by = b.last, own = !!by && by.team !== team;
    this.score[team]++;
    this.goals.push({ team, name: by ? by.name : "", i: by ? by.i : -1, own, min: this.minute() });
    this.stats.target[team] += b.saveRoll ? 0 : 1;
    b.owner = null; b.held = false;
    this.state = "goal"; this.timer = 170; this.kickNext = 1 - team;
    this.events.push({ t: "goal", team, name: by ? by.name : "", own });
    const limit = this.et ? 5400 : this.halfTicks;
    if (this.et || (this.clock >= limit && this.half >= 2)) this.pendingEnd = true;
  }

  /* ------------------------------ bola parada ------------------------------ */
  startDead(type, team, x, y) {
    const b = this.ball;
    b.owner = null; b.held = false; b.x = x; b.y = y; b.z = 0; b.vx = b.vy = b.vz = 0; b.target = null; b.type = "loose"; b.gkPlan = null;
    const mine = this.teams[team], d = team === 0 ? 1 : -1;
    let taker;
    if (type === "goalkick") taker = mine[0];
    else if (type === "kickoff") taker = mine[mine.length - 1];
    else if (type === "corner") taker = mine.filter(p => p.pos === "M").sort((a, c) => c.a.pas - a.a.pas)[0] || mine[5];
    else taker = this.closestTo(team, x, y);
    this.state = "dead"; this.setPiece = null;
    this.dead = { type, team, x, y, t: 0, taker };
    const side = Math.sign(x) || 1;
    for (const p of this.players) {
      const ph = p.team === team ? 1 : -1;
      let [tx, ty] = this.basePos(p, type === "kickoff" ? 0 : ph);
      if (type === "kickoff" && !p.isGK) {
        tx = p.dir * Math.min(-1.5, p.slot.u * F.HL * 0.62 - 9); ty = p.dir * p.slot.v * F.HW * 0.8;
        if (p.team !== team && hyp(tx, ty) < F.CC + 1) tx = -p.dir * (F.CC + 1.5);
      } else if (type === "corner" && !p.isGK) {
        if (p.team === team ? (p.pos === "A" || (p.pos === "M" && p.idx % 2 === 0)) : p.pos !== "A") {
          tx = side * (F.HL - 3 - rnd() * 10); ty = (rnd() - 0.5) * 16;
        }
      } else if (type === "goalkick" && p.team !== team && !p.isGK) {
        if (hyp(tx - x, ty - y) < 20) tx = x - side * 20;
      }
      p.tx = tx; p.ty = ty; p.mx = p.my = 0; p.plan = null; p.lunge = 0; p.stun = 0; p.dive = false; p.hold = 0;
    }
    // o cobrador fica "por fora" da bola, de frente para o campo
    let ox = 0, oy = 0;
    if (type === "kickoff") ox = -d * 1.0;
    else if (type === "throwin") oy = Math.sign(y) * 0.9;
    else if (type === "corner") { ox = side * 0.7; oy = Math.sign(y) * 0.7; }
    else ox = side * 1.0;
    taker.tx = x + ox; taker.ty = y + oy;
    this.dead.fx = -ox; this.dead.fy = -oy;
    this.events.push({ t: "dead", type, team });
    if (this.human === team && type !== "goalkick") this.setCtrl(taker);
  }
  tickDead() {
    const dd = this.dead, b = this.ball;
    dd.t++;
    for (const p of this.players) { p.x += (p.tx - p.x) * 0.09; p.y += (p.ty - p.y) * 0.09; p.vx = p.vy = 0; p.stamina = Math.min(1, p.stamina + 0.12 * DT); }
    b.x = dd.x; b.y = dd.y;
    if (dd.t >= (dd.type === "kickoff" ? 62 : 78)) {
      const t = dd.taker, fl = hyp(dd.fx, dd.fy) || 1;
      t.x = t.tx; t.y = t.ty; t.fx = dd.fx / fl; t.fy = dd.fy / fl;
      b.owner = t; b.held = true; b.last = t; b.type = "own";
      this.setPiece = { taker: t, type: dd.type, t: 0, px: t.x, py: t.y, wait: 28 + ((rnd() * 30) | 0) };
      this.state = "play"; this.dead = null;
      if (dd.type === "kickoff") this.events.push({ t: "whistle" });
    }
  }

  /* ------------------------------ laço ------------------------------ */
  tick(input) {
    this.events.length = 0;
    this.tickN++;
    if (this.state === "end") return;
    if (this.state === "goal" || this.state === "break") {
      const b = this.ball;
      if (this.state === "goal") {   // bola morre na rede
        b.x += b.vx * DT; b.y += b.vy * DT; b.vx *= 0.9; b.vy *= 0.9; b.z = Math.max(0, b.z + b.vz * DT); b.vz -= GRAV * DT;
        b.x = clamp(b.x, -F.HL - 2, F.HL + 2); b.y = clamp(b.y, -F.GW + 0.3, F.GW - 0.3);
      }
      for (const p of this.players) { p.mx = p.my = 0; p.vx *= 0.9; p.vy *= 0.9; p.x += p.vx * DT; p.y += p.vy * DT; }
      if (--this.timer <= 0) {
        if (this.state === "goal") {
          if (this.pendingEnd) { this.finish(); return; }
          this.startDead("kickoff", this.kickNext, 0, 0);
        } else {
          if (this.half === 1) { this.half = 2; this.clock = 0; this.startDead("kickoff", 1 - this.kick0, 0, 0); }
          else { this.et = true; this.half = 3; this.clock = 0; this.startDead("kickoff", this.kick0, 0, 0); }
        }
      }
      return;
    }
    if (this.state === "dead") { this.tickDead(); return; }
    if (this.setPiece) {
      const sp = this.setPiece; sp.t++;
      // o humano demorou: a IA cobra por ele
      if (sp.taker === this.ctrl && sp.t > 420) { this.ctrl.human = false; const c = this.ctrl; this.ctrl = null; sp.wait = 0; this.aiSetPiece(c); this.setCtrl(c); }
    }
    this.handleHuman(input);
    this.think();
    this.movePlayers();
    this.updateBall();
    this.contest();
    this.checkOut();
    if (this.state !== "play") return;
    if (!this.setPiece) this.clock++;
    const limit = this.et ? 5400 : this.halfTicks;
    if (this.clock >= limit) {
      const b = this.ball, danger = Math.abs(b.x) > F.HL - 22 && (b.owner || hyp(b.vx, b.vy) > 3);
      if (!danger || this.clock > limit + 240) this.endPeriod();
    }
  }
  tied() { return this.score[0] + (this.cfg.aggDiff || 0) === this.score[1]; }
  endPeriod() {
    this.events.push({ t: "whistle2", half: this.half });
    if (this.half === 1) { this.state = "break"; this.timer = 170; return; }
    if (this.half === 2 && this.cfg.needWinner && this.tied()) { this.state = "break"; this.timer = 190; this.events.push({ t: "extra" }); return; }
    this.finish();
  }
  finish() {
    this.state = "end";
    this.needPens = !!this.cfg.needWinner && this.tied();
    this.result = { score: this.score.slice(), et: this.et, needPens: this.needPens, goals: this.goals.slice() };
    this.events.push({ t: "end" });
  }
}
