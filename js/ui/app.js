// Interface do Mundial Hax (menus, carreira, tabelas e estatísticas).
import { clubs, club, cname, crestUrl, crestFallback, abbr, INIT, UF_NAMES, STATE_NAMES } from "../core/db.js";
import { newGame, step, playUser, simUser, endSeason, save, load, wipe, compsOf, fixtures, standing, titlesOf, titleRanking, divOf, DIFFS, stageHas, changeClub } from "../core/season.js";
import { ORDER, COMP_NAMES, R, slotLabel, EU_LEAGUES, UFS } from "../core/comps.js";
import { table, stageMatches, played, score, aggregate } from "../core/stages.js";
import { runMatch } from "../game/view.js";

const app = document.getElementById("app");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
window.__crestErr = img => { const fb = img.dataset.fb; if (fb) { img.dataset.fb = ""; img.src = fb; } else img.remove(); };
window.__crestOk = img => img.parentNode.classList.add("ok");

export function crest(id, size) {
  const c = club(id);
  if (!c) return "";
  const url = crestUrl(id), fb = crestFallback(id);
  const img = url ? `<img alt="" loading="lazy" referrerpolicy="no-referrer" src="${esc(url)}" data-fb="${esc(fb)}" onload="__crestOk(this)" onerror="__crestErr(this)">` : "";
  return `<span class="crest" style="${size ? `--s:${size}px;` : ""}--c1:${c.c1};--c2:${c.c2}"><span>${esc(abbr(id))}</span>${img}</span>`;
}

let G = null, ev = null;
const ui = { screen: "title", tab: "home", comp: null, stage: null, stat: "club", rankKey: "BRA", pickTab: "A", pickUF: "SP", pickLg: "ENG", pick: null, post: null, summary: null, changing: false };
const DIV_LABEL = { A: "Série A", B: "Série B", C: "Série C", D: "Série D", "": "Sem divisão nacional" };
const rating = id => Math.round(G ? R(G, id) : club(id).r0);

function toast(t) { const el = document.createElement("div"); el.className = "toast"; el.textContent = t; document.body.appendChild(el); setTimeout(() => el.remove(), 2200); }
function persist() { if (G && !save(G)) toast("Não foi possível salvar (armazenamento cheio ou bloqueado)."); }
function refreshEvent() { ev = step(G); persist(); }

/* ------------------------------------------------------------------ */
function render() {
  const s = ui.screen;
  app.innerHTML = s === "title" ? vTitle() : s === "new" ? vPick() : s === "post" ? vPost() : s === "summary" ? vSummary() : s === "help" ? vHelp() : vHub();
  const body = app.querySelector(".body");
  if (body && ui.keepScroll) body.scrollTop = ui.keepScroll;
  ui.keepScroll = 0;
}
const page = (title, sub, body, { back, nav } = {}) => `
  <div class="screen">
    <div class="top">${back ? `<button class="back" data-act="${back}" aria-label="Voltar">‹</button>` : ""}<h1>${title}${sub ? `<div class="sub">${sub}</div>` : ""}</h1></div>
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
      <p>Arraste o dedo no lado esquerdo da tela para mover o jogador. Segure <b>CHUTE</b> para chutar quando encostar na bola. <b>TROCAR</b> passa o controle para o companheiro mais próximo da bola (o goleiro é automático).</p>
      <p>Não há lateral nem escanteio: a bola bate nas paredes e o jogo não para. Em mata-mata empatado há prorrogação com gol de ouro e, se preciso, pênaltis.</p>
      <p class="hint">Funciona em pé ou deitado; com o celular deitado o campo fica maior. No computador: setas/WASD, espaço para chutar, C para trocar.</p></div>
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
  const tabs = [["home", "🏠", "Início"], ["tables", "📊", "Tabelas"], ["games", "📅", "Jogos"], ["stats", "🏆", "Títulos"], ["opts", "⚙️", "Opções"]];
  return `<nav class="nav">${tabs.map(([k, i, n]) => `<button class="${ui.tab === k ? "on" : ""}" data-act="tab" data-v="${k}"><span>${i}</span>${n}</button>`).join("")}</nav>`;
}
function vHub() {
  const me = G.userClub;
  const sub = `Temporada ${G.season} · ${DIV_LABEL[divOf(G, me)] ?? ""}`;
  const body = ui.tab === "home" ? tHome() : ui.tab === "tables" ? tTables() : ui.tab === "games" ? tGames() : ui.tab === "stats" ? tStats() : tOpts();
  return page(`${crest(me, 26)} ${esc(cname(me))}`, sub, body, { nav: true });
}
const sideCard = (id, where) => `<div class="side">${crest(id)}<span>${esc(cname(id))}</span><small>${where} · Força ${rating(id)}</small></div>`;
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

/* ---------------------------- tabelas ---------------------------- */
const ZONE_LABEL = { lib: ["var(--accent)", "Libertadores"], pre: ["#29b6f6", "Pré-Libertadores"], sul: ["var(--warn)", "Sul-Americana"], up: ["var(--accent)", "Acesso"], po: ["#29b6f6", "Playoff"], down: ["var(--bad)", "Rebaixamento"], q: ["var(--accent)", "Classificação"] };
function tableHTML(g, zones = []) {
  const me = G.userClub, rows = table(g, t => R(G, t));
  const zc = i => { const z = zones.find(([a, b]) => i >= a && i <= b); return z ? "z-" + z[2] : ""; };
  return `<table class="tb"><thead><tr><th></th><th style="text-align:left">Clube</th><th>P</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th></tr></thead><tbody>${rows.map((r, i) =>
    `<tr class="${zc(i + 1)} ${r.t === me ? "me" : ""}"><td class="p">${i + 1}</td><td class="n">${crest(r.t)}${esc(cname(r.t))}</td><td class="pts">${r.pts}</td><td>${r.j}</td><td>${r.v}</td><td>${r.e}</td><td>${r.d}</td><td>${r.gp - r.gc > 0 ? "+" : ""}${r.gp - r.gc}</td></tr>`).join("")}</tbody></table>`;
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
function stageHTML(st) {
  const me = G.userClub;
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
  if (ui.stage == null || ui.stage >= c.stages.length) ui.stage = Math.max(0, c.stages.length - 1);
  const others = all.filter(x => !mine.includes(x));
  const st = c.stages[ui.stage];
  return `<div class="chips">${mine.map(x => `<button class="chip ${x.id === c.id ? "on" : ""}" data-act="comp" data-v="${x.id}">${esc(x.short)}</button>`).join("")}</div>
    <label class="field"><select data-ch="comp"><option value="">Outras competições…</option>${others.map(x => `<option value="${x.id}" ${x.id === c.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>
    <div class="card"><h3>${esc(c.name)} ${G.season}${c.done && c.champion != null ? ` · Campeão: ${esc(cname(c.champion))}` : ""}</h3>
      ${c.stages.length > 1 ? `<div class="chips">${c.stages.map((s, i) => `<button class="chip ${i === ui.stage ? "on" : ""}" data-act="stage" data-v="${i}">${esc(s.name)}</button>`).join("")}</div>` : ""}
      ${st ? stageHTML(st) : `<p class="muted">Aguardando a definição dos participantes.</p>`}
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
      <label class="field"><span>Duração do jogo</span>${seg("mins", [2, 3, 4, 6], o.mins, v => v + " min")}</label>
      <label class="field"><span>Jogadores por time</span>${seg("size", [3, 4, 5], o.size, v => v + " × " + v)}</label>
      <label class="field"><span>Troca automática de jogador</span>${seg("auto", [1, 0], o.autoSwitch ? 1 : 0, v => (v ? "Ligada" : "Desligada"))}</label>
      <label class="field" style="margin:0"><span>Som</span>${seg("sound", [1, 0], o.sound ? 1 : 0, v => (v ? "Ligado" : "Desligado"))}</label>
    </div>
    <div class="card"><h3>Temporada</h3>
      <button class="btn" data-act="simall" ${ev?.type === "match" ? "" : "disabled"}>Simular o resto da temporada</button>
      <p class="hint">Trocar de clube é possível ao fim de cada temporada.</p>
    </div>
    <div class="card"><h3>Dados</h3>
      <button class="btn" data-act="title">Voltar ao menu</button>
      <button class="btn danger" style="margin-top:8px" data-act="wipe">Apagar carreira</button>
      <p class="hint">O jogo é salvo automaticamente neste aparelho. Escudos carregados do Transfermarkt/Wikipédia quando há internet; dados dos clubes via Wikipédia/Wikidata.</p>
    </div>`;
}

/* ---------------------------- pós-jogo ---------------------------- */
function vPost() {
  const { d, hg, ag, pen } = ui.post, me = G.userClub;
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
      <div class="verdict ${v}">${text}</div>
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
  let hg, ag, pen = null;
  try {
    if (simulate) { const r = simUser(G, d); hg = r.hg; ag = r.ag; pen = r.pen; }
    else {
      const hb = d.neutral ? 0 : 1.5;
      const r = await runMatch(document.body, {
        size: G.opts.size, mins: G.opts.mins, diff: G.diff, autoSwitch: G.opts.autoSwitch, sound: G.opts.sound,
        ratings: [R(G, me) + (home ? hb : -hb), R(G, opp) + (home ? -hb : hb)], human: 0,
        needWinner: d.ko && d.decisive, aggDiff: d.agg ? (home ? d.agg.h - d.agg.a : d.agg.a - d.agg.h) : 0, kickoff: home ? 0 : 1,
        left: sideInfo(me), right: sideInfo(opp), title: d.short + " · " + d.stage, sub: d.label,
      });
      hg = home ? r.score[0] : r.score[1]; ag = home ? r.score[1] : r.score[0];
      pen = r.pens ? (home ? r.pens : [r.pens[1], r.pens[0]]) : null;
      pen = playUser(G, d, { hg, ag, pen }).pen;
    }
  } finally { busy = false; }
  persist();
  ui.post = { d, hg, ag, pen }; ui.screen = "post"; render();
}

/* ---------------------------- eventos ---------------------------- */
const ACT = {
  title() { ui.screen = "title"; render(); },
  help() { ui.screen = "help"; render(); },
  hub() { ui.changing = false; ui.screen = ui.summary ? "summary" : "hub"; render(); },
  new() { if (load() && !confirm("Começar uma nova carreira apaga a carreira salva. Continuar?")) return; ui.changing = false; ui.pick = null; ui.screen = "new"; render(); },
  continue() { G = load(); if (!G) return; ev = step(G); ui.screen = "hub"; ui.tab = "home"; render(); },
  picktab(v) { ui.pickTab = v; render(); },
  pick(v) { ui.pick = +v; ui.keepScroll = app.querySelector(".body").scrollTop; saveCoach(); render(); },
  setdiff(v) { ui.diff = +v; saveCoach(); render(); },
  start() { saveCoach(); G = newGame({ clubId: ui.pick, coach: ui.coach || "Treinador", diff: ui.diff ?? 1 }); refreshEvent(); ui.screen = "hub"; ui.tab = "home"; ui.comp = null; ui.summary = null; render(); },
  tab(v) { ui.tab = v; render(); },
  comp(v) { ui.comp = v; ui.stage = null; render(); },
  stage(v) { ui.stage = +v; ui.keepScroll = app.querySelector(".body").scrollTop; render(); },
  stat(v) { ui.stat = v; render(); },
  play() { doMatch(false); },
  sim() { doMatch(true); },
  postok() { ui.post = null; ev = step(G); persist(); ui.screen = "hub"; ui.tab = "home"; render(); },
  simall() {
    if (!confirm("Simular todos os jogos restantes da temporada?")) return;
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
  size(v) { G.opts.size = +v; persist(); render(); },
  auto(v) { G.opts.autoSwitch = v === "1"; persist(); render(); },
  sound(v) { G.opts.sound = v === "1"; persist(); render(); },
  wipe() { if (!confirm("Apagar a carreira salva? Isso não pode ser desfeito.")) return; wipe(); G = null; ev = null; ui.summary = null; ui.screen = "title"; render(); },
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
render();
// ganchos para testes automatizados
window.__mh = { get G() { return G; }, get ev() { return ev; }, ui, ACT, render };
