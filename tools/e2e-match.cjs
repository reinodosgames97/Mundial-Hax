// Testa a partida no navegador: toque (joystick/chute), prorrogação e pênaltis.
// node tools/e2e-match.cjs [url] [pasta-de-capturas]
const { chromium } = require("playwright");
const URL = process.argv[2] || "http://localhost:8123/", SH = (process.argv[3] || "shots") + "/";
require("fs").mkdirSync(SH, { recursive: true });
const start = (page, extra) => page.evaluate(async extra => {
  const { runMatch } = await import("./js/game/view.js");
  const side = (n, c1, c2) => ({ name: n, abbr: n.slice(0, 3).toUpperCase(), c1, c2, crest: "" });
  window.__res = null;
  runMatch(document.body, { size: 4, mins: 3, diff: 1, ratings: [75, 75], human: 0, sound: false, left: side("Azul", "#1e56c8", "#ffffff"), right: side("Rubro", "#c81e2c", "#000000"), title: "Teste", ...extra }).then(r => (window.__res = r));
}, extra);
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  await page.goto(URL);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });

  // 1) joystick para cima (retrato = atacar) + chute segurado
  await start(page, {});
  await page.waitForTimeout(1800);
  const before = await page.evaluate(() => { const m = document.querySelector(".mv")._match; return { x: m.ctrl.x, y: m.ctrl.y }; });
  await touch("touchStart", [[90, 760, 1]]);
  await touch("touchMove", [[90, 700, 1]]);
  await touch("touchStart", [[90, 700, 1], [330, 770, 2]]);
  await page.waitForTimeout(900);
  const mid = await page.evaluate(() => { const m = document.querySelector(".mv")._match; return { x: m.ctrl.x, y: m.ctrl.y, kick: m.ctrl.kick, ix: m.ctrl.ix, iy: m.ctrl.iy, ball: Math.hypot(m.w.ball.vx, m.w.ball.vy), touched: m.w.touched }; });
  await page.screenshot({ path: SH + "20-toque.png" });
  await touch("touchEnd", []);
  console.log("toque: antes", JSON.stringify(before), "depois", JSON.stringify(mid));
  const okMove = mid.x > before.x + 5 && mid.ix > 0.5 && mid.kick === true;
  console.log(okMove ? "OK: joystick moveu o jogador para o ataque e o chute foi acionado" : "FALHA no controle por toque");
  // trocar jogador
  const c1 = await page.evaluate(() => document.querySelector(".mv")._match.ctrl.num);
  await page.tap("#mvswitch");
  const c2 = await page.evaluate(() => document.querySelector(".mv")._match.ctrl.num);
  console.log("troca de jogador:", c1, "->", c2, c1 !== c2 ? "OK" : "FALHA");
  // pausa
  await page.tap(".mv-pause"); await page.waitForTimeout(200);
  const paused = await page.evaluate(() => !document.querySelector("#mvmenu").classList.contains("hidden"));
  console.log("pausa:", paused ? "OK" : "FALHA");
  await page.screenshot({ path: SH + "21-pausa.png" });
  await page.tap('[data-act="skip"]');
  await page.waitForFunction(() => window.__res || document.querySelector(".pk"), null, { timeout: 20000 });
  console.log("resultado após simular o resto:", JSON.stringify(await page.evaluate(() => window.__res)));

  // 2) mata-mata empatado -> prorrogação -> pênaltis
  await page.reload();
  await start(page, { needWinner: true, mins: 0.1, speed: 6, levels: [0.05, 0.05] });
  await page.waitForFunction(() => document.querySelector(".pk") || window.__res, null, { timeout: 60000 });
  const hasPk = await page.evaluate(() => !!document.querySelector(".pk"));
  console.log("pênaltis abertos:", hasPk);
  if (hasPk) {
    await page.waitForTimeout(700);
    await page.screenshot({ path: SH + "22-penaltis.png" });
    for (let i = 0; i < 40 && !(await page.evaluate(() => window.__res)); i++) { await page.tap(`.pk-zone[data-z="${i % 6}"]`).catch(() => {}); await page.waitForTimeout(1700); }
  }
  const res = await page.evaluate(() => window.__res);
  console.log("resultado mata-mata:", JSON.stringify(res), res && (res.score[0] !== res.score[1] || (res.pens && res.pens[0] !== res.pens[1])) ? "OK (há vencedor)" : "FALHA");
  console.log("erros:", errs.length, errs.join("\n"));
  await browser.close();
  if (errs.length || !okMove) process.exit(1);
})().catch(e => { console.error("FALHOU:", e.message); process.exit(1); });
