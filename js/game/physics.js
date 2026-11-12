// Física do jogo: discos (jogadores e bola), paredes, traves e gols. Passo fixo de 60 Hz.
export const TICK = 1 / 60;
const ACC = 0.115, ACC_KICK = 0.085, P_DAMP = 0.96, B_DAMP = 0.99;
export const KICK = 5.3, KICK_RANGE = 4, KICK_CD = 14;

export function makePitch(size) {
  const base = size <= 3 ? { HW: 360, HH: 205, GOAL: 68 } : size === 4 ? { HW: 425, HH: 235, GOAL: 74 } : { HW: 485, HH: 262, GOAL: 80 };
  return { ...base, GD: 34, M: 30, PR: 15, BR: 8.5, POST: 6, CC: 66, size };
}

export class World {
  constructor(pitch) {
    this.p = pitch;
    this.ball = { x: 0, y: 0, vx: 0, vy: 0, r: pitch.BR, im: 1 };
    this.players = [];
    this.posts = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) this.posts.push({ x: sx * pitch.HW, y: sy * pitch.GOAL, r: pitch.POST });
    this.events = [];
    this.touched = false;     // a bola já foi tocada desde a última saída?
    this.lastTouch = null;
    this.restrict = null;     // { team } impedido de invadir o campo adversário/círculo até a saída
  }
  addPlayer(team, role, num) {
    const p = { x: 0, y: 0, vx: 0, vy: 0, r: this.p.PR, im: 0.5, team, role, num, ix: 0, iy: 0, kick: false, cd: 0, speed: 1, power: 1, kickFx: 0 };
    this.players.push(p);
    return p;
  }
  resetBall() { const b = this.ball; b.x = b.y = b.vx = b.vy = 0; this.touched = false; this.lastTouch = null; }

  step() {
    const P = this.p, b = this.ball, ps = this.players;
    this.events.length = 0;
    // entradas e chutes
    for (const p of ps) {
      let ix = p.ix, iy = p.iy;
      const l = Math.hypot(ix, iy);
      if (l > 1) { ix /= l; iy /= l; }
      const acc = (p.kick ? ACC_KICK : ACC) * p.speed;
      p.vx += ix * acc; p.vy += iy * acc;
      if (p.cd > 0) p.cd--;
      if (p.kickFx > 0) p.kickFx--;
      if (p.kick && p.cd === 0) {
        const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy);
        if (d > 0 && d - p.r - b.r < KICK_RANGE) {
          const k = KICK * p.power;
          b.vx += (dx / d) * k; b.vy += (dy / d) * k;
          p.cd = KICK_CD; p.kickFx = 8;
          this.touched = true; this.lastTouch = p;
          this.events.push({ t: "kick", p });
        }
      }
    }
    // movimento
    for (const p of ps) { p.x += p.vx; p.y += p.vy; p.vx *= P_DAMP; p.vy *= P_DAMP; }
    b.x += b.vx; b.y += b.vy; b.vx *= B_DAMP; b.vy *= B_DAMP;
    // colisões entre jogadores
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) collide(ps[i], ps[j], 0.5);
    // jogador x bola
    for (const p of ps) if (collide(p, b, 0.3)) { this.touched = true; this.lastTouch = p; }
    // traves
    for (const post of this.posts) {
      if (collideStatic(b, post, 0.6)) this.events.push({ t: "post" });
      for (const p of ps) collideStatic(p, post, 0.3);
    }
    // limites dos jogadores
    const mx = P.HW + P.M, my = P.HH + P.M;
    for (const p of ps) {
      if (p.x < -mx + p.r) { p.x = -mx + p.r; p.vx = 0; } else if (p.x > mx - p.r) { p.x = mx - p.r; p.vx = 0; }
      if (p.y < -my + p.r) { p.y = -my + p.r; p.vy = 0; } else if (p.y > my - p.r) { p.y = my - p.r; p.vy = 0; }
    }
    // saída de bola: adversário fica no próprio campo e fora do círculo central
    if (this.restrict && !this.touched) {
      for (const p of ps) {
        if (p.team !== this.restrict.team) continue;
        const side = p.team === 0 ? -1 : 1;
        if (p.x * side < p.r) { p.x = side * p.r; p.vx = 0; }
        const d = Math.hypot(p.x, p.y), min = P.CC + p.r;
        if (d < min && d > 0) { p.x = (p.x / d) * min; p.y = (p.y / d) * min; }
      }
    }
    // paredes para a bola
    const inMouth = Math.abs(b.y) < P.GOAL;
    if (Math.abs(b.x) <= P.HW || !inMouth) {
      if (b.y < -P.HH + b.r) { b.y = -P.HH + b.r; b.vy = Math.abs(b.vy) * 0.9; this.events.push({ t: "wall" }); }
      else if (b.y > P.HH - b.r) { b.y = P.HH - b.r; b.vy = -Math.abs(b.vy) * 0.9; this.events.push({ t: "wall" }); }
      if (!inMouth) {
        if (b.x < -P.HW + b.r) { b.x = -P.HW + b.r; b.vx = Math.abs(b.vx) * 0.9; this.events.push({ t: "wall" }); }
        else if (b.x > P.HW - b.r) { b.x = P.HW - b.r; b.vx = -Math.abs(b.vx) * 0.9; this.events.push({ t: "wall" }); }
      }
    }
    if (Math.abs(b.x) > P.HW && inMouth) {
      // dentro da rede
      const lim = P.GOAL - b.r;
      if (b.y < -lim) { b.y = -lim; b.vy = Math.abs(b.vy) * 0.2; } else if (b.y > lim) { b.y = lim; b.vy = -Math.abs(b.vy) * 0.2; }
      const back = P.HW + P.GD - b.r;
      if (b.x < -back) { b.x = -back; b.vx = Math.abs(b.vx) * 0.15; } else if (b.x > back) { b.x = back; b.vx = -Math.abs(b.vx) * 0.15; }
    }
    // gol? (retorna o lado que SOFREU o gol: 0 = esquerda, 1 = direita)
    if (inMouth && b.x < -P.HW - b.r * 0.5) return 0;
    if (inMouth && b.x > P.HW + b.r * 0.5) return 1;
    return -1;
  }
}

function collide(a, b, e) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r;
  if (d >= min || d === 0) return false;
  const nx = dx / d, ny = dy / d, ov = min - d, tot = a.im + b.im;
  a.x -= nx * ov * (a.im / tot); a.y -= ny * ov * (a.im / tot);
  b.x += nx * ov * (b.im / tot); b.y += ny * ov * (b.im / tot);
  const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rel < 0) {
    const j = (-(1 + e) * rel) / tot;
    a.vx -= nx * j * a.im; a.vy -= ny * j * a.im;
    b.vx += nx * j * b.im; b.vy += ny * j * b.im;
  }
  return true;
}
function collideStatic(a, s, e) {
  const dx = a.x - s.x, dy = a.y - s.y, d = Math.hypot(dx, dy), min = a.r + s.r;
  if (d >= min || d === 0) return false;
  const nx = dx / d, ny = dy / d;
  a.x = s.x + nx * min; a.y = s.y + ny * min;
  const vn = a.vx * nx + a.vy * ny;
  if (vn < 0) { a.vx -= (1 + e) * vn * nx; a.vy -= (1 + e) * vn * ny; }
  return true;
}
// soma geométrica do amortecimento da bola: deslocamento após n ticks = v * decay(n)
export const decay = n => (1 - Math.pow(B_DAMP, n)) / (1 - B_DAMP);
