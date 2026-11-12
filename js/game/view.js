// Tela da partida: câmera, desenho, radar, controles (toque, teclado e gamepad), placar, som e pênaltis.
import { Game, F } from "./engine.js";
import { rnd } from "../core/rng.js";

const TAU = Math.PI * 2;
const hex = h => { h = h.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
const cdist = (a, b) => { const x = hex(a), y = hex(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
const lum = c => { const [r, g, b] = hex(c); return r * 0.299 + g * 0.587 + b * 0.114; };
const GRASS = "#2e7d46";
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// escolhe cores de jogo evitando uniformes parecidos (e parecidos com o gramado)
export function kitColors(a, b) {
  const ok = c => cdist(c, GRASS) > 70;
  let A = ok(a.c1) ? [a.c1, a.c2] : [a.c2, a.c1];
  let B = ok(b.c1) ? [b.c1, b.c2] : [b.c2, b.c1];
  if (cdist(A[0], B[0]) < 110) {
    if (cdist(A[0], B[1]) >= 110 && ok(B[1])) B = [B[1], B[0]];
    else B = lum(A[0]) > 128 ? ["#1b1b1f", "#ffffff"] : ["#f4f4f4", "#111111"];
  }
  return [A, B];
}

/* ------------------------------ som ------------------------------ */
let actx = null;
function beep(freq, dur, type = "sine", vol = 0.08, slide = 0) {
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume();
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur);
  } catch (e) { /* sem áudio */ }
}
const SFX = {
  kick: () => beep(170, 0.07, "triangle", 0.14, -90),
  tackle: () => beep(110, 0.06, "square", 0.05),
  post: () => beep(880, 0.12, "square", 0.05),
  save: () => beep(260, 0.1, "triangle", 0.1, -120),
  whistle: () => { beep(2100, 0.25, "square", 0.04); setTimeout(() => beep(2300, 0.2, "square", 0.04), 60); },
  dead: () => beep(2000, 0.12, "square", 0.03),
  goal: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.22, "triangle", 0.1), i * 110)); },
  end: () => { beep(2100, 0.2, "square", 0.04); setTimeout(() => beep(2100, 0.2, "square", 0.04), 280); setTimeout(() => beep(2100, 0.5, "square", 0.04), 560); },
};

/* ------------------------------ gamepad ------------------------------ */
// Mapa padrão (Xbox): A passe/trocar, X ou B chute/bote, RT ou RB correr, LB ou Y trocar, Start pausa.
export function readPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const g of pads) {
    if (!g || !g.connected || g.buttons.length < 10) continue;
    const B = i => !!(g.buttons[i] && (g.buttons[i].pressed || g.buttons[i].value > 0.4));
    let x = g.axes[0] || 0, y = g.axes[1] || 0;
    if (Math.hypot(x, y) < 0.22) x = y = 0;
    if (B(14)) x = -1; if (B(15)) x = 1; if (B(12)) y = -1; if (B(13)) y = 1;
    return { x, y, a: B(0), b: B(1), xb: B(2), yb: B(3), lb: B(4), rb: B(5), lt: B(6), rt: B(7), start: B(9), select: B(8), up: B(12) || y < -0.6, down: B(13) || y > 0.6, left: B(14) || x < -0.6, right: B(15) || x > 0.6 };
  }
  return null;
}

/*
 opts: {
   teams: [{ form, players }, { form, players }], left: { name, abbr, c1, c2, crest }, right: {...},
   human: 0 | null, diff, mins, autoSwitch, sound, stick: "fixed" | "float", needWinner, aggDiff, kickoff, title, sub, speed
 }
 Resolve com { score: [esq, dir], pens: [esq, dir] | null, et, goals: [{ team, name, i, own, min }] }
*/
export function runMatch(root, opts) {
  return new Promise(resolve => {
    const m = new Game(opts);
    const [colL, colR] = kitColors(opts.left, opts.right);
    const cols = [colL, colR], gkCols = ["#f5c518", "#ff7043"];
    const hasHuman = opts.human === 0 || opts.human === 1, tv = document.documentElement.classList.contains("tv");
    const el = document.createElement("div");
    el.className = "mv";
    el.innerHTML = `
      <canvas class="mv-canvas"></canvas>
      <div class="mv-hud">
        <button class="mv-pause" aria-label="Pausar">❚❚</button>
        <div class="mv-score">
          <span class="mv-team">${opts.left.crest || ""}<b>${opts.left.abbr}</b></span>
          <span class="mv-num"><i id="mvs0">0</i><em>×</em><i id="mvs1">0</i></span>
          <span class="mv-team"><b>${opts.right.abbr}</b>${opts.right.crest || ""}</span>
        </div>
        <div class="mv-clock" id="mvclock">00'</div>
      </div>
      <div class="mv-msg" id="mvmsg"></div>
      <div class="mv-note" id="mvnote"></div>
      <div class="mv-controls ${hasHuman ? "" : "hidden"}">
        <div class="mv-joy" id="mvjoy"><div class="mv-ring" id="mvring"><div class="mv-stick" id="mvstick"></div></div></div>
        <button class="mv-btn mv-sprint" id="mvsprint">CORRER</button>
        <button class="mv-btn mv-pass" id="mvpass">PASSE</button>
        <button class="mv-btn mv-kick" id="mvkick">CHUTE</button>
      </div>
      <div class="mv-menu hidden" id="mvmenu">
        <div class="mv-menu-box">
          <h3>Jogo pausado</h3>
          <button class="btn primary" data-act="resume">Continuar</button>
          <button class="btn" data-act="skip">Simular o resto</button>
          <p class="hint"><b>Toque:</b> analógico à esquerda; PASSE (segure para passe alto), CHUTE (segure para dar força), CORRER. Sem a bola: PASSE troca de jogador e CHUTE dá o bote.</p>
          <p class="hint"><b>Controle:</b> A passe/trocar · X ou B chute/bote · RT correr · LB trocar · Start pausa (no menu: A continua, Y simula o resto).</p>
          <p class="hint"><b>Teclado:</b> setas/WASD · J ou Z passe · K ou X chute · Shift ou L correr · C trocar · P pausa.</p>
        </div>
      </div>`;
    root.appendChild(el);
    const cv = el.querySelector("canvas"), ctx = cv.getContext("2d");
    const $ = id => el.querySelector("#" + id);
    const msg = $("mvmsg"), note = $("mvnote");
    let portrait = false, S = 10, cx = 0, cy = 0, dpr = 1, W = 0, H = 0, hvx = 30, hvy = 18;
    let camx = 0, camy = 0;

    function layout() {
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      W = el.clientWidth; H = el.clientHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      portrait = H > W * 1.05;
      el.classList.toggle("portrait", portrait);
      const band = portrait && hasHuman ? Math.min(190, H * 0.2) : 0, hud = 44;
      if (portrait) { S = Math.min(W / 40, (H - band - hud) / 54, 24); cx = W / 2; cy = hud + (H - band - hud) / 2; hvx = (H - band - hud) / 2 / S; hvy = W / 2 / S; }
      else { const big = W >= 1000; S = Math.min(W / (big ? 88 : 70), (H - hud) / (big ? 48 : 38), 24); cx = W / 2; cy = hud + (H - hud) / 2; hvx = W / 2 / S; hvy = (H - hud) / 2 / S; }
      placeStick();
    }
    const sp = (x, y) => (portrait ? [cx + (y - camy) * S, cy - (x - camx) * S] : [cx + (x - camx) * S, cy + (y - camy) * S]);
    function setT() {
      if (portrait) ctx.setTransform(0, -S * dpr, S * dpr, 0, (cx - camy * S) * dpr, (cy + camx * S) * dpr);
      else ctx.setTransform(S * dpr, 0, 0, S * dpr, (cx - camx * S) * dpr, (cy - camy * S) * dpr);
    }

    /* ---------- controles ---------- */
    const input = { x: 0, y: 0, pass: false, shoot: false, sprint: false };
    const keys = new Set();
    const float = opts.stick === "float";
    let joyId = null, jox = 0, joy = 0, jx = 0, jy = 0;
    const joyEl = $("mvjoy"), stick = $("mvstick"), ring = $("mvring");
    const JR = 54;
    function placeStick() {
      // base fixa no canto inferior esquerdo: não acompanha o dedo
      const r = joyEl.getBoundingClientRect();
      jox = r.left + 92; joy = r.bottom - 100;
      ring.style.left = (jox - r.left) + "px"; ring.style.top = (joy - r.top) + "px";
    }
    function joySet(e) {
      let dx = e.clientX - jox, dy = e.clientY - joy; const d = Math.hypot(dx, dy);
      if (d > JR) { dx *= JR / d; dy *= JR / d; }
      jx = dx / JR; jy = dy / JR;
      stick.style.transform = `translate(${dx}px, ${dy}px)`;
    }
    function joyStart(e) {
      if (joyId !== null) return;
      joyId = e.pointerId;
      if (float) { const r = joyEl.getBoundingClientRect(); jox = e.clientX; joy = e.clientY; ring.style.left = (jox - r.left) + "px"; ring.style.top = (joy - r.top) + "px"; }
      ring.classList.add("on"); joyEl.setPointerCapture?.(e.pointerId); joySet(e); e.preventDefault();
    }
    function joyMove(e) { if (e.pointerId === joyId) { joySet(e); e.preventDefault(); } }
    function joyEnd(e) { if (e.pointerId !== joyId) return; joyId = null; jx = jy = 0; stick.style.transform = ""; ring.classList.remove("on"); if (float) placeStick(); }
    joyEl.addEventListener("pointerdown", joyStart); joyEl.addEventListener("pointermove", joyMove);
    joyEl.addEventListener("pointerup", joyEnd); joyEl.addEventListener("pointercancel", joyEnd);
    const touch = { pass: false, shoot: false, sprint: false };
    for (const [id, key] of [["mvpass", "pass"], ["mvkick", "shoot"], ["mvsprint", "sprint"]]) {
      const b = $(id);
      const down = e => { touch[key] = true; b.classList.add("on"); b.setPointerCapture?.(e.pointerId); e.preventDefault(); };
      const up = () => { touch[key] = false; b.classList.remove("on"); };
      b.addEventListener("pointerdown", down); b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("lostpointercapture", up);
    }
    el.addEventListener("contextmenu", e => e.preventDefault());
    const onKey = e => {
      const k = e.key.toLowerCase();
      if (e.type === "keydown") {
        if (!e.repeat && k === "c") m.switchCtrl();
        if (!e.repeat && (k === "escape" || k === "p")) togglePause();
        keys.add(k);
      } else keys.delete(k);
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKey);
    let padPrev = {}, padSeen = false;
    function readInput() {
      let sx = jx, sy = jy;   // vetor na tela (y para baixo)
      const dead = 0.14, l = Math.hypot(sx, sy);
      if (l < dead) sx = sy = 0; else { const k = Math.min(1, (l - dead) / (0.8 - dead)) / l; sx *= k; sy *= k; }
      if (keys.has("arrowleft") || keys.has("a")) sx -= 1;
      if (keys.has("arrowright") || keys.has("d")) sx += 1;
      if (keys.has("arrowup") || keys.has("w")) sy -= 1;
      if (keys.has("arrowdown") || keys.has("s")) sy += 1;
      let pass = touch.pass || keys.has("j") || keys.has("z"), shoot = touch.shoot || keys.has("k") || keys.has("x"), sprint = touch.sprint || keys.has("shift") || keys.has("l");
      const g = readPad();
      if (g) {
        if (!padSeen) { padSeen = true; el.classList.add("pad"); }
        if (g.x || g.y) { sx = g.x; sy = g.y; }
        pass = pass || g.a; shoot = shoot || g.xb || g.b; sprint = sprint || g.rt || g.rb;
        if (!paused && ((g.lb && !padPrev.lb) || (g.yb && !padPrev.yb))) m.switchCtrl();
        if (paused) { if (g.a && !padPrev.a) togglePause(false); else if (g.yb && !padPrev.yb) { fastForward(); togglePause(false); } }
        if (g.start && !padPrev.start) togglePause();
        padPrev = g;
      }
      const ml = Math.hypot(sx, sy); if (ml > 1) { sx /= ml; sy /= ml; }
      if (portrait) { input.x = -sy; input.y = sx; } else { input.x = sx; input.y = sy; }
      input.pass = pass; input.shoot = shoot; input.sprint = sprint;
    }

    /* ---------- pausa ---------- */
    let paused = false, done = false;
    const menu = $("mvmenu");
    function togglePause(force) { if (done) return; paused = force ?? !paused; menu.classList.toggle("hidden", !paused); last = performance.now(); }
    el.querySelector(".mv-pause").addEventListener("click", () => togglePause());
    menu.addEventListener("click", e => {
      const act = e.target.dataset?.act;
      if (act === "resume") togglePause(false);
      if (act === "skip") { fastForward(); togglePause(false); }
    });
    const onVis = () => { if (document.hidden) togglePause(true); };
    document.addEventListener("visibilitychange", onVis);
    function fastForward() {
      if (m.ctrl) m.ctrl.human = false;
      m.ctrl = null; m.human = null;
      let guard = 0;
      while (m.state !== "end" && guard++ < 3600 * 40) m.tick(null);
    }

    /* ---------- desenho ---------- */
    function line(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
    function drawPitch() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#14301e"; ctx.fillRect(0, 0, cv.width, cv.height);
      setT();
      const { HL, HW, GW, BOXL, BOXW, SIXL, SIXW, CC, SPOT } = F;
      ctx.fillStyle = "#256a3a"; ctx.fillRect(-HL - 4, -HW - 4, HL * 2 + 8, HW * 2 + 8);
      const n = 14, sw = (HL * 2) / n;
      for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? "#2e7d46" : "#2a743f"; ctx.fillRect(-HL + i * sw, -HW, sw + 0.05, HW * 2); }
      ctx.strokeStyle = "rgba(255,255,255,.82)"; ctx.lineWidth = 0.18; ctx.lineJoin = "round";
      ctx.strokeRect(-HL, -HW, HL * 2, HW * 2);
      line(0, -HW, 0, HW);
      ctx.beginPath(); ctx.arc(0, 0, CC, 0, TAU); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.82)"; ctx.beginPath(); ctx.arc(0, 0, 0.3, 0, TAU); ctx.fill();
      for (const s of [-1, 1]) {
        ctx.strokeRect(s > 0 ? HL - BOXL : -HL, -BOXW, BOXL, BOXW * 2);
        ctx.strokeRect(s > 0 ? HL - SIXL : -HL, -SIXW, SIXL, SIXW * 2);
        ctx.beginPath(); ctx.arc(s * (HL - SPOT), 0, 0.28, 0, TAU); ctx.fill();
        const a = Math.acos((BOXL - SPOT) / CC);
        ctx.beginPath(); if (s > 0) ctx.arc(HL - SPOT, 0, CC, Math.PI - a, Math.PI + a); else ctx.arc(-HL + SPOT, 0, CC, -a, a); ctx.stroke();
        // gol
        ctx.fillStyle = "rgba(255,255,255,.16)"; ctx.fillRect(s > 0 ? HL : -HL - 2.2, -GW, 2.2, GW * 2);
        ctx.save(); ctx.strokeStyle = "rgba(255,255,255,.4)"; ctx.lineWidth = 0.06;
        for (let k = 1; k < 4; k++) line(s * (HL + 0.55 * k), -GW, s * (HL + 0.55 * k), GW);
        for (let k = -4; k <= 4; k++) line(s * HL, (GW * k) / 5, s * (HL + 2.2), (GW * k) / 5);
        ctx.restore();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 0.28;
        ctx.beginPath(); ctx.moveTo(s * HL, -GW); ctx.lineTo(s * (HL + 2.2), -GW); ctx.lineTo(s * (HL + 2.2), GW); ctx.lineTo(s * HL, GW); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,.82)"; ctx.strokeStyle = "rgba(255,255,255,.82)"; ctx.lineWidth = 0.18;
      }
    }
    const PR = 1.05;
    function draw() {
      // câmera segue a bola com antecipação
      const b = m.ball;
      let tx = b.x + b.vx * 0.3, ty = b.y + b.vy * 0.25;
      if (m.ctrl && b.owner !== m.ctrl) { tx = tx * 0.8 + m.ctrl.x * 0.2; ty = ty * 0.8 + m.ctrl.y * 0.2; }
      const lx = Math.max(0, F.HL + 5 - hvx), ly = Math.max(0, F.HW + 4 - hvy);
      tx = clamp(tx, -lx, lx); ty = clamp(ty, -ly, ly);
      const k = m.state === "dead" ? 0.12 : 0.085;
      camx += (tx - camx) * k; camy += (ty - camy) * k;
      drawPitch();
      // sombras
      ctx.fillStyle = "rgba(0,0,0,.22)";
      for (const p of m.players) { ctx.beginPath(); ctx.arc(p.x + 0.12, p.y + 0.2, PR, 0, TAU); ctx.fill(); }
      ctx.beginPath(); ctx.arc(b.x + 0.1 + b.z * 0.35, b.y + 0.15 + b.z * 0.35, 0.42, 0, TAU); ctx.fill();
      // alvo do passe
      if (b.target && hasHuman && b.target.team === m.human) { ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 0.14; ctx.beginPath(); ctx.arc(b.target.x, b.target.y, PR + 0.55, 0, TAU); ctx.stroke(); }
      for (const p of m.players) {
        const col = cols[p.team], fill = p.isGK ? gkCols[p.team] : col[0];
        if (p === m.ctrl) {
          ctx.strokeStyle = "rgba(255,235,59,.95)"; ctx.lineWidth = 0.2;
          ctx.beginPath(); ctx.arc(p.x, p.y, PR + 0.45 + Math.sin(frame / 8) * 0.08, 0, TAU); ctx.stroke();
        }
        // direção para onde o jogador está virado
        ctx.fillStyle = p.isGK ? "#111" : col[1];
        ctx.beginPath(); ctx.arc(p.x + p.fx * PR * 0.82, p.y + p.fy * PR * 0.82, 0.34, 0, TAU); ctx.fill();
        ctx.fillStyle = fill; ctx.strokeStyle = p.isGK ? "#111" : col[1]; ctx.lineWidth = 0.2;
        ctx.globalAlpha = p.stun > 0 ? 0.65 : 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, PR - 0.1, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // bola
      const br = 0.42 * (1 + Math.min(b.z, 8) * 0.09);
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#111"; ctx.lineWidth = 0.1;
      ctx.beginPath(); ctx.arc(b.x, b.y, br, 0, TAU); ctx.fill(); ctx.stroke();
      // textos (sem rotação)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      if (S >= 8) {
        ctx.font = `700 ${Math.max(8, S * 1.05)}px system-ui, sans-serif`;
        for (const p of m.players) {
          const [x, y] = sp(p.x, p.y);
          if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
          ctx.fillStyle = lum(p.isGK ? gkCols[p.team] : cols[p.team][0]) > 140 ? "#111" : "#fff";
          ctx.fillText(p.num, x, y + 0.5);
        }
      }
      const c = m.ctrl || (!hasHuman ? b.owner : null);
      if (c) {
        const [x, y] = sp(c.x, c.y);
        ctx.font = "600 11px system-ui, sans-serif"; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.fillStyle = "#fff";
        const short = c.name.length > 14 ? c.name.split(" ").slice(-1)[0] : c.name;
        ctx.strokeText(short, x, y + S * 1.5 + 9); ctx.fillText(short, x, y + S * 1.5 + 9);
        if (hasHuman) {
          const bw = 30, bx = x - bw / 2, by = y - S * 1.5 - 9;
          ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(bx, by, bw, 4);
          ctx.fillStyle = c.tired ? "#ff6b5e" : "#3ddc84"; ctx.fillRect(bx, by, bw * clamp(c.stamina, 0, 1), 4);
          if (m.charge > 0) { ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(bx - 5, by - 9, bw + 10, 6); ctx.fillStyle = m.chargeKind === "shot" ? (m.charge > 0.8 ? "#ff6b5e" : "#ffb300") : "#29b6f6"; ctx.fillRect(bx - 5, by - 9, (bw + 10) * m.charge, 6); }
        }
      }
      drawRadar();
    }
    function drawRadar() {
      const k = Math.max(1, Math.min(2.2, W / 620)), rw = (portrait ? 54 : 96) * (portrait ? 1 : k), rh = (portrait ? 84 : 62) * (portrait ? 1 : k), rx = W - rw - (tv ? 48 : 8), ry = tv ? 70 : 52;
      ctx.fillStyle = "rgba(10,40,22,.72)"; ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 1; ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
      const map = (x, y) => (portrait ? [rx + rw / 2 + (y / F.HW) * (rw / 2 - 3), ry + rh / 2 - (x / F.HL) * (rh / 2 - 3)] : [rx + rw / 2 + (x / F.HL) * (rw / 2 - 3), ry + rh / 2 + (y / F.HW) * (rh / 2 - 3)]);
      ctx.beginPath(); const a = map(0, -F.HW), c = map(0, F.HW); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
      for (const p of m.players) { const [x, y] = map(p.x, p.y); ctx.fillStyle = p === m.ctrl ? "#ffeb3b" : cols[p.team][0]; ctx.fillRect(x - 1.5, y - 1.5, 3.5, 3.5); }
      const [bx, by] = map(m.ball.x, m.ball.y); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(bx, by, 2.2, 0, TAU); ctx.fill();
    }

    /* ---------- laço principal ---------- */
    let last = performance.now(), acc = 0, frame = 0, raf = 0, lastClock = "", shown = [-1, -1], lastMode = "";
    const speed = opts.speed || 1;
    function showMsg(t, cls = "", ms = 1600) { msg.textContent = t; msg.className = "mv-msg show " + cls; clearTimeout(showMsg.t); if (ms) showMsg.t = setTimeout(() => (msg.className = "mv-msg"), ms); }
    function showNote(t) { note.textContent = t; note.className = "mv-note show"; clearTimeout(showNote.t); showNote.t = setTimeout(() => (note.className = "mv-note"), 1500); }
    const DEAD = { throwin: "Lateral", corner: "Escanteio", goalkick: "Tiro de meta" };
    function handleEvents() {
      for (const e of m.events) {
        const snd = e.t === "whistle2" ? "whistle" : e.t === "lunge" ? "tackle" : e.t;
        if (opts.sound !== false && SFX[snd] && !(e.t === "dead" && e.type === "kickoff")) SFX[snd]();
        if (e.t === "goal") { showMsg("GOL" + (e.own ? " CONTRA" : "") + "!" + (e.name && !e.own ? " " + e.name : ""), e.team === m.human ? "good" : hasHuman ? "bad" : "", 2300); if (e.team === m.human) navigator.vibrate?.(60); }
        else if (e.t === "whistle2") showMsg(e.half === 1 ? "Intervalo" : "Fim do tempo normal", "", 1800);
        else if (e.t === "extra") showMsg("Prorrogação: gol de ouro!", "good", 2400);
        else if (e.t === "dead" && DEAD[e.type]) showNote(DEAD[e.type] + " · " + (e.team === 0 ? opts.left.abbr : opts.right.abbr));
        else if (e.t === "save") showNote("Defesa!");
        else if (e.t === "post") showNote("Na trave!");
      }
    }
    function loop(now) {
      raf = requestAnimationFrame(loop);
      frame++;
      readInput();
      if (paused) { draw(); return; }
      acc += Math.min(100, now - last) * speed; last = now;
      let steps = 0;
      while (acc >= 1000 / 60 && steps++ < 8) {
        m.tick(hasHuman && m.human !== null ? input : null);
        handleEvents();
        acc -= 1000 / 60;
        if (m.state === "end") break;
      }
      if (shown[0] !== m.score[0] || shown[1] !== m.score[1]) { shown = m.score.slice(); $("mvs0").textContent = shown[0]; $("mvs1").textContent = shown[1]; }
      const ct = m.clockText(); if (ct !== lastClock) { lastClock = ct; $("mvclock").textContent = ct; }
      if (hasHuman && m.human !== null) {
        const mine = (m.ball.owner && m.ball.owner.team === m.human) || (m.ball.target && m.ball.target.team === m.human);
        const mode = mine ? "a" : "d";
        if (mode !== lastMode) { lastMode = mode; $("mvpass").textContent = mine ? "PASSE" : "TROCAR"; $("mvkick").textContent = mine ? "CHUTE" : "BOTE"; }
      }
      draw();
      if (m.state === "end" && !done) { done = true; setTimeout(finishUp, 900); }
    }
    function cleanup() {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKey);
      window.removeEventListener("resize", layout); document.removeEventListener("visibilitychange", onVis);
      el.remove();
    }
    async function finishUp() {
      let pens = null;
      if (m.result.needPens) {
        showMsg("Decisão por pênaltis", "", 1400);
        await new Promise(r => setTimeout(r, 1400));
        pens = await shootout(el, opts, [colL, colR]);
      }
      cleanup();
      resolve({ score: m.score.slice(), pens, et: m.et, goals: m.goals.slice() });
    }
    window.addEventListener("resize", layout);
    layout();
    showMsg(opts.title || "", "", 1500);
    raf = requestAnimationFrame(loop);
    // ganchos para testes automatizados
    el._match = m; el._ff = fastForward;
  });
}

/* ------------------------------ pênaltis ------------------------------ */
// Zonas: 3 colunas x 2 linhas. O usuário escolhe onde bater e para onde pular (toque, setas + Enter ou controle).
export function shootout(root, opts, cols) {
  return new Promise(resolve => {
    const human = opts.human === 0 || opts.human === 1 ? opts.human : null;
    const el = document.createElement("div");
    el.className = "pk";
    el.innerHTML = `
      <div class="pk-box">
        <div class="pk-head"><span>${opts.left.abbr}</span><b id="pks">0 × 0</b><span>${opts.right.abbr}</span></div>
        <div class="pk-marks"><div id="pkm0"></div><div id="pkm1"></div></div>
        <div class="pk-goal" id="pkgoal">
          ${[0, 1, 2, 3, 4, 5].map(i => `<button class="pk-zone" data-z="${i}"></button>`).join("")}
          <div class="pk-keeper" id="pkkeeper"></div><div class="pk-ball" id="pkball"></div>
        </div>
        <div class="pk-info" id="pkinfo"></div>
      </div>`;
    root.appendChild(el);
    const $ = id => el.querySelector("#" + id);
    const score = [0, 0], taken = [0, 0];
    let turn = 0, sel = 4, over = false, raf = 0;
    const zonePos = z => [16.6 + (z % 3) * 33.3, z < 3 ? 28 : 72];
    const info = $("pkinfo"), keeper = $("pkkeeper"), ball = $("pkball"), goal = $("pkgoal");
    const zones = [...el.querySelectorAll(".pk-zone")];
    const mark = (t, ok) => { const s = document.createElement("i"); s.className = ok ? "ok" : "no"; $("pkm" + t).appendChild(s); };
    const hilite = () => zones.forEach((z, i) => z.classList.toggle("sel", i === sel && human !== null));
    function decided() {
      const rem = [Math.max(0, 5 - taken[0]), Math.max(0, 5 - taken[1])];
      if (taken[0] <= 5 && taken[1] <= 5 && (taken[0] < 5 || taken[1] < 5)) return score[0] > score[1] + rem[1] || score[1] > score[0] + rem[0];
      return taken[0] === taken[1] && score[0] !== score[1];
    }
    function resolveKick(shot, dive) {
      const sameCol = shot % 3 === dive % 3, same = shot === dive;
      let pGoal = same ? 0.1 : sameCol ? 0.6 : 0.93;
      if (shot < 3 && !same) pGoal -= 0.06;   // bola alta: risco de isolar
      return rnd() < pGoal;
    }
    function finish() { over = true; window.removeEventListener("keydown", onKey); cancelAnimationFrame(raf); el.remove(); resolve(score.slice()); }
    function play(shot, dive) {
      goal.classList.add("busy");
      info.textContent = ""; info.className = "pk-info";
      const ok = resolveKick(shot, dive);
      const [bx, by] = zonePos(shot), [kx, ky] = zonePos(dive);
      keeper.style.left = kx + "%"; keeper.style.top = ky + "%";
      const miss = !ok && shot !== dive && shot % 3 !== dive % 3;
      ball.style.left = (miss ? (shot % 3 === 0 ? -6 : shot % 3 === 2 ? 106 : bx) : bx) + "%"; ball.style.top = (miss ? -14 : by) + "%";
      ball.classList.add("fly");
      setTimeout(() => {
        taken[turn]++; if (ok) score[turn]++;
        mark(turn, ok);
        $("pks").textContent = score[0] + " × " + score[1];
        info.textContent = ok ? "Gol!" : (shot === dive || shot % 3 === dive % 3) ? "Defendeu!" : "Pra fora!";
        info.className = "pk-info " + (ok === (turn === human) ? "good" : human === null ? "" : "bad");
        setTimeout(() => {
          if (decided()) { finish(); return; }
          turn = 1 - turn; next();
        }, 900);
      }, 520);
    }
    function next() {
      goal.classList.remove("busy");
      keeper.style.left = "50%"; keeper.style.top = "62%";
      ball.classList.remove("fly"); ball.style.left = "50%"; ball.style.top = "128%";
      keeper.style.background = cols[1 - turn][0];
      if (human === null) { info.textContent = ""; setTimeout(() => play((rnd() * 6) | 0, (rnd() * 6) | 0), 500); return; }
      info.className = "pk-info";
      info.textContent = turn === human ? "Sua cobrança: escolha onde chutar" : "Defenda: escolha para onde o goleiro pula";
      hilite();
    }
    function choose(z) {
      if (goal.classList.contains("busy") || human === null || over) return;
      const ai = (rnd() * 6) | 0;
      if (turn === human) play(z, ai); else play(ai, z);
    }
    goal.addEventListener("click", e => { const z = e.target.dataset?.z; if (z !== undefined) choose(+z); });
    const move = (dx, dy) => { const c = clamp((sel % 3) + dx, 0, 2), r = clamp(Math.floor(sel / 3) + dy, 0, 1); sel = r * 3 + c; hilite(); };
    const onKey = e => {
      const k = e.key;
      if (k === "ArrowLeft") move(-1, 0); else if (k === "ArrowRight") move(1, 0); else if (k === "ArrowUp") move(0, -1); else if (k === "ArrowDown") move(0, 1);
      else if (k === "Enter" || k === " ") choose(sel); else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    let prev = {};
    const poll = () => {
      raf = requestAnimationFrame(poll);
      const g = readPad(); if (!g) return;
      if (g.left && !prev.left) move(-1, 0); if (g.right && !prev.right) move(1, 0); if (g.up && !prev.up) move(0, -1); if (g.down && !prev.down) move(0, 1);
      if (g.a && !prev.a) choose(sel);
      prev = g;
    };
    raf = requestAnimationFrame(poll);
    el._auto = () => choose((rnd() * 6) | 0);
    next();
  });
}
