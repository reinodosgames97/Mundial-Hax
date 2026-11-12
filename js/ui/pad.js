// Navegação dos menus por controle (gamepad): direcional/analógico move o foco, A confirma, B volta, LB/RB trocam de aba.
import { readPad } from "../game/view.js";

let cb = {}, active = false, cur = null, key = null, prev = {}, rep = { dir: "", t: 0 };
const SEL = 'button:not([disabled]), select, input[type="text"]';
const layer = () => document.querySelector(".modal") || document.getElementById("app");
const items = () => [...layer().querySelectorAll(SEL)].filter(e => e.offsetParent !== null);
const keyOf = e => (e.dataset.act || e.dataset.ch || e.dataset.r || e.dataset.o || e.id || e.tagName) + "|" + (e.dataset.v ?? "");

function focus(e) {
  if (cur) cur.classList.remove("padfocus");
  cur = e || null;
  if (!cur) return;
  cur.classList.add("padfocus"); key = keyOf(cur);
  cur.scrollIntoView({ block: "nearest", inline: "nearest" });
}
function fallback(list) { return list.find(e => e.classList.contains("primary")) || list.find(e => e.classList.contains("on")) || list[0]; }
function move(dx, dy) {
  const list = items();
  if (!list.length) return;
  if (!cur || !cur.isConnected || !list.includes(cur)) { focus(fallback(list)); return; }
  const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let best = null, bs = 1e9;
  for (const e of list) {
    if (e === cur) continue;
    const q = e.getBoundingClientRect(), ex = q.left + q.width / 2, ey = q.top + q.height / 2;
    const along = (ex - cx) * dx + (ey - cy) * dy, across = Math.abs((ex - cx) * dy) + Math.abs((ey - cy) * dx);
    if (along < 6) continue;
    const s = along + across * 2.2;
    if (s < bs) { bs = s; best = e; }
  }
  if (best) focus(best);
  else { const b = layer().querySelector(".body"); if (b && dy) b.scrollBy(0, dy * 160); }
}
// lista própria para <select> (o seletor nativo não responde ao controle)
function openPicker(sel) {
  const el = document.createElement("div");
  el.className = "modal";
  el.innerHTML = `<div class="modal-box picker">${[...sel.options].filter(o => o.value !== "").map(o => `<button class="btn ${o.value === sel.value ? "primary" : ""}" data-o="${o.value}">${o.textContent}</button>`).join("")}<button class="btn" data-r="0">Cancelar</button></div>`;
  el.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b && e.target !== el) return;
    el.remove();
    if (b && b.dataset.o !== undefined) { sel.value = b.dataset.o; sel.dispatchEvent(new Event("change", { bubbles: true })); }
    else padAfterRender();
  });
  document.body.appendChild(el);
  focus(fallback(items()));
}
function press() {
  if (!cur || !cur.isConnected) { move(0, 1); return; }
  if (cur.tagName === "SELECT") openPicker(cur);
  else if (cur.tagName === "INPUT") cur.focus();
  else cur.click();
}
export function padAfterRender() {
  if (!active) return;
  const list = items();
  focus(list.find(e => keyOf(e) === key) || fallback(list));
}
function poll(now) {
  requestAnimationFrame(poll);
  if (document.querySelector(".mv")) { prev = {}; return; }   // durante a partida quem lê o controle é a tela do jogo
  const g = readPad();
  if (!g) return;
  const dir = g.up ? "u" : g.down ? "d" : g.left ? "l" : g.right ? "r" : "";
  const any = dir || g.a || g.b || g.lb || g.rb || g.start;
  if (any && !active) { active = true; document.body.classList.add("padmode"); padAfterRender(); prev = g; rep = { dir, t: now + 400 }; return; }
  if (dir && (dir !== rep.dir || now > rep.t)) {
    rep = { dir, t: now + (dir !== rep.dir ? 380 : 130) };
    move(dir === "l" ? -1 : dir === "r" ? 1 : 0, dir === "u" ? -1 : dir === "d" ? 1 : 0);
  } else if (!dir) rep.dir = "";
  if (g.a && !prev.a) press();
  if (g.b && !prev.b) cb.back?.();
  if (g.lb && !prev.lb) cb.tab?.(-1);
  if (g.rb && !prev.rb) cb.tab?.(1);
  prev = g;
}
export function initPad(callbacks) { cb = callbacks || {}; requestAnimationFrame(poll); }
