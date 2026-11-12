// Testa a partida 11x11 no navegador: toque (analógico fixo, passe, chute), controle (gamepad simulado) e pausa.
// node tools/e2e-match.cjs [url] [pasta-de-capturas]
const { chromium } = require("playwright");
const URL = process.argv[2] || "http://localhost:8123/", SH = (process.argv[3] || "shots") + "/";
require("fs").mkdirSync(SH, { recursive: true });

const start = (page, extra) => page.evaluate(async extra => {
  const { runMatch } = await import("./js/game/view.js");
  const { matchTeam, defaultFormation } = await import("./js/core/squads.js");
  const { findClub, club, abbr } = await import("./js/core/db.js");
  const mk = n => { const id = findClub(n, "BR"); return { team: matchTeam(id, club(id).r0, defaultFormation(id)), info: { name: n, abbr: abbr(id), c1: club(id).c1, c2: club(id).c2, crest: "" } }; };
  const a = mk("Flamengo"), b = mk("Corinthians");
  window.__res = null;
  runMatch(document.body, { teams: [a.team, b.team], left: a.info, right: b.info, human: 0, diff: 1, mins: 6, sound: false, title: "Teste", ...extra }).then(r => (window.__res = r));
}, extra);
const state = page => page.evaluate(() => {
  const m = document.querySelector(".mv")._match, c = m.ctrl, b = m.ball;
  return { state: m.state, setPiece: !!m.setPiece, ctrl: c && c.name, x: c && +c.x.toFixed(2), y: c && +c.y.toFixed(2), owner: b.owner && b.owner.name, ownerTeam: b.owner ? b.owner.team : -1, target: b.target && b.target.name, passes: m.stats.passes[0], shots: m.stats.shots[0], bspeed: +Math.hypot(b.vx, b.vy).toFixed(1) };
});

(async () => {
  const browser = await chromium.launch();
  let fails = 0;
  const check = (ok, what) => { console.log((ok ? "OK    " : "FALHA ") + what); if (!ok) fails++; };

  /* ---------- 1) toque, celular deitado ---------- */
  let ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  let page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  await page.goto(URL);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
  await start(page, {});
  await page.waitForFunction(() => document.querySelector(".mv")._match.setPiece, null, { timeout: 8000 });
  await page.screenshot({ path: SH + "20-saida.png" });
  let s0 = await state(page);
  check(s0.owner === s0.ctrl && s0.ownerTeam === 0, "saída de bola com o jogador controlado (" + s0.ctrl + ")");
  // a base do analógico é fixa: tocar longe do centro já dá direção total
  const ring = await page.evaluate(() => { const r = document.querySelector("#mvring").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  // passe: aponta para trás (esquerda) e toca em PASSE
  const pb = await page.evaluate(() => { const r = document.querySelector("#mvpass").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await touch("touchStart", [[ring[0] - 40, ring[1], 1]]);
  await page.waitForTimeout(120);
  await touch("touchStart", [[ring[0] - 40, ring[1], 1], [pb[0], pb[1], 2]]);
  await page.waitForTimeout(80);
  await touch("touchEnd", [[pb[0], pb[1], 2]]);            // solta só o botão PASSE (os pontos listados são os liberados)
  await page.waitForTimeout(250);
  let s1 = await state(page);
  check(s1.passes === 1 && s1.ctrl !== s0.ctrl, `passe semi-assistido: ${s0.ctrl} -> ${s1.target || s1.ctrl} (controle mudou para o destinatário)`);
  await touch("touchEnd", [[ring[0] - 40, ring[1], 1]]);   // solta o analógico
  // espera o destinatário dominar (sem tocar no analógico ele vai sozinho na bola)
  await page.waitForFunction(() => { const m = document.querySelector(".mv")._match; return m.ball.owner && m.ball.owner === m.ctrl; }, null, { timeout: 6000 }).catch(() => {});
  let s2 = await state(page);
  check(s2.owner === s2.ctrl, "destinatário domina a bola sozinho (" + s2.ctrl + ")");
  // analógico fixo: segura para a direita e confere deslocamento; o anel não sai do lugar
  await touch("touchStart", [[ring[0] + 50, ring[1], 1]]);
  await page.waitForTimeout(700);
  const ring2 = await page.evaluate(() => { const r = document.querySelector("#mvring").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  let s3 = await state(page);
  check(s3.x > s2.x + 2, `analógico move o jogador (${s2.x} -> ${s3.x})`);
  check(Math.abs(ring2[0] - ring[0]) < 1 && Math.abs(ring2[1] - ring[1]) < 1, "base do analógico fica fixa");
  await page.screenshot({ path: SH + "21-toque-paisagem.png" });
  // chute carregado
  const kb = await page.evaluate(() => { const r = document.querySelector("#mvkick").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  // garante a posse no instante do toque (pausa o jogo, dá a bola ao jogador controlado e retoma)
  const before = await page.evaluate(() => {
    const m = document.querySelector(".mv")._match, c = m.ctrl;
    m.setPiece = null; m.state = "play"; m.ball.owner = null; m.own(c); c.protect = 120;
    return m.stats.shots[0];
  });
  await touch("touchStart", [[ring[0] + 50, ring[1], 1], [kb[0], kb[1], 3]]);
  await page.waitForTimeout(350);
  await touch("touchEnd", [[kb[0], kb[1], 3]]);
  await page.waitForTimeout(120);
  let s4 = await state(page);
  check(s4.shots === before + 1, "chute carregado pelo toque saiu (velocidade da bola " + s4.bspeed + " m/s)");
  await touch("touchEnd", [[ring[0] + 50, ring[1], 1]]);
  // pausa e simular o resto
  await page.tap(".mv-pause");
  await page.waitForTimeout(200);
  check(await page.evaluate(() => !document.querySelector("#mvmenu").classList.contains("hidden")), "pausa");
  await page.tap('[data-act="skip"]');
  await page.waitForFunction(() => window.__res || document.querySelector(".pk"), null, { timeout: 30000 });
  const res = await page.evaluate(() => window.__res);
  check(res && res.score.length === 2, "partida terminou: " + JSON.stringify(res && { score: res.score, gols: res.goals.map(g => g.name + " " + g.min + "'") }));
  await ctx.close();

  /* ---------- 2) celular em pé ---------- */
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  page = await ctx.newPage();
  page.on("pageerror", e => errs.push(e.message));
  await page.goto(URL);
  await start(page, {});
  await page.waitForFunction(() => document.querySelector(".mv")._match.setPiece, null, { timeout: 8000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: SH + "22-toque-retrato.png" });
  await ctx.close();

  /* ---------- 3) controle (gamepad simulado), tela de TV ---------- */
  ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page = await ctx.newPage();
  page.on("pageerror", e => errs.push(e.message));
  await page.addInitScript(() => {
    const pad = { connected: true, id: "Teste", index: 0, mapping: "standard", axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    window.__pad = pad;
    window.__press = (i, on) => { pad.buttons[i] = { pressed: on, value: on ? 1 : 0 }; };
    navigator.getGamepads = () => [pad];
  });
  await page.goto(URL);
  await page.waitForSelector(".title");
  const tapPad = async i => { await page.evaluate(i => window.__press(i, true), i); await page.waitForTimeout(90); await page.evaluate(i => window.__press(i, false), i); await page.waitForTimeout(160); };
  // menus pelo controle: A em "Nova carreira"
  await tapPad(13);
  const foc = await page.evaluate(() => document.querySelector(".padfocus")?.textContent);
  check(!!foc, "menu: foco pelo controle em \"" + foc + "\"");
  await tapPad(0);
  await page.waitForSelector(".grid", { timeout: 5000 }).catch(() => {});
  check(!!(await page.$(".grid")), "menu: A abriu Nova carreira");
  // desce até um clube e escolhe
  for (let i = 0; i < 6; i++) await tapPad(13);
  let tries = 0;
  while (!(await page.evaluate(() => document.querySelector(".padfocus")?.classList.contains("pick"))) && tries++ < 12) await tapPad(13);
  await tapPad(0);
  const picked = await page.evaluate(() => window.__mh.ui.pick);
  check(!!picked, "menu: clube escolhido pelo controle");
  // vai até o botão Começar e confirma
  tries = 0;
  while (!(await page.evaluate(() => document.querySelector(".padfocus")?.dataset.act === "start")) && tries++ < 40) await tapPad(13);
  await tapPad(0);
  await page.waitForSelector(".next", { timeout: 8000 }).catch(() => {});
  check(!!(await page.$(".next")), "menu: carreira iniciada pelo controle");
  // LB/RB mudam de aba; B volta ao início
  await tapPad(5);
  check((await page.evaluate(() => window.__mh.ui.tab)) === "squad", "menu: RB muda de aba");
  await tapPad(1);
  check((await page.evaluate(() => window.__mh.ui.tab)) === "home", "menu: B volta ao início");
  await page.screenshot({ path: SH + "23-menu-controle.png" });
  // inicia o jogo pelo controle
  tries = 0;
  while (!(await page.evaluate(() => document.querySelector(".padfocus")?.dataset.act === "play")) && tries++ < 12) await tapPad(tries % 2 ? 15 : 13);
  await tapPad(0);
  await page.waitForSelector(".mv", { timeout: 8000 });
  await page.waitForFunction(() => { const m = document.querySelector(".mv")._match; return m.setPiece || (m.state === "play" && m.ctrl); }, null, { timeout: 10000 });
  await page.waitForTimeout(400);
  const g0 = await state(page);
  // analógico para a direita por um tempo
  await page.evaluate(() => { window.__pad.axes[0] = 1; });
  if (g0.setPiece && g0.owner === g0.ctrl) { await tapPad(0); await page.waitForTimeout(600); }
  await page.waitForTimeout(900);
  const g1 = await state(page);
  check(g1.ctrl && (g1.x !== g0.x || g1.ctrl !== g0.ctrl), `partida: analógico do controle move (${g0.ctrl} ${g0.x} -> ${g1.ctrl} ${g1.x})`);
  check(await page.evaluate(() => document.querySelector(".mv").classList.contains("pad")), "partida: botões de toque somem quando há controle");
  await page.screenshot({ path: SH + "24-partida-tv.png" });
  await page.evaluate(() => { window.__pad.axes[0] = 0; });
  await tapPad(9);
  check(await page.evaluate(() => !document.querySelector("#mvmenu").classList.contains("hidden")), "partida: Start pausa");
  await tapPad(3);
  await page.waitForSelector(".result", { timeout: 30000 }).catch(() => {});
  check(!!(await page.$(".result")), "partida: Y no menu simula o resto e chega ao pós-jogo");
  await page.screenshot({ path: SH + "25-pos-jogo-tv.png" });

  console.log("erros de página:", errs.length, errs.join("\n"));
  await browser.close();
  if (errs.length || fails) process.exit(1);
})().catch(e => { console.error("FALHOU:", e.message); process.exit(1); });
