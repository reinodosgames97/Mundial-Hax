// Tela da partida: desenho no canvas, controles de toque/teclado, placar, som e disputa de pênaltis.
import { Match } from "./match.js";
import { rnd } from "../core/rng.js";

const TAU = Math.PI * 2;
const hex = h => { h = h.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
const cdist = (a, b) => { const x = hex(a), y = hex(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
const lum = c => { const [r, g, b] = hex(c); return r * 0.299 + g * 0.587 + b * 0.114; };
const GRASS = "#2e7d46";

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
  wall: () => beep(120, 0.04, "sine", 0.05),
  post: () => beep(880, 0.12, "square", 0.05),
  whistle: () => { beep(2100, 0.25, "square", 0.04); setTimeout(() => beep(2300, 0.2, "square", 0.04), 60); },
  goal: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.22, "triangle", 0.1), i * 110)); },
  end: () => { beep(2100, 0.2, "square", 0.04); setTimeout(() => beep(2100, 0.2, "square", 0.04), 280); setTimeout(() => beep(2100, 0.5, "square", 0.04), 560); },
};

/*
 opts: {
   size, mins, diff, autoSwitch, sound, ratings:[esq, dir], human: 0|null, needWinner, aggDiff,
   left:{name, abbr, c1, c2, crest}, right:{...}, title, sub, speed (para modo espectador)
 }
 Resolve com { score:[esq, dir], pens:[esq, dir]|null, et, abandoned }
*/
export function runMatch(root, opts) {
  return new Promise(resolve => {
    const m = new Match(opts);
    const [colL, colR] = kitColors(opts.left, opts.right);
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
      <div class="mv-title">${opts.title || ""}${opts.sub ? " · " + opts.sub : ""}</div>
      <div class="mv-msg" id="mvmsg"></div>
      <div class="mv-controls ${opts.human === null || opts.human === undefined ? "hidden" : ""}">
        <div class="mv-joy" id="mvjoy"><div class="mv-ring"><div class="mv-stick" id="mvstick"></div></div></div>
        <button class="mv-btn mv-switch" id="mvswitch">TROCAR</button>
        <button class="mv-btn mv-kick" id="mvkick">CHUTE</button>
      </div>
      <div class="mv-menu hidden" id="mvmenu">
        <div class="mv-menu-box">
          <h3>Jogo pausado</h3>
          <button class="btn primary" data-act="resume">Continuar</button>
          <button class="btn" data-act="skip">Simular o resto</button>
          <p class="hint">No computador: setas ou WASD para mover, espaço ou X para chutar, C para trocar de jogador.</p>
        </div>
      </div>`;
    root.appendChild(el);
    const cv = el.querySelector("canvas"), ctx = cv.getContext("2d");
    const $ = id => el.querySelector("#" + id);
    const msg = $("mvmsg");
    let portrait = false, S = 1, cx = 0, cy = 0, dpr = 1, band = 0;
    const P = m.pitch;

    function layout() {
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const w = el.clientWidth, h = el.clientHeight;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      portrait = h > w;
      el.classList.toggle("portrait", portrait);
      const hud = portrait ? 62 : 46;
      const L = (P.HW + P.GD + 12) * 2, Wd = (P.HH + 14) * 2;
      if (portrait) {
        band = opts.human === null || opts.human === undefined ? 0 : Math.max(130, Math.min(190, h * 0.2));
        S = Math.min(w / Wd, (h - hud - band) / L);
        cx = w / 2; cy = hud + (h - hud - band) / 2;
      } else {
        band = 0;
        S = Math.min(w / L, (h - hud) / Wd);
        cx = w / 2; cy = hud + (h - hud) / 2;
      }
      el.style.setProperty("--band", band + "px");
    }
    const sp = (x, y) => (portrait ? [cx + y * S, cy - x * S] : [cx + x * S, cy + y * S]);
    function setT() { if (portrait) ctx.setTransform(0, -S * dpr, S * dpr, 0, cx * dpr, cy * dpr); else ctx.setTransform(S * dpr, 0, 0, S * dpr, cx * dpr, cy * dpr); }

    /* ---------- controles ---------- */
    const input = { x: 0, y: 0, kick: false };
    const keys = new Set();
    let joyId = null, jox = 0, joy = 0, jx = 0, jy = 0;
    const joyEl = $("mvjoy"), stick = $("mvstick"), ring = el.querySelector(".mv-ring");
    const JR = 46;
    function joyStart(e) {
      if (joyId !== null) return;
      joyId = e.pointerId; jox = e.clientX; joy = e.clientY; jx = jy = 0;
      const r = joyEl.getBoundingClientRect();
      ring.style.left = (jox - r.left) + "px"; ring.style.top = (joy - r.top) + "px"; ring.classList.add("on");
      joyEl.setPointerCapture?.(e.pointerId); e.preventDefault();
    }
    function joyMove(e) {
      if (e.pointerId !== joyId) return;
      let dx = e.clientX - jox, dy = e.clientY - joy; const d = Math.hypot(dx, dy);
      if (d > JR) { // a base acompanha o dedo
        jox += dx * (1 - JR / d); joy += dy * (1 - JR / d); dx *= JR / d; dy *= JR / d;
        const r = joyEl.getBoundingClientRect(); ring.style.left = (jox - r.left) + "px"; ring.style.top = (joy - r.top) + "px";
      }
      jx = dx / JR; jy = dy / JR;
      stick.style.transform = `translate(${dx}px, ${dy}px)`; e.preventDefault();
    }
    function joyEnd(e) { if (e.pointerId !== joyId) return; joyId = null; jx = jy = 0; stick.style.transform = ""; ring.classList.remove("on"); }
    joyEl.addEventListener("pointerdown", joyStart); joyEl.addEventListener("pointermove", joyMove);
    joyEl.addEventListener("pointerup", joyEnd); joyEl.addEventListener("pointercancel", joyEnd);
    const kickBtn = $("mvkick"), swBtn = $("mvswitch");
    let kickTouch = false;
    const kdown = e => { kickTouch = true; kickBtn.classList.add("on"); e.preventDefault(); };
    const kup = () => { kickTouch = false; kickBtn.classList.remove("on"); };
    kickBtn.addEventListener("pointerdown", kdown); kickBtn.addEventListener("pointerup", kup); kickBtn.addEventListener("pointercancel", kup); kickBtn.addEventListener("pointerleave", kup);
    swBtn.addEventListener("pointerdown", e => { m.switchPlayer(); e.preventDefault(); });
    el.addEventListener("contextmenu", e => e.preventDefault());
    const onKey = e => {
      const k = e.key.toLowerCase();
      if (e.type === "keydown") {
        if (k === "c" || k === "shift") m.switchPlayer();
        if (k === "escape" || k === "p") togglePause();
        keys.add(k);
      } else keys.delete(k);
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKey);
    function readInput() {
      let sx = jx, sy = jy;   // vetor na tela
      const dead = 0.16, l = Math.hypot(sx, sy);
      if (l < dead) sx = sy = 0; else { const k = Math.min(1, (l - dead) / (0.75 - dead)) / l; sx *= k; sy *= k; }
      if (keys.has("arrowleft") || keys.has("a")) sx -= 1;
      if (keys.has("arrowright") || keys.has("d")) sx += 1;
      if (keys.has("arrowup") || keys.has("w")) sy -= 1;
      if (keys.has("arrowdown") || keys.has("s")) sy += 1;
      if (portrait) { input.x = -sy; input.y = sx; } else { input.x = sx; input.y = sy; }
      input.kick = kickTouch || keys.has(" ") || keys.has("x");
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
      // deixa a IA assumir e roda o resto instantaneamente
      m.setCtrl(null); m.human = null; m.ctrl = null;
      let guard = 0;
      while (m.state !== "end" && guard++ < 60 * 60 * 8) m.tick(null);
    }

    /* ---------- desenho ---------- */
    function drawPitch() {
      const w = cv.width, h = cv.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#16321f"; ctx.fillRect(0, 0, w, h);
      setT();
      const { HW, HH, GOAL, GD, CC } = P;
      // gramado em faixas
      const n = 10, sw = (HW * 2) / n;
      for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? "#2e7d46" : "#2a743f"; ctx.fillRect(-HW + i * sw, -HH, sw + 0.5, HH * 2); }
      ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 3; ctx.lineJoin = "round";
      ctx.strokeRect(-HW, -HH, HW * 2, HH * 2);
      ctx.beginPath(); ctx.moveTo(0, -HH); ctx.lineTo(0, HH); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, CC, 0, TAU); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
      for (const s of [-1, 1]) {
        const aw = HW * 0.3, ah = Math.min(HH * 0.86, GOAL * 2.2);
        ctx.strokeRect(s > 0 ? HW - aw : -HW, -ah, aw, ah * 2);
        const gw = HW * 0.12, gh = GOAL * 1.25;
        ctx.strokeRect(s > 0 ? HW - gw : -HW, -gh, gw, gh * 2);
        // gol e rede
        ctx.fillStyle = "rgba(255,255,255,.14)";
        ctx.fillRect(s > 0 ? HW : -HW - GD, -GOAL, GD, GOAL * 2);
        ctx.save(); ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 1;
        for (let k = 1; k < 4; k++) { const x = s * (HW + (GD * k) / 4); ctx.beginPath(); ctx.moveTo(x, -GOAL); ctx.lineTo(x, GOAL); ctx.stroke(); }
        for (let k = -3; k <= 3; k++) { const y = (GOAL * k) / 4; ctx.beginPath(); ctx.moveTo(s * HW, y); ctx.lineTo(s * (HW + GD), y); ctx.stroke(); }
        ctx.restore();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(s * HW, -GOAL); ctx.lineTo(s * (HW + GD), -GOAL); ctx.lineTo(s * (HW + GD), GOAL); ctx.lineTo(s * HW, GOAL); ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 3;
      }
      for (const post of m.w.posts) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(post.x, post.y, post.r, 0, TAU); ctx.fill(); ctx.strokeStyle = "#222"; ctx.lineWidth = 1.5; ctx.stroke(); }
    }
    function draw() {
      drawPitch();
      const b = m.w.ball;
      // sombras
      ctx.fillStyle = "rgba(0,0,0,.22)";
      for (const p of m.w.players) { ctx.beginPath(); ctx.arc(p.x + 2, p.y + 3, p.r, 0, TAU); ctx.fill(); }
      ctx.beginPath(); ctx.arc(b.x + 2, b.y + 3, b.r, 0, TAU); ctx.fill();
      // jogadores
      for (const p of m.w.players) {
        const col = p.team === 0 ? colL : colR;
        if (p === m.ctrl) {
          ctx.strokeStyle = "rgba(255,235,59,.95)"; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 6 + Math.sin(frame / 8) * 1.2, 0, TAU); ctx.stroke();
        }
        ctx.fillStyle = p.role === "G" ? (p.team === 0 ? "#f5c518" : "#ff7043") : col[0];
        ctx.strokeStyle = p.kick || p.kickFx ? "#fff" : (p.role === "G" ? "#111" : col[1]);
        ctx.lineWidth = p.kick || p.kickFx ? 4 : 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r - 1.5, 0, TAU); ctx.fill(); ctx.stroke();
      }
      // bola
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#111"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill(); ctx.stroke();
      // números (sem rotação)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `700 ${Math.max(9, 13 * S)}px system-ui, sans-serif`;
      for (const p of m.w.players) {
        const col = p.team === 0 ? colL : colR, fill = p.role === "G" ? "#f5c518" : col[0];
        const [x, y] = sp(p.x, p.y);
        ctx.fillStyle = lum(fill) > 140 ? "#111" : "#fff";
        ctx.fillText(p.num, x, y + 0.5);
      }
    }

    /* ---------- laço principal ---------- */
    let last = performance.now(), acc = 0, frame = 0, raf = 0, lastClock = "", shown = [-1, -1];
    const speed = opts.speed || 1;
    function showMsg(t, cls = "", ms = 1600) { msg.textContent = t; msg.className = "mv-msg show " + cls; clearTimeout(showMsg.t); if (ms) showMsg.t = setTimeout(() => (msg.className = "mv-msg"), ms); }
    function handleEvents() {
      for (const e of m.events) {
        if (opts.sound !== false && SFX[e.t === "whistle2" ? "whistle" : e.t]) SFX[e.t === "whistle2" ? "whistle" : e.t]();
        if (e.t === "goal") { showMsg("GOOOL!", e.team === m.human ? "good" : (m.human === null ? "" : "bad"), 1800); if (e.team === m.human) navigator.vibrate?.(60); }
        else if (e.t === "whistle2") showMsg(m.half === 1 ? "Intervalo" : "Fim do tempo normal", "", 1800);
        else if (e.t === "extra") showMsg("Prorrogação: gol de ouro!", "good", 2400);
      }
    }
    function loop(now) {
      raf = requestAnimationFrame(loop);
      frame++;
      if (paused) { draw(); return; }
      acc += Math.min(100, now - last) * speed; last = now;
      let steps = 0;
      while (acc >= 1000 / 60 && steps++ < 8) {
        readInput();
        m.tick(m.human !== null ? input : null);
        handleEvents();
        acc -= 1000 / 60;
        if (m.state === "end") break;
      }
      if (shown[0] !== m.score[0] || shown[1] !== m.score[1]) { shown = m.score.slice(); $("mvs0").textContent = shown[0]; $("mvs1").textContent = shown[1]; }
      const ct = m.clockText(); if (ct !== lastClock) { lastClock = ct; $("mvclock").textContent = ct; }
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
      resolve({ score: m.score.slice(), pens, et: m.et });
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
// Zonas: 3 colunas x 2 linhas. O usuário escolhe onde bater e para onde pular.
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
    let turn = 0;   // time que bate
    const zonePos = z => [16.6 + (z % 3) * 33.3, z < 3 ? 28 : 72];
    const info = $("pkinfo"), keeper = $("pkkeeper"), ball = $("pkball"), goal = $("pkgoal");
    const mark = (t, ok) => { const s = document.createElement("i"); s.className = ok ? "ok" : "no"; $("pkm" + t).appendChild(s); };
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
          if (decided()) { el.remove(); resolve(score.slice()); return; }
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
      info.textContent = turn === human ? "Sua cobrança: toque onde quer chutar" : "Defenda: toque para onde o goleiro pula";
    }
    goal.addEventListener("click", e => {
      const z = e.target.dataset?.z;
      if (z === undefined || goal.classList.contains("busy") || human === null) return;
      const ai = (rnd() * 6) | 0;
      if (turn === human) play(+z, ai); else play(ai, +z);
    });
    el._auto = () => { if (!goal.classList.contains("busy")) { const z = (rnd() * 6) | 0, ai = (rnd() * 6) | 0; if (turn === human) play(z, ai); else play(ai, z); } };
    next();
  });
}
