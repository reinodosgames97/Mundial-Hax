// Inteligência artificial dos jogadores (goleiro, perseguidor da bola e apoio).
import { decay, KICK_RANGE } from "./physics.js";
import { rnd } from "../core/rng.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// posições-base por tamanho de time: [papel, u, y] com u de -1 (próprio gol) a 1 (gol adversário)
export const FORMATIONS = {
  3: [["G", -0.93, 0], ["D", -0.42, -0.12], ["F", 0.12, 0.15]],
  4: [["G", -0.93, 0], ["D", -0.5, 0], ["F", -0.02, -0.5], ["F", -0.02, 0.5]],
  5: [["G", -0.93, 0], ["D", -0.55, -0.35], ["D", -0.55, 0.35], ["F", -0.02, -0.5], ["F", -0.02, 0.5]],
};

export class TeamAI {
  constructor(world, team, level) {
    this.w = world; this.team = team; this.dir = team === 0 ? 1 : -1;
    this.setLevel(level);
    this.mates = []; this.opps = [];
    this.plan = new Map();   // decisão em cache por jogador
    this.t = (rnd() * 10) | 0;
    this.chaser = null;
  }
  setLevel(level) {
    this.level = clamp(level, 0.05, 1.15);
    const L = this.level;
    this.react = Math.round(15 - 11 * Math.min(L, 1));
    this.noise = Math.max(0.03, 0.5 - 0.43 * L);
    this.tol = 0.6 - 0.3 * Math.min(L, 1);
    this.pred = 0.35 + 0.65 * Math.min(L, 1);
    this.speed = 0.8 + 0.26 * L;
    this.power = 0.86 + 0.18 * Math.min(L, 1);
    this.gkLag = Math.round(10 - 9 * Math.min(L, 1));
  }
  bind() {
    this.mates = this.w.players.filter(p => p.team === this.team);
    this.opps = this.w.players.filter(p => p.team !== this.team);
    for (const p of this.mates) if (!p.human) { p.speed = this.speed; p.power = this.power; }
  }
  predict(p) {
    const b = this.w.ball, P = this.w.p;
    const n = clamp(dist(p, b) / 2.7, 0, 50) * this.pred, k = decay(n);
    return { x: clamp(b.x + b.vx * k, -P.HW + 4, P.HW - 4), y: clamp(b.y + b.vy * k, -P.HH + 4, P.HH - 4) };
  }
  update(human) {
    const w = this.w, P = w.p, b = w.ball, dir = this.dir;
    this.t++;
    const field = this.mates.filter(p => p.role !== "G");
    const gk = this.mates.find(p => p.role === "G");
    // quem vai na bola? (com histerese para não ficar trocando)
    const eta = p => dist(p, this.predict(p)) / (2.7 * p.speed) - (p === this.chaser ? 6 : 0);
    if (this.t % 6 === 0 || !this.chaser) {
      let best = null, bt = 1e9;
      for (const p of field) { const e = eta(p); if (e < bt) { bt = e; best = p; } }
      this.chaser = best;
    }
    const goalC = { x: -dir * P.HW, y: 0 };
    const ballToGoal = dist(b, goalC);
    const gkGoes = gk && ballToGoal < 135 && (!this.chaser || dist(gk, b) < dist(this.chaser, b) + 10) && Math.hypot(b.vx, b.vy) < 4.5;
    const oppNear = Math.min(...this.opps.map(o => dist(o, b)));
    const mateNear = Math.min(...this.mates.map(o => dist(o, b)));
    const weHave = mateNear < oppNear;
    let support = 0;
    for (const p of this.mates) {
      if (p === human) continue;
      if (p.role === "G") { this.keeper(p, gkGoes); continue; }
      if (p === this.chaser && !(w.restrict && w.restrict.team === this.team && !w.touched)) { this.chase(p, oppNear); continue; }
      this.support(p, support++, weHave, human && this.chaser === human);
    }
  }
  moveTo(p, x, y, slow = 22) {
    const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
    if (d < 3) { p.ix = p.iy = 0; return; }
    const s = Math.min(1, d / slow);
    p.ix = (dx / d) * s; p.iy = (dy / d) * s;
  }
  keeper(p, goes) {
    const w = this.w, P = w.p, b = w.ball, dir = this.dir, L = Math.min(this.level, 1);
    const gx = -dir * (P.HW - 20);
    p.kick = false;
    const near = dist(p, b) - p.r - b.r;
    if (goes) {
      // sai para afastar
      this.moveTo(p, b.x - dir * 6, b.y, 6);
      p.kick = near < KICK_RANGE + 1 && dir * (b.x - p.x) > -4;
      return;
    }
    if (this.gkLag > 1 && this.t % this.gkLag && p.gkT) { this.moveTo(p, p.gkT.x, p.gkT.y, 14); p.kick = near < KICK_RANGE + 1 && dir * (b.x - p.x) > 0; return; }
    let ty = b.y * (0.42 + 0.3 * L);
    // intercepta chutes a caminho do gol
    if (b.vx * dir < -0.6) {
      const t = (gx - b.x) / b.vx;
      if (t > 0 && t < 90) { const yi = b.y + b.vy * decay(t) / Math.max(1, t) * t; ty = ty * (1 - L) + clamp(yi, -P.GOAL - 10, P.GOAL + 10) * L; }
    }
    ty = clamp(ty, -P.GOAL + 6, P.GOAL - 6);
    const out = clamp((P.HW * 0.75 - Math.abs(b.x - gx)) / 14, 0, 26);
    p.gkT = { x: gx + dir * out, y: ty };
    this.moveTo(p, p.gkT.x, p.gkT.y, 14);
    p.kick = near < KICK_RANGE + 1 && dir * (b.x - p.x) > 0;
  }
  chase(p, oppNear) {
    const w = this.w, P = w.p, b = w.ball, dir = this.dir, L = Math.min(this.level, 1);
    let plan = this.plan.get(p);
    if (!plan || this.t - plan.t >= this.react) {
      plan = this.decide(p, oppNear); plan.t = this.t; this.plan.set(p, plan);
    }
    const bp = this.predict(p);
    let ax = plan.x - bp.x, ay = plan.y - bp.y;
    const al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al;
    const rx = p.x - bp.x, ry = p.y - bp.y;
    const along = rx * ax + ry * ay, lat = rx * ay - ry * ax, reach = p.r + b.r;
    if (along < -2 && Math.abs(lat) < 9 + (1 - L) * 6) {
      // alinhado atrás da bola: vai para cima dela
      this.moveTo(p, bp.x + ax * 14, bp.y + ay * 14, 4);
    } else if (along > -reach * 0.7) {
      // está na frente ou ao lado: contorna
      const side = lat >= 0 ? 1 : -1;
      this.moveTo(p, bp.x + ay * side * (reach + 12) - ax * (reach + 4), bp.y - ax * side * (reach + 12) - ay * (reach + 4), 4);
    } else this.moveTo(p, bp.x - ax * (reach - 3), bp.y - ay * (reach - 3), 4);
    // chute
    const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy) || 1;
    const near = d - reach < KICK_RANGE;
    const ang = Math.acos(clamp((dx * ax + dy * ay) / d, -1, 1));
    const ownThird = dir * b.x < -P.HW * 0.35;
    p.kick = false;
    if (near) {
      if (plan.kick && ang < this.tol) p.kick = true;
      else if (ownThird && oppNear < 55 && dx * dir > 0 && ang < 1.25) p.kick = true;   // alivia
    }
  }
  decide(p, oppNear) {
    const w = this.w, P = w.p, b = w.ball, dir = this.dir, L = Math.min(this.level, 1);
    const gx = dir * P.HW;
    const oppGk = this.opps.find(o => o.role === "G");
    const dGoal = Math.hypot(gx - b.x, b.y);
    const jitter = (rnd() - 0.5) * 2 * this.noise;
    // finalização
    if (dGoal < P.HW * (0.62 + 0.25 * L) && dir * b.x > -P.HW * 0.1) {
      let ty = oppGk && Math.abs(oppGk.y) > 6 ? -Math.sign(oppGk.y) * P.GOAL * 0.62 : (rnd() < 0.5 ? -1 : 1) * P.GOAL * 0.55;
      ty += jitter * dGoal * 0.9;
      return { x: gx, y: clamp(ty, -P.GOAL * 1.25, P.GOAL * 1.25), kick: true };
    }
    // passe para companheiro livre à frente
    let best = null, bs = -1e9;
    for (const m of this.mates) {
      if (m === p || m.role === "G") continue;
      const ahead = dir * (m.x - b.x);
      if (ahead < 50) continue;
      const free = Math.min(...this.opps.map(o => dist(o, m)));
      if (free < 60) continue;
      // linha de passe livre?
      const lx = m.x - b.x, ly = m.y - b.y, ll = Math.hypot(lx, ly);
      let blocked = false;
      for (const o of this.opps) { const t = clamp(((o.x - b.x) * lx + (o.y - b.y) * ly) / (ll * ll), 0, 1); if (Math.hypot(b.x + lx * t - o.x, b.y + ly * t - o.y) < 26) { blocked = true; break; } }
      if (blocked) continue;
      const s = ahead * 0.6 + free * 0.4 - Math.abs(m.y) * 0.1;
      if (s > bs) { bs = s; best = m; }
    }
    if (best && (oppNear < 95 || rnd() < 0.25 + 0.3 * L)) {
      const lead = 12 + 14 * L;
      return { x: best.x + best.vx * lead + jitter * 60, y: best.y + best.vy * lead + jitter * 60, kick: true };
    }
    // conduz em direção ao gol; se apertado, chuta para a frente
    const ty = clamp(b.y * 0.5, -P.GOAL, P.GOAL) + jitter * 80;
    return { x: gx, y: ty, kick: oppNear < 60 };
  }
  support(p, idx, weHave, humanChasing) {
    const w = this.w, P = w.p, b = w.ball, dir = this.dir;
    const bu = dir * b.x;   // posição da bola no eixo de ataque
    let u, y;
    p.kick = false;
    if (p.role === "D") {
      if (!weHave || bu < -P.HW * 0.2) {
        // protege: fica na linha bola -> gol
        const gx = -P.HW, f = 0.42;
        u = gx + (bu - gx) * f; y = b.y * f + (p.homeY || 0) * 0.25;
      } else { u = clamp(bu - 170, -P.HW * 0.78, P.HW * 0.15); y = b.y * 0.35 + (p.homeY || 0) * 0.5; }
    } else {
      const side = p.homeY ? Math.sign(p.homeY) : (idx % 2 ? 1 : -1);
      if (weHave) { u = clamp(bu + 150, -P.HW * 0.2, P.HW * 0.72); y = side * P.HH * 0.5 + b.y * 0.15; }
      else { u = clamp(bu + 60, -P.HW * 0.55, P.HW * 0.4); y = side * P.HH * 0.32 + b.y * 0.3; }
      // um atacante ajuda a marcar quando o humano está longe da jogada
      if (!weHave && !humanChasing && idx === 0 && bu < 0) { u = bu - 40; y = b.y; }
    }
    y = clamp(y, -P.HH + 20, P.HH - 20);
    this.moveTo(p, dir * u, y, 40);
    // toque de primeira se a bola vier
    const d = dist(p, b) - p.r - b.r;
    if (d < KICK_RANGE && dir * (b.x - p.x) > 0) p.kick = true;
  }
}
