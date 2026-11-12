// Teste ponta a ponta no navegador (Playwright): node tools/e2e.cjs [url] [pasta-de-capturas] [clube] [aba: A|B|C|D]
// Requer o servidor rodando: node tools/serve.mjs 8123
const { chromium } = require("playwright");
const URL = process.argv[2] || "http://localhost:8123/";
const SH = (process.argv[3] || "shots") + "/";
const CLUB = process.argv[4] || "Flamengo", TAB = process.argv[5] || "A";
require("fs").mkdirSync(SH, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push("console: " + m.text().slice(0, 200)); });
  page.on("dialog", d => d.accept());
  const shot = n => page.screenshot({ path: SH + n + ".png" });

  await page.goto(URL);
  await page.waitForSelector(".title");
  await shot("01-inicio");
  await page.click('[data-act="new"]');
  await page.waitForSelector(".grid");
  await page.waitForTimeout(2500);
  await shot("02-escolha");
  await page.fill("#coach", "Teste");
  if (TAB !== "A") { await page.click(`[data-act="picktab"][data-v="${TAB}"]`); await page.waitForTimeout(800); }
  for (const b of await page.$$(".pick")) if ((await b.innerText()).includes(CLUB)) { await b.click(); break; }
  await page.click('[data-act="start"]');
  await page.waitForSelector(".next");
  await page.waitForTimeout(1500);
  await shot("03-hub");

  // partida jogada (retrato e paisagem)
  await page.click('[data-act="play"]');
  await page.waitForSelector(".mv");
  await page.waitForTimeout(3500);
  await shot("04-partida-retrato");
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(2500);
  await shot("05-partida-paisagem");
  const info = await page.evaluate(() => { const m = document.querySelector(".mv")._match; return { state: m.state, score: m.score, clock: m.clockText(), ctrl: m.ctrl && m.ctrl.num }; });
  console.log("partida:", JSON.stringify(info));
  await page.evaluate(() => document.querySelector(".mv")._ff());
  await page.waitForSelector(".result", { timeout: 20000 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  await shot("06-pos-jogo");
  await page.click('[data-act="postok"]');
  for (const t of ["tables", "games", "stats", "opts"]) { await page.click(`.nav [data-v="${t}"]`); await page.waitForTimeout(600); await shot("07-" + t); }

  // simula o resto da temporada e vira o ano
  await page.click('.nav [data-v="opts"]');
  await page.click('[data-act="simall"]');
  await page.waitForSelector('[data-act="endseason"]', { timeout: 30000 });
  await shot("08-fim-temporada");
  await page.click('[data-act="endseason"]');
  await page.waitForSelector('[data-act="nextseason"]');
  await shot("09-resumo");
  await page.click('[data-act="nextseason"]');
  await page.waitForSelector(".next");
  const season = await page.evaluate(() => window.__mh.G.season);
  console.log("nova temporada:", season);
  await page.click('.nav [data-v="stats"]');
  await page.waitForTimeout(500);
  await shot("10-titulos");

  // recarrega e continua a carreira salva
  await page.reload();
  await page.waitForSelector('[data-act="continue"]');
  await page.click('[data-act="continue"]');
  await page.waitForSelector(".next");
  const crests = await page.evaluate(() => [document.querySelectorAll(".crest.ok").length, document.querySelectorAll(".crest").length]);
  console.log("escudos carregados/total:", crests.join("/"));
  console.log("erros:", errs.length, errs.slice(0, 8).join("\n"));
  await browser.close();
  if (errs.length) process.exit(1);
})().catch(e => { console.error("E2E FALHOU:", e.message); process.exit(1); });
