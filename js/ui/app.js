// Interface do Mundial Hax (menus, carreira, tabelas e estatísticas).
import { clubs, club, cname, crestUrl, crestFallback, abbr, INIT, UF_NAMES, STATE_NAMES } from "../core/db.js";
import { newGame, step, playUser, simUser, endSeason, save, load, wipe, compsOf, fixtures, standing, titlesOf, titleRanking, divOf, DIFFS, stageHas, changeClub, lineupOf, setFormation, topScorers, playerGoals, brContinental } from "../core/season.js";
import { squadOf, ovrOf, matchTeam, defaultFormation, bestXI, FORMATIONS, FORM_NAMES } from "../core/squads.js";
import { initPad, padAfterRender } from "./pad.js";
import { ORDER, COMP_NAMES, R, slotLabel, EU_LEAGUES, UFS } from "../core/comps.js";
import { table, stageMatches, played, score, aggregate } from "../core/stages.js";
import { runMatch } from "../game/view.js";

const app = document.getElementById("app");
// modo TV (Xbox): margem de segurança e letras maiores. Ativado com ?tv=1 na URL.
if (/[?&]tv=1/.test(location.search)) document.documentElement.classList.add("tv");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
window.__crestErr = img => { const fb = img.dataset.fb; if (fb) { img.dataset.fb = ""; img.src = fb; } else img.remove(); };
window.__crestOk = img => img.parentNode.classList.add("ok");

export function crest(id, size) {
  const c = club(id);
  if (!c) return "";
  const url = window.__NO_CRESTS ? "" : crestUrl(id), fb = crestFallback(id);
  const img = url ? `<img alt="" loading="lazy" referrerpolicy="no-referrer" src="${esc(url)}" data-fb="${esc(fb)}" onload="__crestOk(this)" onerror="__crestErr(this)">` : "";
  const h = c.c1.replace("#", ""), lum = parseInt(h.slice(0, 2), 16) * 0.299 + parseInt(h.slice(2, 4), 16) * 0.587 + parseInt(h.slice(4, 6), 16) * 0.114;
  return `<span class="crest" style="${size ? `--s:${size}px;` : ""}--c1:${c.c1};--c2:${c.c2};--ct:${lum > 150 ? "#111" : "#fff"}"><span>${esc(abbr(id))}</span>${img}</span>`;
}

let G = null, ev = null;
const ui = { screen: "title", tab: "home", comp: null, stage: null, stat: "club", rankKey: "BRA", pickTab: "A", pickUF: "SP", pickLg: "ENG", pick: null, post: null, summary: null, changing: false, selP: null };
const DIV_LABEL = { A: "Série A", B: "Série B", C: "Série C", D: "Série D", "": "Sem divisão nacional" };
const rating = id => Math.round(G ? R(G, id) : club(id).r0);

function toast(t) { const el = document.createElement("div"); el.className = "toast"; el.textContent = t; document.body.appendChild(el); setTimeout(() => el.remove(), 2200); }
// confirmação dentro da página (confirm() nativo não funciona em todos os ambientes)
function ask(text, okLabel = "Confirmar") {
  return new Promise(resolve => {
    const el = document.createElement("div");
    el.className = "modal";
    el.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true"><p>${esc(text)}</p><div class="row"><button class="btn" data-r="0">Cancelar</button><button class="btn primary" data-r="1">${esc(okLabel)}</button></div></div>`;
    el.addEventListener("click", e => { const r = e.target.dataset?.r; if (r === undefined && e.target !== el) return; el.remove(); resolve(r === "1"); });
    document.body.appendChild(el);
  });
}
function persist() { if (G && !save(G)) toast("Não foi possível salvar (armazenamento cheio ou bloqueado)."); }
function refreshEvent() { ev = step(G); persist(); }

/* ------------------------------------------------------------------ */
function render() {
  const s = ui.screen;
  app.innerHTML = s === "title" ? vTitle() : s === "new" ? vPick() : s === "post" ? vPost() : s === "summary" ? vSummary() : s === "help" ? vHelp() : vHub();
  const body = app.querySelector(".body");
  if (body && ui.keepScroll) body.scrollTop = ui.keepScroll;
  ui.keepScroll = 0;
  padAfterRender();
}
const page = (title, sub, body, { back, nav } = {}) => `
  <div class="screen">
    <div class="top">${back ? `<button class="back" data-act="${back}" aria-label="Voltar">‹</button>` : ""}<h1>${title}${sub ? `<div class="sub">${sub}</div>` : ""}</h1>${nav ? `<button class="gear ${ui.tab === "opts" ? "on" : ""}" data-act="tab" data-v="opts" aria-label="Opções">⚙️</button>` : ""}</div>
    <div class="body"><div class="wrap">${body}</div></div>
    ${nav ? vNav() : ""}
  </div>`;

function vTitle() {
  const sv = load();
  return `<div class="title">
    <img class="pitch" src="icon.svg" alt="">
    <div class="logo">MUNDIAL<br><b>HAX</b></div>
    <p class="tag">Assuma um clube, jogue cada partida no campinho e faça história temporada após temporada.</p>
    <div class="actions">
      ${sv ? `<button class="btn primary" data-act="continue">Continuar · ${esc(cname(sv.userClub))} ${sv.season}</button>` : ""}
      <button class="btn ${sv ? "" : "primary"}" data-act="new">Nova carreira</button>
      <button class="btn" data-act="help">Como jogar</button>
    </div>
  </div>`;
}
function vHelp() {
  return page("Como jogar", "", `
    <div class="card"><h3>Partida</h3>
      <p>Futebol 11 contra 11 visto de cima, com o elenco do clube. <b>Passe</b> (A): vai rasteiro para o companheiro na direção do analógico (semi-assistido); segurando sai mais alto. <b>Passe alto</b> (X) e <b>enfiada</b> (Y, a bola vai no espaço à frente do companheiro; LB+Y por cima). <b>Chute</b> (B): segure para dar força e aponte para escolher o canto. <b>Correr</b> (RT) gasta fôlego.</p>
      <p>Aperte o passe, a enfiada ou o chute <b>antes da bola chegar</b> no companheiro e ele toca de primeira assim que dominar. Sem a bola: A ou LB troca para o jogador em melhor posição (a seta branca mostra quem; apertando de novo passa para o próximo), o analógico direito troca para o jogador naquela direção, e B ou X dá o bote. O goleiro é automático. Há lateral, escanteio e tiro de meta; não há impedimento nem faltas. Mata-mata empatado vai para prorrogação com gol de ouro e pênaltis.</p>
      <p class="hint">Funciona com toque, teclado ou controle (Xbox, PlayStation etc.). Com o celular deitado o campo aparece maior.</p></div>
    <div class="card"><h3>Carreira</h3>
      <p>Você disputa tudo o que o clube disputaria: estadual, Brasileirão (Séries A a D), Copa do Brasil, Libertadores, Sul-Americana, Recopa, Supercopa, Intercontinental e a Copa do Mundo de Clubes (a cada quatro anos, a partir de 2029).</p>
      <p>Acesso, rebaixamento e vagas seguem os regulamentos de 2026. Cada jogo pode ser jogado ou simulado. No fim da temporada você pode continuar ou trocar de clube; títulos e estatísticas ficam salvos no aparelho.</p></div>`, { back: "title" });
}

/* ---------------------------- escolha de clube ---------------------------- */
function pickList() {
  const t = ui.pickTab;
  let ids;
  if ("ABCD".includes(t)) ids = (G && ui.changing ? G.div[t] : INIT.div[t]);
  else if (t === "E") ids = (G && ui.changing ? G.q.states[ui.pickUF] : INIT.states[ui.pickUF]) || [];
  else ids = (G && ui.changing ? G.leagues[ui.pickLg] : INIT.leagues[ui.pickLg]);
  return ids.slice().sort((a, b) => cname(a).localeCompare(cname(b), "pt"));
}
function vPick() {
  const tabs = [["A", "Série A"], ["B", "Série B"], ["C", "Série C"], ["D", "Série D"], ["E", "Estaduais"], ["X", "Europa"]];
  const ids = pickList(), p = ui.pick;
  const sel = ui.pickTab === "E" ? `<label class="field"><select data-ch="pickUF">${UFS.map(u => `<option value="${u}" ${u === ui.pickUF ? "selected" : ""}>${UF_NAMES[u]}</option>`).join("")}</select></label>`
    : ui.pickTab === "X" ? `<label class="field"><select data-ch="pickLg">${Object.entries(EU_LEAGUES).map(([k, v]) => `<option value="${k}" ${k === ui.pickLg ? "selected" : ""}>${v[0]}</option>`).join("")}</select></label>` : "";
  const setup = ui.changing ? "" : `
    <div class="card">
      <label class="field"><span>Nome do treinador</span><input type="text" id="coach" maxlength="24" value="${esc(ui.coach || "")}" placeholder="Seu nome"></label>
      <label class="field" style="margin:0"><span>Dificuldade</span><div class="seg">${DIFFS.map((d, i) => `<button data-act="setdiff" data-v="${i}" class="${(ui.diff ?? 1) === i ? "on" : ""}">${d}</button>`).join("")}</div></label>
    </div>`;
  return page(ui.changing ? "Trocar de clube" : "Nova carreira", "Escolha o clube que você vai comandar", `
    ${setup}
    <div class="chips">${tabs.map(([k, n]) => `<button class="chip ${ui.pickTab === k ? "on" : ""}" data-act="picktab" data-v="${k}">${n}</button>`).join("")}</div>
    ${sel}
    <div class="grid">${ids.map(id => `<button class="pick ${p === id ? "on" : ""}" data-act="pick" data-v="${id}">${crest(id)}<span>${esc(cname(id))}</span><small>Força ${rating(id)}</small></button>`).join("")}</div>
    <div style="position:sticky;bottom:0;padding:12px 0 0;background:linear-gradient(transparent,var(--bg) 30%)">
      <button class="btn primary" data-act="${ui.changing ? "confirmchange" : "start"}" ${p ? "" : "disabled"}>${p ? (ui.changing ? "Assumir o " : "Começar com ") + esc(cname(p)) : "Escolha um clube"}</button>
    </div>`, { back: ui.changing ? "hub" : "title" });
}

/* ---------------------------- hub ---------------------------- */
function vNav() {
  const tabs = [["home", "🏠", "Início"], ["squad", "👥", "Elenco"], ["tables", "📊", "Tabelas"], ["games", "📅", "Jogos"], ["stats", "🏆", "Títulos"]];
  return `<nav class="nav">${tabs.map(([k, i, n]) => `<button class="${ui.tab === k ? "on" : ""}" data-act="tab" data-v="${k}"><span>${i}</span>${n}</button>`).join("")}</nav>`;
}
function vHub() {
  const me = G.userClub;
  const sub = `Temporada ${G.season} · ${DIV_LABEL[divOf(G, me)] ?? ""}`;
  const body = ui.tab === "home" ? tHome() : ui.tab === "squad" ? tSquad() : ui.tab === "tables" ? tTables() : ui.tab === "games" ? tGames() : ui.tab === "stats" ? tStats() : tOpts();
  return page(`${crest(me, 26)} ${esc(cname(me))}`, sub, body, { nav: true });
}
const sideCard = (id, where) => `<div class="side">${crest(id)}<span>${esc(cname(id))}</span><small>${where ? where + " · " : ""}Força ${rating(id)}</small></div>`;
function tHome() {
  const me = G.userClub;
  let next;
  if (ev?.type === "match") {
    const d = ev.match;
    const agg = d.agg ? `<div class="meta">Ida: <b>${esc(cname(d.a))} ${d.agg.a} × ${d.agg.h} ${esc(cname(d.h))}</b></div>` : "";
    next = `<div class="card next"><h3>Próximo jogo · ${d.date}</h3>
      <div class="meta"><b>${esc(d.comp)}</b> · ${esc(d.stage)}${d.label ? " · " + esc(d.label) : ""}</div>
      <div class="vs">${sideCard(d.h, d.neutral ? "Campo neutro" : "Casa")}<span class="x">×</span>${sideCard(d.a, d.neutral ? "Campo neutro" : "Fora")}</div>${agg}
      <div class="row" style="margin-top:12px"><button class="btn" data-act="sim">Simular</button><button class="btn primary" data-act="play">Jogar</button></div></div>`;
  } else {
    next = `<div class="card next"><h3>Fim da temporada ${G.season}</h3><p class="muted">Todos os campeonatos terminaram. Veja o resumo, os campeões e avance para ${G.season + 1}.</p>
      <button class="btn primary" data-act="endseason">Encerrar temporada</button></div>`;
  }
  const cs = compsOf(G, me);
  const sit = cs.map(c => { const s = standing(G, c, me); return `<li><span class="grow">${esc(c.name)}</span><span class="${s?.champion ? "badge gold" : "muted"}">${esc(s?.text || "")}</span></li>`; }).join("");
  const last = G.log.slice(-5);
  const res = m => { const mine = m.h === me ? m.hg : m.ag, th = m.h === me ? m.ag : m.hg; if (m.p) { const pm = m.h === me ? m.p[0] : m.p[1], pt = m.h === me ? m.p[1] : m.p[0]; return pm > pt ? "V" : "D"; } return mine > th ? "V" : mine < th ? "D" : "E"; };
  const S = G.log.reduce((a, m) => { a[res(m)]++; return a; }, { V: 0, E: 0, D: 0 });
  return `${next}
    <div class="card"><h3>Temporada</h3>
      <div class="kv"><div><b>${S.V}</b><span>Vitórias</span></div><div><b>${S.E}</b><span>Empates</span></div><div><b>${S.D}</b><span>Derrotas</span></div></div>
      ${last.length ? `<div class="form" style="margin-top:10px">${last.map(m => `<i class="${res(m)}">${res(m)}</i>`).join("")}<span class="muted" style="font-size:12px;align-self:center">últimos jogos</span></div>` : ""}
    </div>
    <div class="card"><h3>Competições</h3><ul class="list">${sit || '<li class="muted">Sem competições nesta temporada.</li>'}</ul></div>`;
}

/* ---------------------------- elenco ---------------------------- */
const POS_NAME = { G: "GOL", D: "DEF", M: "MEI", A: "ATA" };
function tSquad() {
  const me = G.userClub, sq = squadOf(me), lu = lineupOf(G, me), r = R(G, me), slots = FORMATIONS[lu.form];
  const row = (p, slot, k) => {
    const out = slot && p.pos !== slot;
    return `<button class="prow ${ui.selP === p.i ? "sel" : ""}" data-act="selp" data-v="${p.i}"><span class="pos p${slot || p.pos}">${POS_NAME[slot || p.pos]}</span><span class="pn">${p.num}</span><span class="grow">${esc(p.name)}${out ? ` <small class="muted">(${POS_NAME[p.pos]})</small>` : ""}</span>${playerGoals(G, me, p.i) ? `<span class="muted">⚽ ${playerGoals(G, me, p.i)}</span>` : ""}<b class="ovr">${ovrOf(p, r - (out ? 5 : 0))}</b></button>`;
  };
  const xi = lu.xi.map((i, k) => row(sq[i], slots[k][0], k)).join("");
  const bench = sq.filter(p => !lu.xi.includes(p.i)).sort((x, y) => "GDMA".indexOf(x.pos) - "GDMA".indexOf(y.pos) || y.off - x.off).map(p => row(p)).join("");
  return `<div class="card"><h3>Formação</h3><div class="seg">${FORM_NAMES.map(f => `<button data-act="form" data-v="${f}" class="${lu.form === f ? "on" : ""}">${f}</button>`).join("")}</div>
      <p class="hint">Toque em um jogador e depois em outro para trocar os dois de lugar.</p>
      <button class="btn small" style="margin-top:8px" data-act="bestxi">Melhor escalação</button></div>
    <div class="card"><h3>Titulares · força ${rating(me)}</h3>${xi}</div>
    <div class="card"><h3>Reservas</h3>${bench || '<p class="muted">Sem reservas.</p>'}</div>`;
}

/* ---------------------------- tabelas ---------------------------- */
const ZONE_LABEL = { lib: ["var(--accent)", "Libertadores"], pre: ["#29b6f6", "Pré-Libertadores"], sul: ["var(--warn)", "Sul-Americana"], up: ["var(--accent)", "Acesso"], po: ["#29b6f6", "Playoff"], down: ["var(--bad)", "Rebaixamento"], q: ["var(--accent)", "Classificação"] };
function tableHTML(g, zones = [], zmap = null) {
  const me = G.userClub, rows = table(g, t => R(G, t));
  const zc = (i, t) => { if (zmap) return zmap[t] ? "z-" + zmap[t] : ""; const z = zones.find(([a, b]) => i >= a && i <= b); return z ? "z-" + z[2] : ""; };
  return `<table class="tb"><thead><tr><th></th><th style="text-align:left">Clube</th><th>P</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th></tr></thead><tbody>${rows.map((r, i) =>
    `<tr class="${zc(i + 1, r.t)} ${r.t === me ? "me" : ""}"><td class="p">${i + 1}</td><td class="n">${crest(r.t)}${esc(cname(r.t))}</td><td class="pts">${r.pts}</td><td>${r.j}</td><td>${r.v}</td><td>${r.e}</td><td>${r.d}</td><td>${r.gp - r.gc > 0 ? "+" : ""}${r.gp - r.gc}</td></tr>`).join("")}</tbody></table>`;
}
const legend = zones => { const seen = [...new Set(zones.map(z => z[2]))]; return seen.length ? `<div class="legend">${seen.map(k => `<span><i style="background:${ZONE_LABEL[k][0]}"></i>${ZONE_LABEL[k][1]}</span>`).join("")}</div>` : ""; };
function tieHTML(st, t) {
  const me = G.userClub, done = t.g.every(g => g[0] >= 0), any = t.g.some(g => g[0] >= 0);
  const [A, B] = aggregate(t);
  const legs = st.legs === 2 && any ? `<small>${t.g.filter(g => g[0] >= 0).map((g, l) => (l === 0 ? g[0] + "–" + g[1] : g[1] + "–" + g[0])).join(" · ")}</small>` : "";
  const pens = t.p ? `<small>pên. ${t.p[0]}–${t.p[1]}</small>` : "";
  return `<div class="fx ${t.a === me || t.b === me ? "me" : ""}"><div class="t h"><span class="n ${done && t.w === t.a ? "w" : ""}">${esc(cname(t.a))}</span>${crest(t.a, 22)}</div>
    <div class="sc">${any ? A + " – " + B : "×"}${legs}${pens}</div>
    <div class="t">${crest(t.b, 22)}<span class="n ${done && t.w === t.b ? "w" : ""}">${esc(cname(t.b))}</span></div></div>`;
}
function stageHTML(st, c) {
  const me = G.userClub;
  if (st.type === "league" && c && c.id === "BRA") {
    // vagas calculadas ao vivo: campeões continentais e da Copa do Brasil abrem vaga para o próximo da tabela
    const v = brContinental(G), zm = {}, o = table(st, t => R(G, t)).map(r => r.t);
    for (const id of [...v.g, ...v.champs]) zm[id] = "lib";
    for (const id of v.p) zm[id] = "pre";
    for (const id of v.s) zm[id] = "sul";
    for (const id of o.slice(-4)) zm[id] = "down";
    const nG = v.g.filter(id => o.includes(id) && id !== G.comps.CDB?.champion).length;
    return tableHTML(st, st.zones, zm) + legend(st.zones) + `<p class="hint">As vagas se acumulam: quando um campeão da Libertadores, da Sul-Americana ou da Copa do Brasil já está na zona de classificação, a vaga passa para o próximo da tabela. Neste momento a Série A leva ${v.g.filter(id => o.includes(id)).length + v.champs.filter(id => o.includes(id)).length} clubes à fase de grupos da Libertadores, ${v.p.filter(id => o.includes(id)).length} à preliminar e ${v.s.length} à Sul-Americana.</p>`;
  }
  if (st.type === "league") return tableHTML(st, st.zones) + legend(st.zones);
  if (st.type === "groups") {
    const gs = st.groups.slice().sort((a, b) => b.teams.includes(me) - a.teams.includes(me));
    return gs.map(g => `<div class="gtitle">Grupo ${esc(g.name)}</div>${tableHTML(g, st.zones)}`).join("") + legend(st.zones);
  }
  const ties = st.ties.slice().sort((a, b) => (b.a === me || b.b === me) - (a.a === me || a.b === me));
  const tag = st.ties.some(t => t.tag === "po");
  return (st.legs === 2 ? `<p class="hint" style="margin:0 0 6px">Placar agregado (ida e volta). O clube da direita decide em casa.</p>` : "") +
    (tag ? ties.filter(t => t.tag !== "po").map(t => tieHTML(st, t)).join("") + `<div class="gtitle">Playoff de acesso</div>` + ties.filter(t => t.tag === "po").map(t => tieHTML(st, t)).join("") : ties.map(t => tieHTML(st, t)).join("")) +
    (st.bye !== undefined ? `<p class="hint">${esc(cname(st.bye))} avançou direto.</p>` : "") + (ties.length ? "" : `<p class="muted">Sem confrontos nesta fase.</p>`);
}
function tTables() {
  const me = G.userClub, mine = compsOf(G, me);
  const all = ORDER.map(id => G.comps[id]).filter(Boolean);
  if (!ui.comp || !G.comps[ui.comp]) ui.comp = (mine.find(c => c.tier) || mine[0] || all[0]).id;
  const c = G.comps[ui.comp];
  const top = topScorers(G, c.id, 20);
  if (ui.stage !== "top" && (ui.stage == null || ui.stage >= c.stages.length)) ui.stage = Math.max(0, c.stages.length - 1);
  if (ui.stage === "top" && !top.length) ui.stage = Math.max(0, c.stages.length - 1);
  const others = all.filter(x => !mine.includes(x));
  const st = c.stages[ui.stage];
  return `<div class="chips">${mine.map(x => `<button class="chip ${x.id === c.id ? "on" : ""}" data-act="comp" data-v="${x.id}">${esc(x.short)}</button>`).join("")}</div>
    <label class="field"><select data-ch="comp"><option value="">Outras competições…</option>${others.map(x => `<option value="${x.id}" ${x.id === c.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>
    <div class="card"><h3>${esc(c.name)} ${G.season}${c.done && c.champion != null ? ` · Campeão: ${esc(cname(c.champion))}` : ""}</h3>
      ${c.stages.length > 1 || top.length ? `<div class="chips">${c.stages.map((s, i) => `<button class="chip ${i === ui.stage ? "on" : ""}" data-act="stage" data-v="${i}">${esc(s.name)}</button>`).join("")}${top.length ? `<button class="chip ${ui.stage === "top" ? "on" : ""}" data-act="stage" data-v="top">Artilharia</button>` : ""}</div>` : ""}
      ${ui.stage === "top" ? `<ul class="list">${top.map((t, i) => `<li class="${t.club === me ? "mine" : ""}"><span class="muted" style="width:22px">${i + 1}</span>${crest(t.club, 22)}<span class="grow">${esc(t.name)} <small class="muted">${esc(cname(t.club))}</small></span><b>${t.goals}</b></li>`).join("")}</ul>` : st ? stageHTML(st, c) : `<p class="muted">Aguardando a definição dos participantes.</p>`}
    </div>`;
}

/* ---------------------------- jogos ---------------------------- */
function fxRow(x, showComp) {
  const me = G.userClub, pl = played(x), [hg, ag] = pl ? score(x) : [];
  const pen = pl && x.ko && x.tie.p && (x.st.legs === 1 || x.leg === 1) ? `<small>pên. ${x.leg === 1 ? x.tie.p[1] + "–" + x.tie.p[0] : x.tie.p[0] + "–" + x.tie.p[1]}</small>` : "";
  return `${showComp ? `<div class="fxhead"><span>${slotLabel(x.slot, G.season)} · ${esc(x.comp.short)}</span><span>${esc(x.st.name)}</span></div>` : ""}
    <div class="fx ${x.h === me || x.a === me ? "me" : ""}"><div class="t h"><span class="n">${esc(cname(x.h))}</span>${crest(x.h, 22)}</div>
    <div class="sc">${pl ? hg + " – " + ag : "×"}${pen}</div><div class="t">${crest(x.a, 22)}<span class="n">${esc(cname(x.a))}</span></div></div>`;
}
function tGames() {
  const fx = fixtures(G, G.userClub);
  const up = fx.filter(x => !played(x)), done = fx.filter(played).reverse();
  return `<div class="card"><h3>Próximos jogos</h3>${up.slice(0, 12).map(x => fxRow(x, true)).join("") || '<p class="muted">Nenhum jogo marcado (aguardando sorteios ou fim da temporada).</p>'}</div>
    <div class="card"><h3>Resultados (${done.length})</h3>${done.map(x => fxRow(x, true)).join("") || '<p class="muted">Nenhum jogo disputado ainda.</p>'}</div>`;
}

/* ---------------------------- títulos e estatísticas ---------------------------- */
const RANK_KEYS = ["BRA", "CDB", "LIB", "SUL", "REC", "SUP", "INT", "CWC", "BRB", "BRC", "BRD", ...UFS.map(u => "E_" + u), "UCL", "ENG", "ESP", "ITA", "GER", "FRA"];
function tStats() {
  const me = G.userClub;
  const chips = [["club", "Meu clube"], ["rank", "Ranking"], ["hall", "Campeões"], ["career", "Carreira"]];
  let body;
  if (ui.stat === "club") {
    const ts = titlesOf(G, me).sort((a, b) => RANK_KEYS.indexOf(a.key) - RANK_KEYS.indexOf(b.key));
    const S = G.stats;
    body = `<div class="card"><div class="clubhead">${crest(me)}<div><h2>${esc(club(me).full)}</h2><div class="muted">${DIV_LABEL[divOf(G, me)]} · Força ${rating(me)}</div></div></div></div>
      <div class="card"><h3>Sala de troféus</h3>${ts.map(t => `<div class="trophy"><b class="n">${t.n}</b><div>${esc(t.name)}${t.won ? `<span class="new">+${t.won} com você</span>` : ""}</div></div>`).join("") || '<p class="muted">Nenhum título ainda. A história começa com você.</p>'}</div>
      <div class="card"><h3>Treinador ${esc(G.coach)}</h3><div class="kv"><div><b>${S.j}</b><span>Jogos</span></div><div><b>${S.v}</b><span>Vitórias</span></div><div><b>${S.titles}</b><span>Títulos</span></div><div><b>${S.e}</b><span>Empates</span></div><div><b>${S.d}</b><span>Derrotas</span></div><div><b>${S.gp}:${S.gc}</b><span>Gols</span></div></div></div>`;
  } else if (ui.stat === "rank") {
    const rk = titleRanking(G, ui.rankKey);
    body = `<label class="field"><select data-ch="rankKey">${RANK_KEYS.map(k => `<option value="${k}" ${k === ui.rankKey ? "selected" : ""}>${esc(COMP_NAMES[k])}</option>`).join("")}</select></label>
      <div class="card"><h3>Maiores campeões · ${esc(COMP_NAMES[ui.rankKey])}</h3><ul class="list">${rk.slice(0, 40).map((r, i) => `<li><span class="muted" style="width:22px">${i + 1}</span>${crest(r.id, 24)}<span class="grow">${esc(cname(r.id))}</span>${r.won ? `<span class="badge up">+${r.won}</span>` : ""}<b>${r.n}</b></li>`).join("") || '<li class="muted">Sem dados para esta competição.</li>'}</ul>
      <p class="hint">Histórico real até 2025 (ligas europeias até 2025-26) somado aos títulos conquistados no jogo. Aparecem apenas clubes presentes no jogo.</p></div>`;
  } else if (ui.stat === "hall") {
    const uf = club(me).uf, keys = ["BRA", "CDB", "LIB", "SUL", "INT", "CWC", "BRB", "BRC", "BRD", uf ? "E_" + uf : null, "UCL"].filter(Boolean);
    const years = [...new Set(G.hall.map(h => h[0]))].sort((a, b) => b - a);
    body = years.map(y => `<div class="card"><h3>Temporada ${y}</h3><ul class="list">${keys.map(k => { const h = G.hall.find(x => x[0] === y && x[1] === k); return h ? `<li><span class="grow muted">${esc(COMP_NAMES[k])}</span>${crest(h[2], 22)}<b>${esc(cname(h[2]))}</b></li>` : ""; }).join("")}</ul></div>`).join("") || `<div class="card"><p class="muted">Os campeões de cada temporada aparecem aqui ao fim do ano.</p></div>`;
  } else {
    body = `<div class="card"><h3>Carreira de ${esc(G.coach)}</h3>${G.career.length ? `<ul class="list">${G.career.slice().reverse().map(c => `<li>${crest(c.club, 24)}<span class="grow"><b>${c.y}</b> · ${esc(cname(c.club))}<br><span class="muted" style="font-size:12px">${esc(c.league || "Sem divisão")} ${c.posText ? "· " + esc(c.posText) : ""} · ${c.v}V ${c.e}E ${c.d}D</span></span>${c.titles.length ? `<span class="badge gold">🏆 ${c.titles.length}</span>` : ""}</li>`).join("")}</ul>` : '<p class="muted">Sua primeira temporada ainda está em andamento.</p>'}</div>`;
  }
  return `<div class="chips">${chips.map(([k, n]) => `<button class="chip ${ui.stat === k ? "on" : ""}" data-act="stat" data-v="${k}">${n}</button>`).join("")}</div>${body}`;
}

/* ---------------------------- opções ---------------------------- */
function tOpts() {
  const o = G.opts, seg = (act, vals, cur, fmt = v => v) => `<div class="seg">${vals.map(v => `<button data-act="${act}" data-v="${v}" class="${cur === v ? "on" : ""}">${fmt(v)}</button>`).join("")}</div>`;
  return `<div class="card"><h3>Partida</h3>
      <label class="field"><span>Dificuldade</span>${seg("diff", [0, 1, 2, 3], G.diff, v => DIFFS[v])}</label>
      <label class="field"><span>Duração do jogo</span>${seg("mins", [4, 6, 8, 10], o.mins, v => v + " min")}</label>
      <label class="field"><span>Analógico na tela</span>${seg("stick", ["fixed", "float"], o.stick || "fixed", v => (v === "fixed" ? "Fixo" : "Onde tocar"))}</label>
      <label class="field"><span>Troca automática de jogador</span>${seg("auto", [1, 0], o.autoSwitch ? 1 : 0, v => (v ? "Ligada" : "Desligada"))}</label>
      <label class="field" style="margin:0"><span>Som</span>${seg("sound", [1, 0], o.sound ? 1 : 0, v => (v ? "Ligado" : "Desligado"))}</label>
    </div>
    <div class="card"><h3>Temporada</h3>
      <button class="btn" data-act="simall" ${ev?.type === "match" ? "" : "disabled"}>Simular o resto da temporada</button>
      <p class="hint">Trocar de clube é possível ao fim de cada temporada.</p>
    </div>
    <div class="card"><h3>Controles</h3>
      <p class="hint" style="margin-top:0"><b>Toque:</b> analógico à esquerda; PASSE (toque rápido = rasteiro, segurando = alto), ENFIADA, CHUTE (segure para dar força), CORRER. Sem a bola, PASSE troca de jogador e CHUTE dá o bote.</p>
      <p class="hint"><b>Controle (Xbox e outros):</b> analógico esquerdo move · A passe · X passe alto · Y enfiada (LB+Y por cima) · B chute · RT correr. Sem a bola: A ou LB troca, analógico direito troca na direção, B ou X bote. Apertar antes da bola chegar = toque de primeira. Start pausa. Nos menus: direcional navega, A confirma, B volta, LB/RB mudam de aba.</p>
      <p class="hint"><b>Teclado:</b> setas ou WASD · J passe · H passe alto · U enfiada · K chute · Shift correr · C trocar · P pausa.</p>
    </div>
    <div class="card"><h3>Dados</h3>
      <button class="btn" data-act="title">Voltar ao menu</button>
      <button class="btn danger" style="margin-top:8px" data-act="wipe">Apagar carreira</button>
      <p class="hint">O jogo é salvo automaticamente neste aparelho. Escudos carregados do Transfermarkt/Wikipédia quando há internet; dados dos clubes via Wikipédia/Wikidata.</p>
    </div>`;
}

/* ---------------------------- pós-jogo ---------------------------- */
function vPost() {
  const { d, hg, ag, pen, goals } = ui.post, me = G.userClub;
  const gl = goals && goals.length ? `<div class="goals">${goals.map(g => `<div class="${g.club === d.h ? "gh" : "ga"}">${g.club === d.h ? "" : `<i>${g.min}'</i> `}${esc(g.name)}${g.own ? " (contra)" : ""}${g.club === d.h ? ` <i>${g.min}'</i>` : ""}</div>`).join("")}</div>` : "";
  const mine = d.h === me ? hg : ag, th = d.h === me ? ag : hg;
  let v = mine > th ? "V" : mine < th ? "D" : "E", text = { V: "Vitória!", E: "Empate", D: "Derrota" }[v];
  if (pen) { const pm = d.h === me ? pen[0] : pen[1], pt = d.h === me ? pen[1] : pen[0]; v = pm > pt ? "V" : "D"; text = pm > pt ? "Classificado nos pênaltis!" : "Eliminado nos pênaltis"; }
  else if (d.ko && d.decisive && d.x.tie.w != null) { v = d.x.tie.w === me ? "V" : "D"; text = d.x.tie.w === me ? (d.stage === "Final" ? "CAMPEÃO!" : "Classificado!") : (d.stage === "Final" ? "Vice-campeão" : "Eliminado"); }
  const st = d.x.st, round = [...stageMatches(st)].filter(x => x.slot === d.slot && played(x) && x !== d.x && !(x.h === d.h && x.a === d.a));
  const c = G.comps[d.compId];
  let tb = "";
  if (st.type === "league") tb = tableHTML(st, st.zones);
  else if (st.type === "groups") { const g = st.groups.find(g2 => g2.teams.includes(me)); if (g) tb = `<div class="gtitle">Grupo ${esc(g.name)}</div>` + tableHTML(g, st.zones); }
  return page(esc(d.comp), `${esc(d.stage)}${d.label ? " · " + esc(d.label) : ""}`, `
    <div class="card result"><div class="vs next"><div class="vs">${sideCard(d.h, "")}<div><div class="big">${hg} – ${ag}</div>${pen ? `<div class="pens">Pênaltis: ${pen[0]} – ${pen[1]}</div>` : ""}</div>${sideCard(d.a, "")}</div></div>
      ${gl}<div class="verdict ${v}">${text}</div>
      <button class="btn primary" style="margin-top:14px" data-act="postok">Continuar</button></div>
    ${round.length ? `<div class="card"><h3>Outros resultados</h3>${round.slice(0, 24).map(x => fxRow(x, false)).join("")}</div>` : ""}
    ${tb ? `<div class="card"><h3>Classificação</h3>${tb}</div>` : ""}
    ${c?.done && c.champion != null ? `<div class="card center"><h3>Campeão</h3>${crest(c.champion, 56)}<p><b>${esc(cname(c.champion))}</b></p></div>` : ""}`);
}

/* ---------------------------- resumo da temporada ---------------------------- */
function vSummary() {
  const s = ui.summary, me = s.club;
  const mv = s.promoted ? `<span class="badge up">Acesso</span>` : s.relegated ? `<span class="badge down">Rebaixado</span>` : "";
  const main = ["BRA", "CDB", "LIB", "SUL", "INT", "CWC", "BRB", "BRC", "BRD", "UCL"];
  const names = ids => ids.map(id => esc(cname(id))).join(", ");
  return page(`Temporada ${s.season}`, "Resumo do ano", `
    <div class="card"><div class="clubhead">${crest(me)}<div><h2>${esc(cname(me))}</h2><div class="muted">${s.record.v}V ${s.record.e}E ${s.record.d}D · ${s.record.gp} gols pró, ${s.record.gc} contra</div><div style="margin-top:4px">${mv} ${s.titles.length ? `<span class="badge gold">🏆 ${s.titles.length} título${s.titles.length > 1 ? "s" : ""}</span>` : ""}</div></div></div></div>
    <div class="card"><h3>Seu desempenho</h3><ul class="list">${s.comps.map(c => `<li><span class="grow">${esc(c.name)}</span><span class="${c.champion ? "badge gold" : "muted"}">${esc(c.text)}</span></li>`).join("")}</ul>
      <p class="hint">Em ${s.season + 1}: ${DIV_LABEL[s.newDiv]}${s.lib.includes(me) ? " · classificado para a Libertadores" : s.sul.includes(me) ? " · classificado para a Sul-Americana" : ""}.</p></div>
    <div class="card"><h3>Campeões de ${s.season}</h3><ul class="list">${s.champs.filter(c => main.includes(c.id) || c.id === "E_" + club(me).uf).map(c => `<li><span class="grow muted">${esc(c.name)}</span>${crest(c.champion, 22)}<b>${esc(cname(c.champion))}</b></li>`).join("")}</ul></div>
    <div class="card"><h3>Sobe e desce</h3><ul class="list">
      <li><span class="grow"><span class="badge up">Sobem para a Série A</span><br>${names(s.moves.upA)}</span></li>
      <li><span class="grow"><span class="badge down">Caem para a Série B</span><br>${names(s.moves.downA)}</span></li>
      <li><span class="grow"><span class="badge up">Sobem para a Série B</span><br>${names(s.moves.upB)}</span></li>
      <li><span class="grow"><span class="badge down">Caem para a Série C</span><br>${names(s.moves.downB)}</span></li>
      <li><span class="grow"><span class="badge up">Sobem para a Série C</span><br>${names(s.moves.upC)}</span></li>
      <li><span class="grow"><span class="badge down">Caem para a Série D</span><br>${names(s.moves.downC)}</span></li></ul></div>
    <div class="card"><h3>Temporada ${s.season + 1}</h3>
      <button class="btn primary" data-act="nextseason">Continuar no ${esc(cname(me))}</button>
      <button class="btn" style="margin-top:8px" data-act="changeclub">Trocar de clube</button></div>`);
}

/* ---------------------------- partidas ---------------------------- */
const sideInfo = id => ({ name: cname(id), abbr: abbr(id), c1: club(id).c1, c2: club(id).c2, crest: crest(id, 24) });
let busy = false;
async function doMatch(simulate) {
  if (busy || ev?.type !== "match") return;
  busy = true;
  const d = ev.match, me = G.userClub, home = d.h === me, opp = home ? d.a : d.h;
  let hg, ag, pen = null, goals = null;
  try {
    if (simulate) { const r = simUser(G, d); hg = r.hg; ag = r.ag; pen = r.pen; }
    else {
      const hb = d.neutral ? 0 : 1.5, lu = lineupOf(G, me);
      const r = await runMatch(document.body, {
        teams: [matchTeam(me, R(G, me) + (home ? hb : -hb), lu.form, lu.xi), matchTeam(opp, R(G, opp) + (home ? -hb : hb), defaultFormation(opp))],
        mins: G.opts.mins, diff: G.diff, autoSwitch: G.opts.autoSwitch, sound: G.opts.sound, stick: G.opts.stick, human: 0,
        needWinner: d.ko && d.decisive, aggDiff: d.agg ? (home ? d.agg.h - d.agg.a : d.agg.a - d.agg.h) : 0, kickoff: home ? 0 : 1,
        left: sideInfo(me), right: sideInfo(opp), title: d.short + " · " + d.stage, sub: d.label,
      });
      hg = home ? r.score[0] : r.score[1]; ag = home ? r.score[1] : r.score[0];
      pen = r.pens ? (home ? r.pens : [r.pens[1], r.pens[0]]) : null;
      goals = r.goals.map(g => ({ club: g.team === 0 ? me : opp, name: g.name, i: g.i, own: g.own, min: g.min }));
      const scorers = goals.filter(g => !g.own && g.i >= 0).map(g => [g.club, g.i]);
      pen = playUser(G, d, { hg, ag, pen, scorers }).pen;
    }
  } finally { busy = false; }
  persist();
  ui.post = { d, hg, ag, pen, goals }; ui.screen = "post"; render();
}

/* ---------------------------- eventos ---------------------------- */
const ACT = {
  title() { ui.screen = "title"; render(); },
  help() { ui.screen = "help"; render(); },
  hub() { ui.changing = false; ui.screen = ui.summary ? "summary" : "hub"; render(); },
  async new() { if (load() && !(await ask("Começar uma nova carreira apaga a carreira salva. Continuar?", "Nova carreira"))) return; ui.changing = false; ui.pick = null; ui.screen = "new"; render(); },
  continue() { G = load(); if (!G) return; ev = step(G); ui.screen = "hub"; ui.tab = "home"; render(); },
  picktab(v) { ui.pickTab = v; render(); },
  pick(v) { ui.pick = +v; ui.keepScroll = app.querySelector(".body").scrollTop; saveCoach(); render(); },
  setdiff(v) { ui.diff = +v; saveCoach(); render(); },
  start() { saveCoach(); G = newGame({ clubId: ui.pick, coach: ui.coach || "Treinador", diff: ui.diff ?? 1 }); refreshEvent(); ui.screen = "hub"; ui.tab = "home"; ui.comp = null; ui.summary = null; render(); },
  tab(v) { ui.tab = v; render(); },
  comp(v) { ui.comp = v; ui.stage = null; render(); },
  stage(v) { ui.stage = v === "top" ? "top" : +v; ui.keepScroll = app.querySelector(".body").scrollTop; render(); },
  stat(v) { ui.stat = v; render(); },
  play() { doMatch(false); },
  sim() { doMatch(true); },
  postok() { ui.post = null; ev = step(G); persist(); ui.screen = "hub"; ui.tab = "home"; render(); },
  async simall() {
    if (!(await ask("Simular todos os jogos restantes da temporada?", "Simular"))) return;
    let guard = 0;
    while (ev?.type === "match" && guard++ < 400) { simUser(G, ev.match); ev = step(G); }
    persist(); ui.tab = "home"; render();
  },
  endseason() { ui.summary = endSeason(G); ev = null; persist(); ui.screen = "summary"; render(); },
  nextseason() { ui.summary = null; ui.comp = null; refreshEvent(); ui.screen = "hub"; ui.tab = "home"; render(); },
  changeclub() { ui.changing = true; ui.pick = null; ui.screen = "new"; render(); },
  confirmchange() { changeClub(G, ui.pick); ui.changing = false; ui.summary = null; ui.comp = null; refreshEvent(); ui.screen = "hub"; ui.tab = "home"; render(); toast("Bem-vindo ao " + cname(G.userClub) + "!"); },
  diff(v) { G.diff = +v; persist(); render(); },
  mins(v) { G.opts.mins = +v; persist(); render(); },
  stick(v) { G.opts.stick = v; persist(); render(); },
  form(v) { setFormation(G, v); ui.selP = null; persist(); render(); },
  bestxi() { setFormation(G, lineupOf(G, G.userClub).form); ui.selP = null; persist(); render(); },
  selp(v) {
    const i = +v, lu = lineupOf(G, G.userClub);
    if (ui.selP === null) ui.selP = i;
    else if (ui.selP === i) ui.selP = null;
    else {
      const a = lu.xi.indexOf(ui.selP), b = lu.xi.indexOf(i);
      if (a >= 0 && b >= 0) [lu.xi[a], lu.xi[b]] = [lu.xi[b], lu.xi[a]];
      else if (a >= 0) lu.xi[a] = i; else if (b >= 0) lu.xi[b] = ui.selP;
      ui.selP = null; persist();
    }
    ui.keepScroll = app.querySelector(".body").scrollTop; render();
  },
  auto(v) { G.opts.autoSwitch = v === "1"; persist(); render(); },
  sound(v) { G.opts.sound = v === "1"; persist(); render(); },
  async wipe() { if (!(await ask("Apagar a carreira salva? Isso não pode ser desfeito.", "Apagar"))) return; wipe(); G = null; ev = null; ui.summary = null; ui.screen = "title"; render(); },
};
function saveCoach() { const el = document.getElementById("coach"); if (el) ui.coach = el.value.trim(); }
app.addEventListener("click", e => {
  const b = e.target.closest("[data-act]");
  if (!b || b.disabled) return;
  ACT[b.dataset.act]?.(b.dataset.v);
});
app.addEventListener("change", e => {
  const k = e.target.dataset?.ch;
  if (!k) return;
  if (k === "comp") { if (e.target.value) { ui.comp = e.target.value; ui.stage = null; } } else ui[k] = e.target.value;
  if (k === "pickUF" || k === "pickLg") saveCoach();
  render();
});
// o resumo de fim de temporada precisa sobreviver a um recarregamento: nesse caso a nova temporada já está montada
initPad({ back() { const b = document.querySelector(".modal [data-r='0']") || app.querySelector(".back"); if (b) b.click(); else if (ui.screen === "hub" && ui.tab !== "home") ACT.tab("home"); }, tab(dir) { if (ui.screen !== "hub") return; const t = ["home", "squad", "tables", "games", "stats", "opts"], i = t.indexOf(ui.tab); ACT.tab(t[(i + dir + t.length) % t.length]); } });
render();
// ganchos para testes automatizados
window.__mh = { get G() { return G; }, get ev() { return ev; }, ui, ACT, render };
