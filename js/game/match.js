// Controlador de uma partida (sem DOM): tempo, placar, saídas de bola, prorrogação com gol de ouro.
import { World, makePitch } from "./physics.js";
import { TeamAI, FORMATIONS } from "./ai.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const DIFF_BASE = [0.3, 0.52, 0.74, 0.95];

/* cfg: { size, mins, ratings:[esq, dir], human: 0|null, diff, needWinner, aggDiff (saldo agregado a favor do time da esquerda antes do jogo), kickoff } */
export class Match {
  constructor(cfg) {
    this.cfg = cfg;
    const size = cfg.size || 4;
    this.pitch = makePitch(size);
    this.w = new World(this.pitch);
    this.teams = [[], []];
    const form = FORMATIONS[size];
    for (const t of [0, 1]) form.forEach(([role, u, y], i) => {
      const p = this.w.addPlayer(t, role, i + 1);
      p.homeU = u; p.homeY = y * this.pitch.HH;
      this.teams[t].push(p);
    });
    const [r0, r1] = cfg.ratings || [70, 70];
    const d = clamp((r0 - r1) / 60, -0.2, 0.2);
    const human = cfg.human === 0 || cfg.human === 1 ? cfg.human : null;
    const base = DIFF_BASE[cfg.diff ?? 1];
    const lv = cfg.levels || (human === null ? [0.62 + d, 0.62 - d] : human === 0 ? [0.6 + d, base - d] : [base + d, 0.6 - d]);
    this.ai = [new TeamAI(this.w, 0, lv[0]), new TeamAI(this.w, 1, lv[1])];
    this.human = human;
    this.ctrl = null;                 // jogador controlado
    this.switchCd = 0;
    this.auto = cfg.autoSwitch !== false;
    if (human !== null) {
      const adv = clamp(((human === 0 ? r0 - r1 : r1 - r0)) / 400, -0.05, 0.05);
      for (const p of this.teams[human]) { p.humanSpeed = 1 + adv; p.humanPower = 1 + adv * 0.6; }
      this.setCtrl(this.teams[human][this.teams[human].length - 1]);
    }
    for (const a of this.ai) a.bind();
    this.score = [0, 0];
    this.half = 1;
    this.halfTicks = Math.round((cfg.mins || 3) * 60 * 60 / 2);
    this.clock = 0;                   // ticks jogados no tempo atual
    this.state = "pre"; this.timer = 70;
    this.kickTeam = cfg.kickoff ?? 0;
    this.events = [];
    this.et = false; this.result = null; this.needPens = false;
    this.stats = { shots: [0, 0], poss: [0, 0] };
    this.placeKickoff();
  }
  setCtrl(p) {
    if (this.ctrl === p) return;
    if (this.ctrl) { this.ctrl.human = false; this.ctrl.ix = this.ctrl.iy = 0; this.ctrl.kick = false; }
    this.ctrl = p;
    if (p) { p.human = true; p.speed = p.humanSpeed; p.power = p.humanPower; }
    for (const a of this.ai) a.bind();
    if (p) { p.speed = p.humanSpeed; p.power = p.humanPower; }
    this.switchCd = 24;
  }
  placeKickoff() {
    const P = this.pitch;
    for (const t of [0, 1]) for (const p of this.teams[t]) {
      const dir = t === 0 ? 1 : -1;
      let u = p.homeU * P.HW, y = p.homeY;
      if (p.role === "F") u = Math.min(u, -P.CC - 30);
      p.x = dir * u; p.y = y; p.vx = p.vy = 0; p.ix = p.iy = 0; p.kick = false; p.cd = 0;
    }
    // quem dá a saída encosta um jogador na bola
    const kt = this.teams[this.kickTeam], k = kt[kt.length - 1], dir = this.kickTeam === 0 ? 1 : -1;
    k.x = -dir * (P.PR + P.BR + 6); k.y = 0;
    this.w.resetBall();
    this.w.restrict = { team: 1 - this.kickTeam };
    this.sinceKickoff = 0;
    if (this.human !== null && this.auto) this.setCtrl(this.pickClosest(null) || this.ctrl);
  }
  pickClosest(except) {
    const b = this.w.ball;
    let best = null, bd = 1e9;
    for (const p of this.teams[this.human]) {
      if (p.role === "G" || p === except) continue;
      const d = Math.hypot(p.x - b.x - b.vx * 12, p.y - b.y - b.vy * 12);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  switchPlayer() { if (this.human !== null) { const p = this.pickClosest(this.ctrl); if (p) this.setCtrl(p); } }

  // input = { x, y, kick } para o jogador humano (coordenadas do mundo)
  tick(input) {
    const w = this.w;
    this.events.length = 0;
    if (this.state === "end") return;
    if (this.state === "pre" || this.state === "goal" || this.state === "break") {
      for (const p of w.players) { p.ix = p.iy = 0; p.kick = false; }
      if (this.state === "goal") w.step();
      if (--this.timer <= 0) {
        if (this.state === "goal") {
          if (this.et || this.pendingEnd) { this.finish(); return; }
          this.placeKickoff(); this.state = "pre"; this.timer = 45;
        } else if (this.state === "break") {
          if (this.half === 1) { this.half = 2; this.kickTeam = 1 - (this.cfg.kickoff ?? 0); }
          else { this.et = true; this.half = 3; this.kickTeam = this.cfg.kickoff ?? 0; }
          this.clock = 0; this.placeKickoff(); this.state = "pre"; this.timer = 60;
        } else { this.state = "play"; this.events.push({ t: "whistle" }); }
      }
      return;
    }
    // jogo rolando
    for (const a of this.ai) a.update(this.ctrl);
    if (this.ctrl && input) { this.ctrl.ix = input.x; this.ctrl.iy = input.y; this.ctrl.kick = !!input.kick; }
    const conceded = w.step();
    for (const e of w.events) this.events.push(e);
    this.sinceKickoff++;
    if (w.restrict && (w.touched || this.sinceKickoff > 300)) w.restrict = null;
    if (w.touched || this.sinceKickoff > 300) this.clock++;
    if (w.lastTouch) this.stats.poss[w.lastTouch.team]++;
    // troca automática de jogador
    if (this.human !== null) {
      if (this.switchCd > 0) this.switchCd--;
      else if (this.auto && this.ctrl) {
        const b = w.ball, cur = Math.hypot(this.ctrl.x - b.x, this.ctrl.y - b.y);
        if (cur > 70) { const c = this.pickClosest(null); if (c && c !== this.ctrl && Math.hypot(c.x - b.x - b.vx * 12, c.y - b.y - b.vy * 12) < cur - 45) this.setCtrl(c); }
      }
    }
    if (conceded >= 0) {
      const scorer = 1 - conceded;
      this.score[scorer]++;
      this.kickTeam = conceded;
      this.state = "goal"; this.timer = 115;
      this.events.push({ t: "goal", team: scorer, by: w.lastTouch });
      if (this.clock >= this.halfTicks && this.half >= 2) this.pendingEnd = true;
      return;
    }
    const limit = this.et ? Math.round(60 * 60) : this.halfTicks;
    if (this.clock >= limit) {
      // só apita com a bola longe das áreas (evita cortar lance de gol)
      const b = w.ball, danger = Math.abs(b.x) > this.pitch.HW * 0.72 && Math.hypot(b.vx, b.vy) > 1.2;
      if (!danger || this.clock > limit + 180) this.endPeriod();
    }
  }
  tied() { return this.score[0] + (this.cfg.aggDiff || 0) === this.score[1]; }
  endPeriod() {
    this.events.push({ t: "whistle2" });
    if (this.half === 1) { this.state = "break"; this.timer = 150; return; }
    if (this.half === 2 && this.cfg.needWinner && this.tied()) { this.state = "break"; this.timer = 170; this.events.push({ t: "extra" }); return; }
    this.finish();
  }
  finish() {
    this.state = "end";
    this.needPens = !!this.cfg.needWinner && this.tied();
    this.result = { score: this.score.slice(), et: this.et, needPens: this.needPens };
    this.events.push({ t: "end" });
  }
  // relógio para exibição (escala de 90 minutos)
  clockText() {
    if (this.et) { const s = Math.min(60, Math.floor(this.clock / 60)); return "PRO " + String(60 - s).padStart(2, "0") + "s"; }
    const f = Math.min(1, this.clock / this.halfTicks), m = Math.floor((this.half - 1) * 45 + f * 45);
    return String(Math.min(m, this.half * 45)).padStart(2, "0") + "'";
  }
}
